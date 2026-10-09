import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  validateStreamUrl,
  detectStreamFormat,
  deriveStreamTitle,
  sanitizeStreamUrlForLogging,
  StreamFormat,
} from "@/lib/stream-resolver";
import { loadShakaModule, isShakaSupported } from "./shakaPlayer";

export type NetworkPlayerState =
  | "IDLE"
  | "VALIDATING"
  | "LOADING"
  | "READY"
  | "PLAYING"
  | "PAUSED"
  | "BUFFERING"
  | "ERROR";

export type PlaybackEngineType = "native" | "hlsjs" | "shaka" | "youtube" | "none";

export interface NetworkPlayerErrorInfo {
  stage: "validation" | "manifest" | "network" | "codec" | "cors" | "playback" | "unsupported";
  title: string;
  message: string;
  technicalDetails?: string;
  suggestedAction?: string;
  canRetry: boolean;
}

export interface NetworkPlayerDiagnostics {
  engine: PlaybackEngineType;
  format: StreamFormat;
  playerState: NetworkPlayerState;
  videoWidth: number;
  videoHeight: number;
  duration: number;
  currentTime: number;
  bufferedEnd: number;
  playbackRate: number;
  isMuted: boolean;
  mediaErrorCode: number | null;
  lastEvent: string;
  lastEventTime: number;
  sanitizedUrl: string;
}

export interface UseNetworkStreamPlayerOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  streamUrl: string | null;
  streamTitle?: string | null;
  desiredPlaybackState: "playing" | "paused";
  onPlaybackStateChange?: (state: "playing" | "paused") => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onErrorChange?: (error: NetworkPlayerErrorInfo | null) => void;
  onUserAction?: (action: "play" | "pause" | "seek", position: number) => void;
}

