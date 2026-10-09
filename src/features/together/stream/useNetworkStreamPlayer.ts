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
  | "LOADING_MANIFEST"
  | "LOADING_MEDIA"
  | "BUFFERING"
  | "READY"
  | "PLAYING"
  | "PAUSED"
  | "RECONNECTING"
  | "ERROR";

export type PlaybackEngineType = "native" | "hlsjs" | "shaka" | "youtube" | "none";

export interface NetworkPlayerErrorInfo {
  stage: "validation" | "manifest" | "network" | "codec" | "cors" | "playback" | "unsupported";
  title: string;
  message: string;
  technicalDetails?: string;
  suggestedAction?: string;
  canRetry: boolean;
  httpStatus?: number;
  failedUrl?: string;
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
  bufferAhead: number;
  readyState: number;
  networkState: number;
  playbackRate: number;
  isPaused: boolean;
  isMuted: boolean;
  mediaErrorCode: number | null;
  lastEvent: string;
  lastEventTime: number;
  sanitizedUrl: string;
  hlsMetrics?: {
    mediaAttached: boolean;
    manifestLoaded: boolean;
    manifestParsed: boolean;
    levelsLoaded: number;
    currentLevel: number;
    fragsLoaded: number;
    fragsBuffered: number;
    bufferAppends: number;
  };
  lastError?: {
    event: string;
    stage: string;
    fatal: boolean;
    details: string;
    httpStatus?: number;
    retryCount: number;
    sanitizedUrl?: string;
    timestamp: number;
  };
}

export interface UseNetworkStreamPlayerOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  streamUrl: string | null;
  streamTitle?: string | null;
  fallbackUrl?: string | null;
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
  fallbackUrl,
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
    bufferAhead: 0,
    readyState: 0,
    networkState: 0,
    playbackRate: 1,
    isPaused: true,
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
  const isPlayingPromisePendingRef = useRef(false);
  const programmaticSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferingStallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDestroyingRef = useRef(false);
  const attemptedHlsFallbackRef = useRef(false);
  const attemptedDirectFallbackRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const retryCountRef = useRef(0);
  const fragErrorCountRef = useRef(0);
  const fallbackUrlRef = useRef<string | null>(null);
  const currentStreamUrlRef = useRef<string | null>(null);

  const hlsMetricsRef = useRef({
    mediaAttached: false,
    manifestLoaded: false,
    manifestParsed: false,
    levelsLoaded: 0,
    currentLevel: -1,
    fragsLoaded: 0,
    fragsBuffered: 0,
    bufferAppends: 0,
  });

  const engineRef = useRef<PlaybackEngineType>("none");
  engineRef.current = engine;

  const playerStateRef = useRef<NetworkPlayerState>("IDLE");
  playerStateRef.current = playerState;

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

  const clearStageTimeout = useCallback(() => {
    if (stageTimeoutRef.current) {
      clearTimeout(stageTimeoutRef.current);
      stageTimeoutRef.current = null;
    }
  }, []);

  const clearBufferingStallTimeout = useCallback(() => {
    if (bufferingStallTimeoutRef.current) {
      clearTimeout(bufferingStallTimeoutRef.current);
      bufferingStallTimeoutRef.current = null;
    }
  }, []);

  const reportError = useCallback(
    (err: NetworkPlayerErrorInfo) => {
      clearStageTimeout();
      clearBufferingStallTimeout();
      console.warn(
        `[NetworkStreamPlayer] Error reported (${err.stage}): ${err.title} - ${err.message}`,
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
    [clearStageTimeout, clearBufferingStallTimeout, onErrorChange, updateDiagnostics]
  );

  const clearError = useCallback(() => {
    setErrorInfo(null);
    onErrorChange?.(null);
  }, [onErrorChange]);

  const setStageTimeout = useCallback(
    (stageName: string, durationMs: number, onTimeout: () => void) => {
      clearStageTimeout();
      stageTimeoutRef.current = setTimeout(() => {
        stageTimeoutRef.current = null;
        console.warn(`[NetworkStreamPlayer] Timeout on stage: ${stageName} after ${durationMs}ms`);
        onTimeout();
      }, durationMs);
    },
    [clearStageTimeout]
  );

  // Clean up existing player instances and media elements
  const destroyCurrentEngines = useCallback(() => {
    isDestroyingRef.current = true;
    clearStageTimeout();
    clearBufferingStallTimeout();
    isPlayingPromisePendingRef.current = false;

    if (programmaticSyncTimerRef.current) {
      clearTimeout(programmaticSyncTimerRef.current);
      programmaticSyncTimerRef.current = null;
    }

    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
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
  }, [videoRef, clearStageTimeout, clearBufferingStallTimeout]);

  // Safe play helper handling autoplay policy restrictions and promise concurrency
  const executePlay = useCallback(
    async (video: HTMLVideoElement) => {
      if (isPlayingPromisePendingRef.current) return;
      isPlayingPromisePendingRef.current = true;
      try {
        await video.play();
      } catch (err: any) {
        if (err?.name === "NotAllowedError") {
          console.log(
            "[NetworkStreamPlayer] Autoplay unmuted blocked by browser policy; falling back to muted playback with tap-to-unmute"
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
          // Playback aborted by user pause or new source load; safe to ignore
        } else {
          console.warn("[NetworkStreamPlayer] Play error:", err?.name, err?.message);
        }
      } finally {
        isPlayingPromisePendingRef.current = false;
      }
    },
    [updateDiagnostics]
  );

  // Native HTML5 Video setup helper
  const setupNativePipeline = useCallback(
    (urlToLoad: string, currentGen: number) => {
      const video = videoRef.current;
      if (!video) return;

      setEngine("native");
      setPlayerState("LOADING_MEDIA");
      updateDiagnostics({
        engine: "native",
        playerState: "LOADING_MEDIA",
        lastEvent: "native:loading",
      });

      setStageTimeout("native_media", 15000, () => {
        if (currentGen !== loadGenerationRef.current) return;
        reportError({
          stage: "playback",
          title: "Direct Video Loading Timeout",
          message:
            "The direct video stream did not return playable data within 15 seconds. The server may be unresponsive or slow.",
          technicalDetails: `Timeout on ${sanitizeStreamUrlForLogging(urlToLoad)}`,
          suggestedAction:
            "Ensure the URL is accessible, publicly reachable, and points to a fast direct video file.",
          canRetry: true,
          failedUrl: sanitizeStreamUrlForLogging(urlToLoad),
        });
      });

      if (video.src !== urlToLoad) {
        video.src = urlToLoad;
        video.load();
      }
    },
    [videoRef, setStageTimeout, reportError, updateDiagnostics]
  );

  // Clean fallback from HLS to direct native video (destroys HLS instance first)
  const switchToNativeFallback = useCallback(
    (urlToLoad: string, currentGen: number) => {
      if (currentGen !== loadGenerationRef.current) return;
      console.log(
        "[NetworkStreamPlayer] Switching to direct native fallback:",
        sanitizeStreamUrlForLogging(urlToLoad)
      );
      attemptedDirectFallbackRef.current = true;
      clearStageTimeout();
      clearBufferingStallTimeout();

      // Cleanly destroy HLS instance before setting native video src
      if (hlsRef.current) {
        try {
          hlsRef.current.stopLoad();
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
        } catch {
          /* ignore */
        }
        hlsRef.current = null;
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

      setupNativePipeline(urlToLoad, currentGen);
    },
    [videoRef, clearStageTimeout, clearBufferingStallTimeout, setupNativePipeline]
  );

  // Bounded reconnection trigger with backoff and stage timeout (eliminates infinite RECONNECTING hang)
  const triggerReconnect = useCallback(
    (reason: string, currentGen: number) => {
      if (currentGen !== loadGenerationRef.current) return;

      if (retryCountRef.current < 2) {
        retryCountRef.current++;
        setPlayerState("RECONNECTING");
        updateDiagnostics({
          playerState: "RECONNECTING",
          lastEvent: `reconnecting:${reason}_${retryCountRef.current}`,
        });
        console.log(
          `[NetworkStreamPlayer] Reconnecting (${reason}, attempt ${retryCountRef.current})...`
        );

        // Bounded reconnection timeout (12s) - prevents indefinite hang in RECONNECTING!
        setStageTimeout("reconnecting", 12000, () => {
          if (currentGen !== loadGenerationRef.current) return;
          if (fallbackUrlRef.current && !attemptedDirectFallbackRef.current) {
            switchToNativeFallback(fallbackUrlRef.current, currentGen);
            return;
          }
          reportError({
            stage: "network",
            title: "Stream Reconnection Timed Out",
            message:
              "The player attempted to re-establish the connection to the media server, but received no response within 12 seconds.",
            technicalDetails: `Reconnection failed after ${retryCountRef.current} attempts (${reason}).`,
            suggestedAction:
              "Verify your network connection, ensure the stream is accessible, or click 'Retry Stream'.",
            canRetry: true,
          });
        });

        if (hlsRef.current) {
          try {
            if (reason === "media") {
              hlsRef.current.recoverMediaError();
            } else {
              hlsRef.current.startLoad();
            }
          } catch (e) {
            console.warn("[NetworkStreamPlayer] Reconnect trigger error:", e);
          }
        }
      } else {
        if (fallbackUrlRef.current && !attemptedDirectFallbackRef.current) {
          switchToNativeFallback(fallbackUrlRef.current, currentGen);
          return;
        }
        reportError({
          stage: "network",
          title: "Stream Connection Lost",
          message:
            "Multiple attempts to reconnect to the stream origin failed. The connection was lost or refused.",
          technicalDetails: `Retries exhausted (${reason}).`,
          suggestedAction:
            "Check that the media origin server is active and reachable, then click 'Retry Stream'.",
          canRetry: true,
        });
      }
    },
    [reportError, setStageTimeout, switchToNativeFallback, updateDiagnostics]
  );

  const startBufferingStallTimer = useCallback(() => {
    clearBufferingStallTimeout();
    bufferingStallTimeoutRef.current = setTimeout(() => {
      bufferingStallTimeoutRef.current = null;
      console.warn("[NetworkStreamPlayer] Playback stalled in BUFFERING for 15s without forward progress");
      triggerReconnect("buffer_stall", loadGenerationRef.current);
    }, 15000);
  }, [clearBufferingStallTimeout, triggerReconnect]);

  // Dedicated HLS pipeline helper with stage tracking, event instrumentation & stage timeouts
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
        setPlayerState("LOADING_MANIFEST");
        updateDiagnostics({
          engine: "hlsjs",
          playerState: "LOADING_MANIFEST",
          lastEvent: "hls:init",
        });

        hlsMetricsRef.current = {
          mediaAttached: false,
          manifestLoaded: false,
          manifestParsed: false,
          levelsLoaded: 0,
          currentLevel: -1,
          fragsLoaded: 0,
          fragsBuffered: 0,
          bufferAppends: 0,
        };

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          backBufferLength: 30,
          manifestLoadingTimeOut: 12000,
          manifestLoadingMaxRetry: 2,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 12000,
          levelLoadingMaxRetry: 2,
          levelLoadingRetryDelay: 1000,
          fragLoadingTimeOut: 15000,
          fragLoadingMaxRetry: 2,
          fragLoadingRetryDelay: 1000,
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          },
        });
        hlsRef.current = hls;

        // Stage 1 Timeout: Manifest Loading (12s)
        setStageTimeout("manifest", 12000, () => {
          if (currentGen !== loadGenerationRef.current) return;
          if (fallbackUrlRef.current && !attemptedDirectFallbackRef.current) {
            switchToNativeFallback(fallbackUrlRef.current, currentGen);
            return;
          }
          reportError({
            stage: "manifest",
            title: "HLS Manifest Request Timed Out",
            message:
              "The adaptive HLS manifest took over 12 seconds to respond. The media server may be offline, slow, or rejecting cross-origin requests.",
            technicalDetails: `Timeout on manifest URL: ${sanitizeStreamUrlForLogging(streamUrlToLoad)}`,
            suggestedAction:
              "Check that the stream origin is active, public, and allows CORS (Access-Control-Allow-Origin: *).",
            canRetry: true,
            failedUrl: sanitizeStreamUrlForLogging(streamUrlToLoad),
          });
        });

        // 1. MEDIA ATTACHED
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          if (currentGen !== loadGenerationRef.current) return;
          hlsMetricsRef.current.mediaAttached = true;
          updateDiagnostics({
            lastEvent: "hls:media_attached",
            hlsMetrics: { ...hlsMetricsRef.current },
          });
        });

        // 2. MANIFEST LOADING & LOADED
        hls.on(Hls.Events.MANIFEST_LOADING, () => {
          if (currentGen !== loadGenerationRef.current) return;
          setPlayerState("LOADING_MANIFEST");
          updateDiagnostics({
            playerState: "LOADING_MANIFEST",
            lastEvent: "hls:manifest_loading",
          });
        });

        hls.on(Hls.Events.MANIFEST_LOADED, (_evt, data) => {
          if (currentGen !== loadGenerationRef.current) return;
          hlsMetricsRef.current.manifestLoaded = true;
          hlsMetricsRef.current.levelsLoaded = data.levels?.length || 0;
          updateDiagnostics({
            lastEvent: "hls:manifest_loaded",
            hlsMetrics: { ...hlsMetricsRef.current },
          });
        });

        // 3. MANIFEST PARSED -> Transition to LOADING_MEDIA
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (currentGen !== loadGenerationRef.current) return;
          clearStageTimeout();
          clearError();
          hlsMetricsRef.current.manifestParsed = true;
          setPlayerState("LOADING_MEDIA");
          updateDiagnostics({
            playerState: "LOADING_MEDIA",
            lastEvent: "hls:manifest_parsed",
            hlsMetrics: { ...hlsMetricsRef.current },
          });

          // Stage 2 Timeout: Media Segments (15s)
          setStageTimeout("media", 15000, () => {
            if (currentGen !== loadGenerationRef.current) return;
            if (fallbackUrlRef.current && !attemptedDirectFallbackRef.current) {
              switchToNativeFallback(fallbackUrlRef.current, currentGen);
              return;
            }
            reportError({
              stage: "playback",
              title: "Media Segments Failed to Load",
              message:
                "The HLS manifest was parsed successfully, but video segments could not be fetched or appended to the media buffer within 15 seconds.",
              technicalDetails: `Timeout on media segments: ${sanitizeStreamUrlForLogging(streamUrlToLoad)}`,
              suggestedAction:
                "Ensure video segments are reachable, not blocked by CORS, and use standard H.264/AAC codecs.",
              canRetry: true,
              failedUrl: sanitizeStreamUrlForLogging(streamUrlToLoad),
            });
          });
        });

        // 4. LEVEL LOADED
        hls.on(Hls.Events.LEVEL_LOADED, (_evt, data) => {
          if (currentGen !== loadGenerationRef.current) return;
          hlsMetricsRef.current.currentLevel = data.level;
          updateDiagnostics({
            lastEvent: `hls:level_${data.level}_loaded`,
            hlsMetrics: { ...hlsMetricsRef.current },
          });
        });

        // 5. FRAG LOADING & LOADED
        hls.on(Hls.Events.FRAG_LOADING, () => {
          if (currentGen !== loadGenerationRef.current) return;
          updateDiagnostics({ lastEvent: "hls:frag_loading" });
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          if (currentGen !== loadGenerationRef.current) return;
          hlsMetricsRef.current.fragsLoaded++;
          fragErrorCountRef.current = 0;
          updateDiagnostics({
            lastEvent: "hls:frag_loaded",
            hlsMetrics: { ...hlsMetricsRef.current },
          });
        });

        // 6. BUFFER APPENDING & APPENDED
        hls.on(Hls.Events.BUFFER_APPENDING, () => {
          if (currentGen !== loadGenerationRef.current) return;
          updateDiagnostics({ lastEvent: "hls:buffer_appending" });
        });

        hls.on(Hls.Events.BUFFER_APPENDED, () => {
          if (currentGen !== loadGenerationRef.current) return;
          hlsMetricsRef.current.bufferAppends++;
          updateDiagnostics({
            lastEvent: "hls:buffer_appended",
            hlsMetrics: { ...hlsMetricsRef.current },
          });

          // Check if video has enough data to transition to READY
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            clearStageTimeout();
            setPlayerState((prev) =>
              prev === "LOADING_MEDIA" || prev === "LOADING_MANIFEST" || prev === "RECONNECTING"
                ? "READY"
                : prev
            );
            if (desiredPlaybackStateRef.current === "playing" && video.paused) {
              void executePlay(video);
            }
          }
        });

        // 7. FRAG BUFFERED
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (currentGen !== loadGenerationRef.current) return;
          clearStageTimeout();
          clearBufferingStallTimeout();
          hlsMetricsRef.current.fragsBuffered++;
          updateDiagnostics({
            lastEvent: "hls:frag_buffered",
            hlsMetrics: { ...hlsMetricsRef.current },
          });

          setPlayerState((prev) => {
            if (prev === "LOADING_MEDIA" || prev === "LOADING_MANIFEST" || prev === "RECONNECTING") {
              return "READY";
            }
            return prev;
          });

          if (desiredPlaybackStateRef.current === "playing" && video.paused) {
            void executePlay(video);
          }
        });

        // 8. ERROR HANDLING (Fatal and Non-Fatal)
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (currentGen !== loadGenerationRef.current) return;

          const httpStatus = data.response?.code || (data.networkDetails as any)?.status || 0;
          const errorUrl = data.context?.url || (data.frag as any)?.url || "";
          const sanitizedErrorUrl = sanitizeStreamUrlForLogging(errorUrl);

          console.warn(
            `[NetworkStreamPlayer] HLS error [${data.type}]: ${data.details}`,
            `fatal: ${data.fatal}`,
            `HTTP: ${httpStatus}`,
            `URL: ${sanitizedErrorUrl}`
          );

          updateDiagnostics({
            lastEvent: `hls:error:${data.details}`,
            lastError: {
              event: "Hls.Events.ERROR",
              stage: playerStateRef.current,
              fatal: Boolean(data.fatal),
              details: data.details,
              httpStatus,
              retryCount: retryCountRef.current,
              sanitizedUrl: sanitizedErrorUrl,
              timestamp: Date.now(),
            },
          });

          // HTTP 401 or 403: Authentication Required
          if (httpStatus === 401 || httpStatus === 403) {
            clearStageTimeout();
            reportError({
              stage: "manifest",
              title: `Authentication Failed (HTTP ${httpStatus})`,
              message:
                "The media server refused access to the HLS stream. An API key, token, or session authorization is required.",
              technicalDetails: `Server returned HTTP ${httpStatus} on ${sanitizedErrorUrl}`,
              suggestedAction:
                "Provide a stream URL with a valid API key (e.g. ?api_key=YOUR_KEY) or check user permissions on the media server.",
              canRetry: true,
              httpStatus,
              failedUrl: sanitizedErrorUrl,
            });
            return;
          }

          // HTTP 404: Not Found
          if (httpStatus === 404) {
            clearStageTimeout();
            reportError({
              stage: "manifest",
              title: "Stream Playlist or File Not Found (HTTP 404)",
              message: "The requested HLS playlist or video segment does not exist on the remote media server.",
              technicalDetails: `HTTP 404 on ${sanitizedErrorUrl}`,
              suggestedAction: "Verify that the item exists on the media server and the URL is spelled correctly.",
              canRetry: false,
              httpStatus,
              failedUrl: sanitizedErrorUrl,
            });
            return;
          }

          // Non-fatal fragment error accumulation
          if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
            fragErrorCountRef.current++;
            if (fragErrorCountRef.current >= 3) {
              clearStageTimeout();
              if (fallbackUrlRef.current && !attemptedDirectFallbackRef.current) {
                switchToNativeFallback(fallbackUrlRef.current, currentGen);
                return;
              }
              reportError({
                stage: "network",
                title: "Media Segment Download Failed",
                message:
                  "Multiple consecutive video segments failed to download. The connection to the media server was lost or blocked.",
                technicalDetails: `FRAG_LOAD_ERROR repeated ${fragErrorCountRef.current} times. Status: ${httpStatus}`,
                suggestedAction:
                  "Check server connectivity and CORS headers on video segment files (.ts / .m4s).",
                canRetry: true,
                httpStatus,
                failedUrl: sanitizedErrorUrl,
              });
              return;
            }
          }

          // Fatal HLS errors
          if (data.fatal) {
            clearStageTimeout();
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              if (httpStatus === 401 || httpStatus === 403) {
                reportError({
                  stage: "manifest",
                  title: `Authentication Failed (HTTP ${httpStatus})`,
                  message:
                    "The media server refused access to the HLS stream. An API key, token, or session authorization is required.",
                  technicalDetails: `Server returned HTTP ${httpStatus} on ${sanitizedErrorUrl}`,
                  suggestedAction:
                    "Provide a stream URL with a valid API key (e.g. ?api_key=YOUR_KEY) or check user permissions on the media server.",
                  canRetry: true,
                  httpStatus,
                  failedUrl: sanitizedErrorUrl,
                });
                return;
              }

              if (httpStatus === 404) {
                reportError({
                  stage: "manifest",
                  title: "Stream Playlist or File Not Found (HTTP 404)",
                  message: "The requested HLS playlist or video segment does not exist on the remote media server.",
                  technicalDetails: `HTTP 404 on ${sanitizedErrorUrl}`,
                  suggestedAction: "Verify that the item exists on the media server and the URL is spelled correctly.",
                  canRetry: false,
                  httpStatus,
                  failedUrl: sanitizedErrorUrl,
                });
                return;
              }

              triggerReconnect("network", currentGen);
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              triggerReconnect("media", currentGen);
            } else {
              reportError({
                stage: "manifest",
                title: "HLS Demuxing Failure",
                message: "An unrecoverable fatal error occurred while demuxing the HLS stream.",
                technicalDetails: `HLS Fatal Error: ${data.details}`,
                suggestedAction: "Ensure the stream uses standard H.264 video and AAC audio codecs.",
                canRetry: true,
                failedUrl: sanitizedErrorUrl,
              });
            }
          }
        });

        hls.attachMedia(video);
        hls.loadSource(streamUrlToLoad);
        return true;
      } else if (canPlayNativeHls) {
        // Native Safari / iOS HLS
        setEngine("native");
        setPlayerState("LOADING_MANIFEST");
        updateDiagnostics({ engine: "native", playerState: "LOADING_MANIFEST", lastEvent: "native_hls:load" });

        setStageTimeout("manifest", 12000, () => {
          if (currentGen !== loadGenerationRef.current) return;
          reportError({
            stage: "manifest",
            title: "Native HLS Stream Timed Out",
            message: "The stream did not respond within 12 seconds.",
            technicalDetails: `Timeout on ${sanitizeStreamUrlForLogging(streamUrlToLoad)}`,
            suggestedAction: "Verify the stream URL is active and accessible.",
            canRetry: true,
          });
        });

        video.src = streamUrlToLoad;
        video.load();
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
    [
      videoRef,
      clearStageTimeout,
      clearBufferingStallTimeout,
      clearError,
      executePlay,
      reportError,
      setStageTimeout,
      switchToNativeFallback,
      triggerReconnect,
      updateDiagnostics,
    ]
  );

  // Main stream pipeline initialization
  const initializeStreamPipeline = useCallback(
    async (url: string) => {
      const currentGen = ++loadGenerationRef.current;
      clearError();
      destroyCurrentEngines();
      attemptedHlsFallbackRef.current = false;
      attemptedDirectFallbackRef.current = false;
      retryCountRef.current = 0;
      fragErrorCountRef.current = 0;
      fallbackUrlRef.current = fallbackUrl || null;
      currentStreamUrlRef.current = url;

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
            failedUrl: sanitized,
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
            failedUrl: sanitized,
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
            failedUrl: sanitized,
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
            failedUrl: sanitized,
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
          failedUrl: sanitized,
        });
        return;
      }

      // Check if URL is YouTube
      if (validation.format === "youtube") {
        setEngine("youtube");
        setPlayerState("READY");
        updateDiagnostics({ engine: "youtube", playerState: "READY", lastEvent: "youtube:ready" });
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      const format = validation.format;

      // 2. MPEG-DASH (.mpd) pipeline
      if (format === "dash") {
        setEngine("shaka");
        setPlayerState("LOADING_MANIFEST");
        updateDiagnostics({ engine: "shaka", playerState: "LOADING_MANIFEST" });

        if (!isShakaSupported()) {
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

          setPlayerState("READY");
          updateDiagnostics({ playerState: "READY", lastEvent: "shaka:loaded" });

          if (desiredPlaybackStateRef.current === "playing") {
            void executePlay(video);
          }
          return;
        } catch (err: any) {
          if (currentGen !== loadGenerationRef.current) return;
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

      // 4. Native HTML5 Video pipeline (Direct MP4, WebM, OGG)
      setupNativePipeline(url, currentGen);
    },
    [
      fallbackUrl,
      clearError,
      destroyCurrentEngines,
      updateDiagnostics,
      reportError,
      videoRef,
      setupHlsPipeline,
      setupNativePipeline,
      executePlay,
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

  // Sync desired playback state with active video element (only when stream is READY or PLAYING)
  useEffect(() => {
    const video = videoRef.current;
    if (
      !video ||
      !streamUrl ||
      playerState === "ERROR" ||
      playerState === "VALIDATING" ||
      playerState === "LOADING_MANIFEST" ||
      playerState === "LOADING_MEDIA" ||
      playerState === "RECONNECTING"
    ) {
      return;
    }

    if (desiredPlaybackState === "playing") {
      if (video.paused && (playerState === "READY" || playerState === "PAUSED")) {
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
        readyState: video.readyState,
        networkState: video.networkState,
        lastEvent: "loadedmetadata",
      });
    };

    const onCanPlay = () => {
      clearStageTimeout();
      setPlayerState((prev) => {
        if (
          prev === "LOADING_MANIFEST" ||
          prev === "LOADING_MEDIA" ||
          prev === "VALIDATING" ||
          prev === "RECONNECTING"
        ) {
          return "READY";
        }
        return prev;
      });
      updateDiagnostics({
        readyState: video.readyState,
        lastEvent: "canplay",
      });
      if (desiredPlaybackStateRef.current === "playing" && video.paused) {
        void executePlay(video);
      }
    };

    const onPlaying = () => {
      clearStageTimeout();
      clearBufferingStallTimeout();
      setPlayerState("PLAYING");
      updateDiagnostics({
        playerState: "PLAYING",
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        lastEvent: "playing",
      });
      if (!isProgrammaticSyncRef.current) {
        onPlaybackStateChange?.("playing");
      }
    };

    const onPause = () => {
      if (isDestroyingRef.current) return;
      setPlayerState((prev) => {
        if (
          prev === "ERROR" ||
          prev === "LOADING_MANIFEST" ||
          prev === "LOADING_MEDIA" ||
          prev === "VALIDATING"
        ) {
          return prev;
        }
        return "PAUSED";
      });
      updateDiagnostics({
        playerState: "PAUSED",
        isPaused: true,
        lastEvent: "pause",
      });
      if (!isProgrammaticSyncRef.current) {
        onPlaybackStateChange?.("paused");
      }
    };

    const onWaiting = () => {
      // ONLY transition to BUFFERING if we were actually PLAYING or READY
      // Do NOT overwrite LOADING_MANIFEST, LOADING_MEDIA, VALIDATING, RECONNECTING, or ERROR
      setPlayerState((prev) => {
        if (prev === "PLAYING" || prev === "READY") {
          updateDiagnostics({
            playerState: "BUFFERING",
            readyState: video.readyState,
            lastEvent: "waiting",
          });
          startBufferingStallTimer();
          return "BUFFERING";
        }
        updateDiagnostics({
          readyState: video.readyState,
          lastEvent: "waiting",
        });
        return prev;
      });
    };

    const onStalled = () => {
      updateDiagnostics({
        networkState: video.networkState,
        lastEvent: "stalled",
      });
    };

    const onTimeUpdateNative = () => {
      const cur = Math.floor(video.currentTime || 0);
      const rawDur = video.duration;
      const dur = Number.isFinite(rawDur) && rawDur > 0 ? Math.floor(rawDur) : duration || 0;
      setCurrentTime(cur);

      let bufEnd = 0;
      if (video.buffered && video.buffered.length > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.currentTime >= video.buffered.start(i) && video.currentTime <= video.buffered.end(i)) {
            bufEnd = Math.floor(video.buffered.end(i));
            break;
          }
        }
        if (bufEnd === 0) {
          bufEnd = Math.floor(video.buffered.end(video.buffered.length - 1));
        }
      }

      const ahead = Math.max(0, bufEnd - cur);

      if (
        playerStateRef.current === "BUFFERING" &&
        !video.paused &&
        (ahead >= 0.5 || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
      ) {
        clearBufferingStallTimeout();
        setPlayerState("PLAYING");
      }

      updateDiagnostics({
        currentTime: cur,
        duration: dur,
        bufferedEnd: bufEnd,
        bufferAhead: ahead,
        readyState: video.readyState,
        networkState: video.networkState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });

      onTimeUpdate?.(cur, dur);
    };

    const onErrorNative = () => {
      const videoErr = video.error;
      console.warn("[NetworkStreamPlayer] Native HTML5 video error:", videoErr);

      if (!currentStreamUrlRef.current || isDestroyingRef.current) return;

      const code = videoErr?.code;
      updateDiagnostics({
        mediaErrorCode: code || null,
        readyState: video.readyState,
        networkState: video.networkState,
        lastEvent: "native:error",
      });

      clearStageTimeout();
      clearBufferingStallTimeout();

      if (code === 3) {
        // MEDIA_ERR_DECODE
        reportError({
          stage: "codec",
          title: "Audio/Video Codec Decode Error",
          message:
            "This video uses a codec (such as AC3/DTS audio, HEVC, or an MKV container) that web browsers cannot hardware-decode.",
          technicalDetails: "HTML5 Video error code: 3 (MEDIA_ERR_DECODE)",
          suggestedAction:
            "Play this video locally in VLC and click 'Share Screen' to stream your screen in 1080p with audio to your partner, or provide an MP4 stream.",
          canRetry: false,
        });
      } else if (code === 4) {
        // MEDIA_ERR_SRC_NOT_SUPPORTED
        if (
          Hls.isSupported() &&
          engineRef.current === "native" &&
          !attemptedHlsFallbackRef.current &&
          currentStreamUrlRef.current
        ) {
          attemptedHlsFallbackRef.current = true;
          console.log(
            "[NetworkStreamPlayer] Native source unsupported (error 4); attempting Hls.js fallback for stream"
          );
          if (video) {
            try {
              video.pause();
              video.removeAttribute("src");
              video.load();
            } catch {
              /* ignore */
            }
          }
          const ok = setupHlsPipeline(currentStreamUrlRef.current, loadGenerationRef.current);
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
        // MEDIA_ERR_ABORTED - normal during source switch
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
    video.addEventListener("stalled", onStalled);
    video.addEventListener("timeupdate", onTimeUpdateNative);
    video.addEventListener("error", onErrorNative);
    video.addEventListener("seeked", onSeeked);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
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
    duration,
    clearError,
    reportError,
    clearStageTimeout,
    clearBufferingStallTimeout,
    startBufferingStallTimer,
    updateDiagnostics,
    onPlaybackStateChange,
    onTimeUpdate,
    executePlay,
    setupHlsPipeline,
  ]);

  // Programmatic partner sync helper (avoids infinite echo broadcasts and preserves failing player state)
  const applyRemotePlayback = useCallback(
    (targetState: "playing" | "paused", targetPosition?: number) => {
      const video = videoRef.current;
      if (!video) return;

      // DO NOT overwrite a failing player state!
      if (playerStateRef.current === "ERROR") {
        console.log("[NetworkStreamPlayer] Remote sync ignored because player is in ERROR state");
        return;
      }

      isProgrammaticSyncRef.current = true;
      if (programmaticSyncTimerRef.current) {
        clearTimeout(programmaticSyncTimerRef.current);
        programmaticSyncTimerRef.current = null;
      }

      // If stream is still validating or loading, simply save desiredPlaybackState without calling play() prematurely
      if (
        playerStateRef.current === "VALIDATING" ||
        playerStateRef.current === "LOADING_MANIFEST" ||
        playerStateRef.current === "LOADING_MEDIA" ||
        playerStateRef.current === "RECONNECTING"
      ) {
        desiredPlaybackStateRef.current = targetState;
        programmaticSyncTimerRef.current = setTimeout(() => {
          isProgrammaticSyncRef.current = false;
          programmaticSyncTimerRef.current = null;
        }, 500);
        return;
      }

      if (typeof targetPosition === "number" && !isNaN(targetPosition) && video.readyState >= 1) {
        const drift = Math.abs(video.currentTime - targetPosition);
        const threshold = targetState === "paused" ? 1.0 : 2.5;
        if (drift > threshold) {
          video.currentTime = targetPosition;
        }
      }

      desiredPlaybackStateRef.current = targetState;

      if (targetState === "playing") {
        if (
          video.paused &&
          (playerStateRef.current === "READY" ||
            playerStateRef.current === "PAUSED" ||
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
        ) {
          void executePlay(video);
        }
      } else {
        if (!video.paused) {
          video.pause();
        }
      }

      programmaticSyncTimerRef.current = setTimeout(() => {
        isProgrammaticSyncRef.current = false;
        programmaticSyncTimerRef.current = null;
      }, 800);
    },
    [videoRef, executePlay]
  );

  // Playback control API
  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    desiredPlaybackStateRef.current = "playing";
    void executePlay(video);
    onUserAction?.("play", video.currentTime || 0);
  }, [videoRef, executePlay, onUserAction]);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    desiredPlaybackStateRef.current = "paused";
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
      const clamped = Math.max(
        0,
        Math.min(targetSeconds, duration || video.duration || targetSeconds)
      );
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
      fragErrorCountRef.current = 0;
      attemptedDirectFallbackRef.current = false;
      attemptedHlsFallbackRef.current = false;
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