export function useNetworkStreamPlayer({
  videoRef,
  streamUrl,
  streamTitle,
  desiredPlaybackState,
  onPlaybackStateChange,
  onTimeUpdate,
  onErrorChange,
  onUserAction,
}: UseNetworkStreamPlayerOptions) {
  const [playerState, setPlayerState] = useState<NetworkPlayerState>("IDLE");
  const [engine, setEngine] = useState<PlaybackEngineType>("none");
  const [detectedFormat, setDetectedFormat] = useState<StreamFormat>("unknown");
  const [errorInfo, setErrorInfo] = useState<NetworkPlayerErrorInfo | null>(null);
  const [isAutoplayMuted, setIsAutoplayMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<NetworkPlayerDiagnostics>({
    engine: "none",
    format: "unknown",
    playerState: "IDLE",
    videoWidth: 0,
    videoHeight: 0,
    duration: 0,
    currentTime: 0,
    bufferedEnd: 0,
    playbackRate: 1,
    isMuted: false,
    mediaErrorCode: null,
    lastEvent: "init",
    lastEventTime: Date.now(),
    sanitizedUrl: "",
  });

  // Engine references
  const hlsRef = useRef<Hls | null>(null);
  const shakaPlayerRef = useRef<any>(null);
  const isProgrammaticSyncRef = useRef(false);
  const programmaticSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDestroyingRef = useRef(false);
  const isLoadingPipelineRef = useRef(false);
  const attemptedHlsFallbackRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const retryCountRef = useRef(0);

  const engineRef = useRef<PlaybackEngineType>("none");
  engineRef.current = engine;

  const desiredPlaybackStateRef = useRef(desiredPlaybackState);
  desiredPlaybackStateRef.current = desiredPlaybackState;

  const updateDiagnostics = useCallback(
    (partial: Partial<NetworkPlayerDiagnostics>) => {
      setDiagnostics((prev) => ({
        ...prev,
        ...partial,
        lastEventTime: Date.now(),
      }));
    },
    []
  );

  const reportError = useCallback(
    (err: NetworkPlayerErrorInfo) => {
      console.warn(
        `[NetworkStreamPlayer] ${err.title} (${err.stage}):`,
        err.message,
        err.technicalDetails || ""
      );
      setErrorInfo(err);
      setPlayerState("ERROR");
      updateDiagnostics({
        playerState: "ERROR",
        lastEvent: `error:${err.stage}`,
      });
      onErrorChange?.(err);
    },
    [onErrorChange, updateDiagnostics]
  );

  const clearError = useCallback(() => {
    setErrorInfo(null);
    onErrorChange?.(null);
  }, [onErrorChange]);

  // Clean up existing player instances
  const destroyCurrentEngines = useCallback(() => {
    isDestroyingRef.current = true;
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (e) {
        console.warn("[NetworkStreamPlayer] Hls destroy error:", e);
      }
      hlsRef.current = null;
    }

    if (shakaPlayerRef.current) {
      try {
        void shakaPlayerRef.current.destroy();
      } catch (e) {
        console.warn("[NetworkStreamPlayer] Shaka destroy error:", e);
      }
      shakaPlayerRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
    }

    setTimeout(() => {
      isDestroyingRef.current = false;
    }, 50);
  }, [videoRef]);

  // Safe play helper handling autoplay unmuted block
  const executePlay = useCallback(
    async (video: HTMLVideoElement) => {
      try {
        await video.play();
      } catch (err: any) {
        if (err?.name === "NotAllowedError") {
          console.log(
            "[NetworkStreamPlayer] Unmuted autoplay blocked by browser policy; falling back to muted playback with tap-to-unmute"
          );
          video.muted = true;
          setIsAutoplayMuted(true);
          updateDiagnostics({ isMuted: true, lastEvent: "autoplay:muted_fallback" });
          try {
            await video.play();
          } catch {
            /* ignore muted play rejection */
          }
        } else if (err?.name === "AbortError") {
          // Playback aborted by user pause or new load
        } else {
          console.warn("[NetworkStreamPlayer] Play error:", err?.name, err?.message);
        }
      }
    },
    [updateDiagnostics]
  );

  // Dedicated HLS pipeline helper (used for .m3u8 format and fallback)
  const setupHlsPipeline = useCallback(
    (streamUrlToLoad: string, currentGen: number): boolean => {
      const video = videoRef.current;
      if (!video) return false;

      const canPlayNativeHls =
        video.canPlayType("application/vnd.apple.mpegurl") !== "" ||
        video.canPlayType("application/x-mpegURL") !== "";

      const shouldUseHlsJs = typeof window !== "undefined" && Hls.isSupported();

      if (shouldUseHlsJs) {
        setEngine("hlsjs");
        updateDiagnostics({ engine: "hlsjs" });

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          backBufferLength: 60,
          manifestLoadingTimeOut: 12000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 12000,
          fragLoadingTimeOut: 15000,
        });
        hlsRef.current = hls;

        hls.attachMedia(video);
        hls.loadSource(streamUrlToLoad);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (currentGen !== loadGenerationRef.current) return;
          clearError();
          isLoadingPipelineRef.current = false;
          setPlayerState("READY");
          updateDiagnostics({ playerState: "READY", lastEvent: "hls:manifest_parsed" });

          if (desiredPlaybackStateRef.current === "playing") {
            void executePlay(video);
          }
        });

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (currentGen === loadGenerationRef.current) {
            setPlayerState((prev) => (prev === "BUFFERING" ? "PLAYING" : prev));
          }
        });

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (currentGen !== loadGenerationRef.current) return;
          if (data.fatal) {
            console.warn("[NetworkStreamPlayer] Hls fatal error:", data.type, data.details);
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              if (retryCountRef.current < 2) {
                retryCountRef.current++;
                console.log(
                  "[NetworkStreamPlayer] Auto-recovering HLS network error (attempt " +
                    retryCountRef.current +
                    ")..."
                );
                hls.startLoad();
              } else {
                reportError({
                  stage: "network",
                  title: "HLS Stream Unreachable",
                  message:
                    "The HLS stream or its video segments could not be reached. Ensure the stream is online, public, and allows cross-origin requests (CORS).",
                  technicalDetails: `HLS Network Error: ${data.details}`,
                  suggestedAction:
                    "Check your internet connection, verify the URL is online, and confirm CORS headers are enabled on the stream server.",
                  canRetry: true,
                });
              }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              if (retryCountRef.current < 2) {
                retryCountRef.current++;
                console.log("[NetworkStreamPlayer] Auto-recovering HLS media error...");
                hls.recoverMediaError();
              } else {
                reportError({
                  stage: "codec",
                  title: "HLS Codec Incompatibility",
                  message: "The media stream codecs could not be decoded by your browser.",
                  technicalDetails: `HLS Fatal Media Error: ${data.details}`,
                  suggestedAction:
                    "Ensure the stream uses standard H.264 video and AAC audio codecs.",
                  canRetry: true,
                });
              }
            } else {
              reportError({
                stage: "manifest",
                title: "HLS Playback Failure",
                message:
                  "HLS player encountered an unrecoverable error while demuxing the stream.",
                technicalDetails: `HLS Fatal Error: ${data.details}`,
                suggestedAction:
                  "Ensure the stream uses standard H.264 video and AAC audio codecs.",
                canRetry: true,
              });
            }
          }
        });

        return true;
      } else if (canPlayNativeHls) {
        // Native Safari / iOS HLS
        setEngine("native");
        updateDiagnostics({ engine: "native" });

        video.src = streamUrlToLoad;
        video.load();

        if (desiredPlaybackStateRef.current === "playing") {
          void executePlay(video);
        }
        return true;
      } else {
        reportError({
          stage: "unsupported",
          title: "HLS Adaptive Streaming Not Supported",
          message:
            "Your browser does not support HLS streaming natively or via MediaSource Extensions.",
          suggestedAction: "Please use a modern desktop browser (Chrome, Edge, Firefox, Safari).",
          canRetry: false,
        });
        return false;
      }
    },
    [videoRef, clearError, executePlay, reportError, updateDiagnostics]
  );

  // Main pipeline initialization
  const initializeStreamPipeline = useCallback(
    async (url: string) => {
      const currentGen = ++loadGenerationRef.current;
      clearError();
      destroyCurrentEngines();
      attemptedHlsFallbackRef.current = false;
      isLoadingPipelineRef.current = true;

      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      const sanitized = sanitizeStreamUrlForLogging(url);

      setPlayerState("VALIDATING");
      updateDiagnostics({
        playerState: "VALIDATING",
        sanitizedUrl: sanitized,
        lastEvent: "validating",
      });

      // 1. URL Validation
      const validation = validateStreamUrl(url, isHttps);
      setDetectedFormat(validation.format);
      updateDiagnostics({ format: validation.format });

      if (!validation.isValid) {
        isLoadingPipelineRef.current = false;
        if (validation.format === "unsupported_container") {
          reportError({
            stage: "codec",
            title: "Browser Codec Limitation",
            message:
              validation.unsupportedReason ||
              "This container format cannot be decoded directly by web browsers.",
            suggestedAction:
              validation.suggestedAction ||
              "Use an MP4 (H.264/AAC) or HLS stream, or play in VLC and click 'Share Screen'.",
            canRetry: false,
          });
          return;
        }

        if (validation.format === "unsupported_protocol") {
          reportError({
            stage: "unsupported",
            title: "Unsupported Protocol",
            message:
              validation.unsupportedReason ||
              "Browsers cannot open this protocol due to sandbox restrictions.",
            suggestedAction:
              validation.suggestedAction ||
              "Please provide an HTTP or HTTPS stream URL (HLS, DASH, or MP4).",
            canRetry: false,
          });
          return;
        }

        if (validation.isInsecureHttp) {
          reportError({
            stage: "network",
            title: "Insecure Stream (Mixed Content)",
            message:
              validation.unsupportedReason ||
              "Modern browsers block insecure HTTP streams on secure HTTPS pages.",
            suggestedAction:
              validation.suggestedAction ||
              "Please provide an HTTPS (https://) version of this stream.",
            canRetry: true,
          });
          return;
        }

        if (validation.format === "webpage") {
          reportError({
            stage: "validation",
            title: "Webpage URL Provided",
            message:
              validation.unsupportedReason ||
              "The provided link leads to a web page rather than a direct media stream.",
            suggestedAction:
              validation.suggestedAction ||
              "Please copy a direct video stream link ending in .mp4, .m3u8, or .mpd.",
            canRetry: false,
          });
          return;
        }

        reportError({
          stage: "validation",
          title: "Invalid Stream URL",
          message:
            validation.unsupportedReason ||
            "The stream URL could not be validated for browser playback.",
          suggestedAction: validation.suggestedAction || "Verify the URL and try again.",
          canRetry: false,
        });
        return;
      }

      // Check if URL is YouTube (handled by YouTube embed)
      if (validation.format === "youtube") {
        isLoadingPipelineRef.current = false;
        setEngine("youtube");
        setPlayerState("READY");
        updateDiagnostics({ engine: "youtube", playerState: "READY", lastEvent: "youtube:ready" });
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      setPlayerState("LOADING");
      updateDiagnostics({ playerState: "LOADING", lastEvent: "loading" });

      const format = validation.format;

      // 2. MPEG-DASH (.mpd) pipeline
      if (format === "dash") {
        setEngine("shaka");
        updateDiagnostics({ engine: "shaka" });

        if (!isShakaSupported()) {
          isLoadingPipelineRef.current = false;
          reportError({
            stage: "unsupported",
            title: "MPEG-DASH Not Supported",
            message:
              "Your browser does not support MediaSource Extensions required for MPEG-DASH streaming.",
            suggestedAction:
              "Try an HLS (.m3u8) or direct MP4 stream, or use a modern desktop browser.",
            canRetry: false,
          });
          return;
        }

        const shaka = await loadShakaModule();
        if (currentGen !== loadGenerationRef.current) return;

        if (!shaka || !shaka.Player) {
          isLoadingPipelineRef.current = false;
          reportError({
            stage: "manifest",
            title: "DASH Engine Initialization Error",
            message: "Failed to initialize the MPEG-DASH playback engine.",
            suggestedAction: "Reload the page or use an HLS/MP4 stream.",
            canRetry: true,
          });
          return;
        }

        try {
          const player = new shaka.Player();
          shakaPlayerRef.current = player;
          await player.attach(video);

          player.addEventListener("error", (event: any) => {
            const shakaErr = event?.detail;
            console.warn("[NetworkStreamPlayer] Shaka error event:", shakaErr);
            if (currentGen === loadGenerationRef.current) {
              reportError({
                stage: "manifest",
                title: "MPEG-DASH Stream Error",
                message:
                  shakaErr?.message ||
                  "The DASH manifest or segments could not be loaded. Verify CORS and network accessibility.",
                technicalDetails: `Shaka Error code: ${shakaErr?.code || "unknown"}`,
                suggestedAction:
                  "Ensure the stream is online, public, and allows cross-origin requests (CORS).",
                canRetry: true,
              });
            }
          });

          await player.load(url);
          if (currentGen !== loadGenerationRef.current) return;

          isLoadingPipelineRef.current = false;
          setPlayerState("READY");
          updateDiagnostics({ playerState: "READY", lastEvent: "shaka:loaded" });

          if (desiredPlaybackStateRef.current === "playing") {
            void executePlay(video);
          }
          return;
        } catch (err: any) {
          if (currentGen !== loadGenerationRef.current) return;
          isLoadingPipelineRef.current = false;
          console.warn("[NetworkStreamPlayer] Shaka load failure:", err);
          reportError({
            stage: "network",
            title: "MPEG-DASH Manifest Load Error",
            message:
              err?.message ||
              "Could not fetch or parse the MPEG-DASH manifest. Ensure the URL is accessible and permits cross-origin requests.",
            technicalDetails: `Shaka Load Error: ${err?.code || err?.message || "unknown"}`,
            suggestedAction:
              "Verify the DASH stream URL is active and allows browser CORS requests.",
            canRetry: true,
          });
          return;
        }
      }

      // 3. HLS (.m3u8) pipeline
      if (format === "hls") {
        setupHlsPipeline(url, currentGen);
        return;
      }

      // 4. Native HTML5 Video pipeline (Direct MP4, WebM, OGG, or generic)
      // IMPORTANT: No crossOrigin="anonymous" on direct video so browser does not block non-CORS direct media
      setEngine("native");
      updateDiagnostics({ engine: "native" });

      if (video.src !== url) {
        video.src = url;
        video.load();
      }

      if (desiredPlaybackStateRef.current === "playing") {
        void executePlay(video);
      }
    },
    [
      videoRef,
      clearError,
      destroyCurrentEngines,
      updateDiagnostics,
      reportError,
      executePlay,
      setupHlsPipeline,
    ]
  );

  // Kickstart stream pipeline when streamUrl changes
  useEffect(() => {
    retryCountRef.current = 0;
    if (!streamUrl) {
      setPlayerState("IDLE");
      setEngine("none");
      setDetectedFormat("unknown");
      clearError();
      destroyCurrentEngines();
      updateDiagnostics({
        playerState: "IDLE",
        engine: "none",
        format: "unknown",
        sanitizedUrl: "",
        lastEvent: "idle",
      });
      return;
    }

    void initializeStreamPipeline(streamUrl);

    const genRef = loadGenerationRef;
    return () => {
      genRef.current += 1;
      destroyCurrentEngines();
    };
  }, [streamUrl, initializeStreamPipeline, clearError, destroyCurrentEngines, updateDiagnostics]);

  // Sync desired playback state with active video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl || playerState === "ERROR" || playerState === "VALIDATING") {
      return;
    }

    if (desiredPlaybackState === "playing") {
      if (video.paused) {
        void executePlay(video);
      }
    } else if (desiredPlaybackState === "paused") {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [desiredPlaybackState, streamUrl, playerState, videoRef, executePlay]);

  // Attach native HTML5 video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      clearError();
      const rawDur = video.duration;
      const dur = Number.isFinite(rawDur) && rawDur > 0 ? Math.floor(rawDur) : 0;
      setDuration(dur);
      updateDiagnostics({
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        duration: dur,
        lastEvent: "loadedmetadata",
      });
    };

    const onCanPlay = () => {
      isLoadingPipelineRef.current = false;
      setPlayerState((prev) => (prev === "LOADING" || prev === "VALIDATING" ? "READY" : prev));
      updateDiagnostics({ lastEvent: "canplay" });
      if (desiredPlaybackStateRef.current === "playing" && video.paused) {
        void executePlay(video);
      }
    };

    const onPlaying = () => {
      isLoadingPipelineRef.current = false;
      setPlayerState("PLAYING");
      updateDiagnostics({ playerState: "PLAYING", lastEvent: "playing" });
      if (!isProgrammaticSyncRef.current) {
        onPlaybackStateChange?.("playing");
      }
    };

    const onPause = () => {
      if (isDestroyingRef.current || isLoadingPipelineRef.current) {
        return;
      }
      setPlayerState((prev) => (prev === "ERROR" ? prev : "PAUSED"));
      updateDiagnostics({ playerState: "PAUSED", lastEvent: "pause" });
      if (!isProgrammaticSyncRef.current) {
        onPlaybackStateChange?.("paused");
      }
    };

    const onWaiting = () => {
      setPlayerState((prev) => (prev === "ERROR" ? prev : "BUFFERING"));
      updateDiagnostics({ playerState: "BUFFERING", lastEvent: "waiting" });
    };

    const onTimeUpdateNative = () => {
      const cur = Math.floor(video.currentTime || 0);
      const rawDur = video.duration;
      const dur = Number.isFinite(rawDur) && rawDur > 0 ? Math.floor(rawDur) : duration || 0;
      setCurrentTime(cur);

      let bufEnd = 0;
      if (video.buffered && video.buffered.length > 0) {
        bufEnd = Math.floor(video.buffered.end(video.buffered.length - 1));
      }

      updateDiagnostics({
        currentTime: cur,
        duration: dur,
        bufferedEnd: bufEnd,
      });

      onTimeUpdate?.(cur, dur);
    };

    const onErrorNative = () => {
      const videoErr = video.error;
      console.warn("[NetworkStreamPlayer] Native HTML5 video error:", videoErr);

      if (!streamUrl || isDestroyingRef.current) return;

      const code = videoErr?.code;
      updateDiagnostics({ mediaErrorCode: code || null, lastEvent: "error" });

      if (code === 3) {
        // MEDIA_ERR_DECODE
        reportError({
          stage: "codec",
          title: "Audio/Video Codec Decode Error",
          message:
            "This video uses a codec (such as AC3/DTS audio, HEVC, or an MKV container) that web browsers cannot hardware-decode.",
          technicalDetails: "HTML5 Video error code: 3 (MEDIA_ERR_DECODE)",
          suggestedAction:
            "You can play this video locally in VLC and click 'Share Screen' to stream your screen in synchronized 1080p with audio, or provide an MP4/HLS stream.",
          canRetry: false,
        });
      } else if (code === 4) {
        // MEDIA_ERR_SRC_NOT_SUPPORTED
        // If native HTML5 video failed, check if Hls.js fallback can decode it
        if (
          Hls.isSupported() &&
          engineRef.current === "native" &&
          !attemptedHlsFallbackRef.current &&
          streamUrl
        ) {
          attemptedHlsFallbackRef.current = true;
          console.log(
            "[NetworkStreamPlayer] Native video source unsupported (error 4); attempting Hls.js fallback for stream"
          );
          const ok = setupHlsPipeline(streamUrl, loadGenerationRef.current);
          if (ok) return;
        }

        reportError({
          stage: "playback",
          title: "Media Source Inaccessible or Unsupported",
          message:
            "The browser could not open this media stream. The source may be offline, protected, or blocked by the host.",
          technicalDetails: "HTML5 Video error code: 4 (MEDIA_ERR_SRC_NOT_SUPPORTED)",
          suggestedAction:
            "Verify the URL is online, publicly accessible, and points to a direct video or HLS/DASH stream.",
          canRetry: true,
        });
      } else if (code === 2) {
        // MEDIA_ERR_NETWORK
        reportError({
          stage: "network",
          title: "Network Connection Interrupted",
          message:
            "A network error caused the video download to fail part-way. Please check your connection.",
          technicalDetails: "HTML5 Video error code: 2 (MEDIA_ERR_NETWORK)",
          suggestedAction: "Check your internet connection and try reloading the stream.",
          canRetry: true,
        });
      } else if (code === 1) {
        // MEDIA_ERR_ABORTED
        // Normal abort during source switch; ignore
      } else {
        reportError({
          stage: "playback",
          title: "Playback Error",
          message:
            "An unexpected error occurred during playback. Verify the URL is valid and reachable.",
          technicalDetails: `HTML5 Video error: ${videoErr?.message || "unknown"}`,
          suggestedAction: "Try reloading the stream.",
          canRetry: true,
        });
      }
    };

    const onSeeked = () => {
      if (isProgrammaticSyncRef.current) {
        if (programmaticSyncTimerRef.current) {
          clearTimeout(programmaticSyncTimerRef.current);
        }
        programmaticSyncTimerRef.current = setTimeout(() => {
          isProgrammaticSyncRef.current = false;
          programmaticSyncTimerRef.current = null;
        }, 350);
      }
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("timeupdate", onTimeUpdateNative);
    video.addEventListener("error", onErrorNative);
    video.addEventListener("seeked", onSeeked);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("timeupdate", onTimeUpdateNative);
      video.removeEventListener("error", onErrorNative);
      video.removeEventListener("seeked", onSeeked);
      if (programmaticSyncTimerRef.current) {
        clearTimeout(programmaticSyncTimerRef.current);
        programmaticSyncTimerRef.current = null;
      }
    };
  }, [
    videoRef,
    streamUrl,
    duration,
    clearError,
    reportError,
    updateDiagnostics,
    onPlaybackStateChange,
    onTimeUpdate,
    executePlay,
    setupHlsPipeline,
  ]);

  // Programmatic partner sync helper (suppresses echo broadcasts)
  const applyRemotePlayback = useCallback(
    (targetState: "playing" | "paused", targetPosition?: number) => {
      const video = videoRef.current;
      if (!video) return;

      isProgrammaticSyncRef.current = true;
      if (programmaticSyncTimerRef.current) {
        clearTimeout(programmaticSyncTimerRef.current);
        programmaticSyncTimerRef.current = null;
      }

      if (typeof targetPosition === "number" && !isNaN(targetPosition)) {
        const drift = Math.abs(video.currentTime - targetPosition);
        const threshold = targetState === "paused" ? 1.0 : 2.5;
        if (drift > threshold) {
          video.currentTime = targetPosition;
        }
      }

      if (targetState === "playing") {
        if (video.paused) {
          void executePlay(video);
        }
      } else {
        if (!video.paused) {
          video.pause();
        }
      }

      // Safe fallback timer resets programmatic sync suppression
      programmaticSyncTimerRef.current = setTimeout(() => {
        isProgrammaticSyncRef.current = false;
        programmaticSyncTimerRef.current = null;
      }, 1200);
    },
    [videoRef, executePlay]
  );

  // Playback control API
  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void executePlay(video);
    onUserAction?.("play", video.currentTime || 0);
  }, [videoRef, executePlay, onUserAction]);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    onUserAction?.("pause", video.currentTime || 0);
  }, [videoRef, onUserAction]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      play();
    } else {
      pause();
    }
  }, [videoRef, play, pause]);

  const seek = useCallback(
    (targetSeconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(targetSeconds, duration || video.duration || targetSeconds));
      video.currentTime = clamped;
      setCurrentTime(clamped);
      onUserAction?.("seek", clamped);
    },
    [videoRef, duration, onUserAction]
  );

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      const target = (video.currentTime || 0) + delta;
      seek(target);
    },
    [videoRef, seek]
  );

  const unmute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setIsAutoplayMuted(false);
    updateDiagnostics({ isMuted: false, lastEvent: "user_unmuted" });
  }, [videoRef, updateDiagnostics]);

  const retry = useCallback(() => {
    if (streamUrl) {
      retryCountRef.current = 0;
      void initializeStreamPipeline(streamUrl);
    }
  }, [streamUrl, initializeStreamPipeline]);

  return {
    playerState,
    engine,
    detectedFormat,
    errorInfo,
    isAutoplayMuted,
    duration,
    currentTime,
    diagnostics,
    play,
    pause,
    togglePlayback,
    seek,
    seekBy,
    unmute,
    retry,
    applyRemotePlayback,
  };
}
