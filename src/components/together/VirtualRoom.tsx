"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { BRAND } from "@/lib/brand";
import {
  Play,
  Pause,
  Phone,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  ExternalLink,
  Tv,
  Sparkles,
  Clock,
  Share2,
  MessageSquare,
  Compass,
  Film,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Volume2,
  VolumeX,
  X,
  RotateCcw,
  RotateCw,
  PictureInPicture2,
  Radio,
  Lock,
  Unlock,
  ChevronLeft,
  Sliders,
  Smile,
  Bookmark,
  CheckCircle2,
  LogOut,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

import {
  endWatchSessionAction,
  finishWatchSessionAction,
  leaveWatchSessionAction,
  getWatchMessagesAction,
  joinWatchSessionAction,
  sendWatchMessageAction,
} from "@/actions/together";
import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";
import { createClient } from "@/lib/supabase/client";
import { getProvider } from "@/features/together/providers";
import {
  isBrowserScreenShareSupported,
  getProviderTechnicalCapability,
  getDeviceCapabilities,
} from "@/features/together/providers/capabilities";
import {
  useTheaterWebRTC,
} from "@/features/together/webrtc/useTheaterWebRTC";
import { WebRTCDiagnosticInspector } from "@/components/together/WebRTCDiagnosticInspector";

type Reaction = { id: string; emoji: string; x: number; y: number };
type WatchMsg = {
  id: string;
  content: string;
  userId: string;
  playbackPosition?: number | null;
  createdAt?: string;
};

const THEATER_REACTIONS = ["❤️", "😂", "🔥", "😱", "👏", "🍿"] as const;

export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const str = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const regex of patterns) {
    const match = str.match(regex);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function VirtualRoom({
  sessionId,
  userId,
  partnerId,
  coupleId,
  providerName = "JioHotstar",
  title,
  posterUrl,
  isHost = true,
  initialHostStreamActive = false,
  initialPlaybackState = "idle",
  initialPosition = 0,
  theme = "rose-dusk",
}: {
  sessionId: string;
  userId: string;
  partnerId?: string;
  coupleId?: string;
  providerName?: string;
  title: string;
  posterUrl?: string | null;
  isHost?: boolean;
  initialHostStreamActive?: boolean;
  initialPlaybackState?: string;
  initialPosition?: number;
  theme?: string;
  decor?: Record<string, unknown>;
}) {
  const router = useRouter();
  const cinemaContainerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteMovieAudioRef = useRef<HTMLAudioElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Diagnostic modal state
  const [showDiagModal, setShowDiagModal] = useState(false);

  // Device & browser capabilities
  const deviceCaps = useMemo(() => getDeviceCapabilities(), []);
  const canShareScreen = useMemo(() => isBrowserScreenShareSupported(), []);

  // Provider & technical capability
  const provider = useMemo(() => {
    return getProvider(providerName.toLowerCase()) || getProvider("jiohotstar");
  }, [providerName]);

  const capabilities = useMemo(() => {
    return getProviderTechnicalCapability(providerName);
  }, [providerName]);

  // WebRTC & Streaming Engine
  const {
    roomState,
    localStream,
    remoteStream,
    voiceActive,
    micMuted,
    partnerVoiceActive,
    partnerPresence,
    streamSourceType,
    errorMessage,
    webrtcDiagStats,
    partnerDiagStats,
    webrtcDiagStatsRef,
    updateState,
    startScreenShare,
    stopScreenShare,
    startVoiceCall,
    stopVoiceCall,
    toggleMic,
    remoteVoiceAudioRef,
    notifyPartnerLeaving,
    sendViewerReady,
    forceRelay,
    toggleForceRelay,
  } = useTheaterWebRTC({
    sessionId,
    userId,
    isHost,
    initialHostStreamActive,
    isDiagOpen: showDiagModal,
  });

  // Real-time track dimension state for host preview (updates immediately on resize event)
  const [hostCaptureDimensions, setHostCaptureDimensions] = useState<{ width: number; height: number } | null>(null);

  // Theater Session & Playback States
  const [playbackState, setPlaybackState] = useState<"playing" | "paused">(() => {
    return initialPlaybackState === "paused" ? "paused" : "playing";
  });
  const [positionSeconds, setPositionSeconds] = useState(initialPosition);
  const [stampTimestamp, setStampTimestamp] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [partnerCompletedNotice, setPartnerCompletedNotice] = useState<{ completedBy?: string } | null>(null);
  const [isAutoplayMuted, setIsAutoplayMuted] = useState(false);
  const isAutoplayMutedRef = useRef(isAutoplayMuted);
  isAutoplayMutedRef.current = isAutoplayMuted;
  const [userSwitchedToCompanion, setUserSwitchedToCompanion] = useState(false);

  // Playback active state & DRM black screen detection
  const [isVideoActuallyPlaying, setIsVideoActuallyPlaying] = useState(false);
  const [isMediaRendering, setIsMediaRendering] = useState(false);
  const [isDrmBlackScreenDetected, setIsDrmBlackScreenDetected] = useState(false);
  const [partnerDrmReported, setPartnerDrmReported] = useState(false);

  // Direct Synchronized Movie Player states (open-source / web video fallback)
  const [directMediaUrl, setDirectMediaUrl] = useState<string | null>(null);
  const [directMediaTitle, setDirectMediaTitle] = useState<string | null>(null);
  const [showDirectMediaModal, setShowDirectMediaModal] = useState(false);
  const [directMediaInput, setDirectMediaInput] = useState("");
  const directVideoRef = useRef<HTMLVideoElement>(null);

  // OTT Mobile & Cinema Player States
  const [estimatedDuration, setEstimatedDuration] = useState(7200);
  const [showControls, setShowControls] = useState(true);
  const [isImmersiveTheater, setIsImmersiveTheater] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [skipRipple, setSkipRipple] = useState<{ direction: "left" | "right"; id: number } | null>(null);
  const [playPausePulse, setPlayPausePulse] = useState<"playing" | "paused" | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [showLockPrompt, setShowLockPrompt] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showRotateCue, setShowRotateCue] = useState(false);
  const rotateCueTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== "undefined") {
        const landscape = window.innerWidth > window.innerHeight && window.innerWidth < 1024;
        setIsLandscape(landscape);
        if (landscape) {
          setShowRotateCue(false);
          if (rotateCueTimeoutRef.current) {
            window.clearTimeout(rotateCueTimeoutRef.current);
            rotateCueTimeoutRef.current = null;
          }
        }
      }
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
      if (rotateCueTimeoutRef.current) window.clearTimeout(rotateCueTimeoutRef.current);
    };
  }, []);

  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Chat & Reactions
  const [messages, setMessages] = useState<WatchMsg[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const reactionTimersRef = useRef<number[]>([]);
  const positionTimerRef = useRef<number | null>(null);

  // Default cinematic backdrop if no poster provided
  const backdrop =
    posterUrl ||
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600&auto=format&fit=crop&q=80";

  // Join session participant record & load initial chat
  useEffect(() => {
    void joinWatchSessionAction(sessionId);
    void getWatchMessagesAction(sessionId).then((res) => {
      if (res.ok) setMessages(res.data);
    });
  }, [sessionId]);

  // Attach local media stream to local video element (Host - visual preview only, permanently muted)
  // and attach real-time resize listener to immediately reflect host window minimize/maximize
  useEffect(() => {
    const video = localVideoRef.current;
    if (!video || !localStream) {
      setHostCaptureDimensions(null);
      return;
    }

    video.srcObject = localStream;
    video.muted = true;
    video.defaultMuted = true;
    void video.play().catch(() => {});

    const updateDimensions = () => {
      const vTrack = localStream.getVideoTracks()[0];
      const settings = typeof vTrack?.getSettings === "function" ? vTrack.getSettings() : undefined;
      const width = (video.videoWidth > 0 ? video.videoWidth : settings?.width) || 0;
      const height = (video.videoHeight > 0 ? video.videoHeight : settings?.height) || 0;
      if (width > 0 && height > 0) {
        setHostCaptureDimensions({ width, height });
        if (webrtcDiagStatsRef?.current?.localVideoTrack) {
          webrtcDiagStatsRef.current.localVideoTrack.settings = {
            ...webrtcDiagStatsRef.current.localVideoTrack.settings,
            width,
            height,
          };
        }
      }
    };

    updateDimensions();

    video.addEventListener("resize", updateDimensions);
    video.addEventListener("loadedmetadata", updateDimensions);

    const handleEnded = () => setHostCaptureDimensions(null);
    const vTrack = localStream.getVideoTracks()[0];
    if (vTrack) {
      vTrack.addEventListener?.("ended", handleEnded);
      vTrack.addEventListener?.("mute", updateDimensions);
      vTrack.addEventListener?.("unmute", updateDimensions);
    }

    return () => {
      video.removeEventListener("resize", updateDimensions);
      video.removeEventListener("loadedmetadata", updateDimensions);
      if (vTrack) {
        vTrack.removeEventListener?.("ended", handleEnded);
        vTrack.removeEventListener?.("mute", updateDimensions);
        vTrack.removeEventListener?.("unmute", updateDimensions);
      }
    };
  }, [localStream, webrtcDiagStatsRef, isHost]);

  // Attach remote media stream to remote video element (Viewer) with robust autoplay mitigation.
  // Video element is kept PERMANENTLY muted so that mobile Safari and Android Chrome NEVER block
  // video rendering or pause the stream due to audio policies.
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;

    if (remoteStream) {
      // Configure critical attributes BEFORE assigning srcObject
      videoEl.playsInline = true;
      videoEl.defaultMuted = true;
      videoEl.muted = true;
      videoEl.setAttribute("playsinline", "true");
      videoEl.setAttribute("webkit-playsinline", "true");
      videoEl.setAttribute("x5-playsinline", "true");

      if (videoEl.srcObject !== remoteStream) {
        videoEl.srcObject = remoteStream;
      }

      const updateRenderingState = () => {
        const hasDimensions = videoEl.videoWidth > 0 && videoEl.videoHeight > 0;
        const isPlaying = !videoEl.paused;
        if (hasDimensions && isPlaying) {
          setIsMediaRendering(true);
          setIsVideoActuallyPlaying(true);
        }
      };

      const tryPlay = async () => {
        try {
          videoEl.muted = true;
          await videoEl.play();
          updateRenderingState();
        } catch (err) {
          console.warn("[VirtualRoom] Video play() attempt:", err);
          setIsVideoActuallyPlaying(false);
          setIsMediaRendering(false);
        }
      };

      const onTrackUnmute = () => {
        console.log("[VirtualRoom] Remote video track unmuted, initiating playback");
        void tryPlay();
      };

      const newVideoTrack = remoteStream.getVideoTracks()[0];
      if (newVideoTrack) {
        newVideoTrack.addEventListener("unmute", onTrackUnmute);
      }

      const onPlaying = () => {
        updateRenderingState();
      };
      const onPause = () => {
        setIsVideoActuallyPlaying(false);
        setIsMediaRendering(false);
      };
      const onCanPlay = () => {
        if (videoEl.paused) void tryPlay();
        updateRenderingState();
      };
      const onLoadedMetadata = () => {
        updateRenderingState();
        if (videoEl.paused) void tryPlay();
      };
      const onResize = () => {
        updateRenderingState();
      };

      videoEl.addEventListener("playing", onPlaying);
      videoEl.addEventListener("pause", onPause);
      videoEl.addEventListener("canplay", onCanPlay);
      videoEl.addEventListener("loadedmetadata", onLoadedMetadata);
      videoEl.addEventListener("loadeddata", onLoadedMetadata);
      videoEl.addEventListener("resize", onResize);

      // Fast detection via requestVideoFrameCallback on supported mobile browsers (terminates once first frame rendered)
      let rVfcId: number | null = null;
      if ("requestVideoFrameCallback" in videoEl) {
        const onFrame = () => {
          updateRenderingState();
          // Stop scheduling once dimensions and playback are confirmed to prevent 60 Hz main-thread load
          const hasDimensions = videoEl.videoWidth > 0 && videoEl.videoHeight > 0;
          const isPlaying = !videoEl.paused;
          if (videoEl && (!hasDimensions || !isPlaying)) {
            rVfcId = (videoEl as any).requestVideoFrameCallback(onFrame);
          }
        };
        rVfcId = (videoEl as any).requestVideoFrameCallback(onFrame);
      }

      void tryPlay();

      return () => {
        if (newVideoTrack) {
          newVideoTrack.removeEventListener("unmute", onTrackUnmute);
        }
        if (rVfcId !== null && "cancelVideoFrameCallback" in videoEl) {
          (videoEl as any).cancelVideoFrameCallback(rVfcId);
        }
        videoEl.removeEventListener("playing", onPlaying);
        videoEl.removeEventListener("pause", onPause);
        videoEl.removeEventListener("canplay", onCanPlay);
        videoEl.removeEventListener("loadedmetadata", onLoadedMetadata);
        videoEl.removeEventListener("loadeddata", onLoadedMetadata);
        videoEl.removeEventListener("resize", onResize);
      };
    } else {
      videoEl.srcObject = null;
      setIsVideoActuallyPlaying(false);
      setIsMediaRendering(false);
    }
  }, [remoteStream]);

  // Dedicated movie audio element for remote stream.
  // Mobile browsers permit muted video autoplay unconditionally, but restrict unmuted audio autoplay.
  // By permanently keeping remoteVideoRef muted and directing audio tracks to remoteMovieAudioRef,
  // video rendering is never blocked, paused, or reset by audio permission state changes.
  useEffect(() => {
    const audioEl = remoteMovieAudioRef.current;
    if (!audioEl || !remoteStream) return;

    if (audioEl.srcObject !== remoteStream) {
      audioEl.srcObject = remoteStream;
    }

    const hasAudio = remoteStream.getAudioTracks().length > 0;
    if (hasAudio) {
      audioEl.play().then(() => {
        setIsAutoplayMuted(false);
      }).catch((err) => {
        console.log("[VirtualRoom] Movie audio autoplay deferred pending gesture:", err?.name);
        setIsAutoplayMuted(true);
      });
    } else {
      setIsAutoplayMuted(false);
    }
  }, [remoteStream]);

  // Sync mute state to remoteMovieAudioRef (leaving remoteVideoRef permanently muted)
  useEffect(() => {
    const audioEl = remoteMovieAudioRef.current;
    if (!audioEl) return;
    audioEl.muted = isVideoMuted || isAutoplayMuted;
  }, [isVideoMuted, isAutoplayMuted]);

  const handleUnmuteRemote = useCallback(() => {
    const audioEl = remoteMovieAudioRef.current;
    if (audioEl) {
      audioEl.muted = false;
      setIsAutoplayMuted(false);
      setIsVideoMuted(false);
      void audioEl.play().catch((err) => {
        console.warn("[VirtualRoom] User gesture movie audio unmute failed:", err);
      });
    }
    // Verify remote video is playing smoothly
    if (remoteVideoRef.current && remoteVideoRef.current.paused) {
      void remoteVideoRef.current.play().catch(() => {});
    }
  }, []);

  // Local clock runner for movie time
  useEffect(() => {
    if (playbackState === "playing") {
      positionTimerRef.current = window.setInterval(() => {
        setPositionSeconds((p) => p + 1);
      }, 1000);
    } else if (positionTimerRef.current) {
      clearInterval(positionTimerRef.current);
    }
    return () => {
      if (positionTimerRef.current) clearInterval(positionTimerRef.current);
    };
  }, [playbackState]);

  // Auto-hiding OTT player controls timer (3.5s inactivity)
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    if (playbackState === "playing") {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  }, [playbackState]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
  }, [playbackState, resetControlsTimer]);

  // OTT Seek & Scrubber controls
  const seekToPosition = useCallback((newPos: number) => {
    const clamped = Math.max(0, Math.min(newPos, estimatedDuration));
    setPositionSeconds(clamped);
    if (directVideoRef.current) {
      directVideoRef.current.currentTime = clamped;
    }
    void channelRef.current?.send({
      type: "broadcast",
      event: "theater:playback",
      payload: { userId, state: playbackState, position: clamped },
    });
  }, [estimatedDuration, playbackState, userId]);

  const seekBy = useCallback((delta: number) => {
    setPositionSeconds((prev) => {
      const next = Math.max(0, Math.min(prev + delta, estimatedDuration));
      if (directVideoRef.current) {
        directVideoRef.current.currentTime = next;
      }
      void channelRef.current?.send({
        type: "broadcast",
        event: "theater:playback",
        payload: { userId, state: playbackState, position: next },
      });
      return next;
    });
  }, [estimatedDuration, playbackState, userId]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  const togglePlayback = useCallback(() => {
    const next = playbackState === "playing" ? "paused" : "playing";
    setPlaybackState(next);
    setPlayPausePulse(next);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPlayPausePulse(null), 800);
    if (directVideoRef.current) {
      if (next === "playing") {
        void directVideoRef.current.play().catch(() => {});
      } else {
        directVideoRef.current.pause();
      }
    }
    void channelRef.current?.send({
      type: "broadcast",
      event: "theater:playback",
      payload: { userId, state: next, position: positionSeconds },
    });
  }, [playbackState, positionSeconds, userId]);

  const toggleVideoMute = useCallback(() => {
    const video = isHost ? localVideoRef.current : remoteVideoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsVideoMuted(video.muted);
    }
  }, [isHost]);

  // OTT Picture-in-Picture
  const togglePiP = useCallback(async () => {
    const video = isHost ? localVideoRef.current : remoteVideoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.warn("[VirtualRoom] PiP failed:", err);
    }
  }, [isHost]);

  // Cinema Mode & Fullscreen Controls
  const enterCinemaMode = useCallback(() => {
    setIsImmersiveTheater(true);
    setIsFullscreen(true);

    if (cinemaContainerRef.current && "requestFullscreen" in cinemaContainerRef.current) {
      cinemaContainerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          // Graceful fallback to CSS 100dvh viewport
          setIsImmersiveTheater(true);
        });
    }

    // Temporary visual cue helper for portrait mobile devices
    const triggerRotateCue = () => {
      if (!isLandscape) {
        setShowRotateCue(true);
        if (rotateCueTimeoutRef.current) {
          window.clearTimeout(rotateCueTimeoutRef.current);
        }
        rotateCueTimeoutRef.current = window.setTimeout(() => {
          setShowRotateCue(false);
        }, 3500);
      }
    };

    if (
      typeof screen !== "undefined" &&
      "orientation" in screen &&
      screen.orientation &&
      "lock" in screen.orientation
    ) {
      try {
        void (screen.orientation as any)
          .lock("landscape")
          .catch(() => {
            triggerRotateCue();
          });
      } catch {
        triggerRotateCue();
      }
    } else {
      triggerRotateCue();
    }
  }, [isLandscape]);

  const exitCinemaMode = useCallback(() => {
    setIsImmersiveTheater(false);
    setIsFullscreen(false);
    setShowRotateCue(false);
    if (rotateCueTimeoutRef.current) {
      window.clearTimeout(rotateCueTimeoutRef.current);
      rotateCueTimeoutRef.current = null;
    }

    if (typeof document !== "undefined" && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }

    if (
      typeof screen !== "undefined" &&
      "orientation" in screen &&
      screen.orientation &&
      "unlock" in screen.orientation
    ) {
      try {
        screen.orientation.unlock();
      } catch {
        /* orientation unlock not supported */
      }
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const isCurrentlyFullscreen = isFullscreen || isImmersiveTheater;
    if (isCurrentlyFullscreen) {
      exitCinemaMode();
    } else {
      enterCinemaMode();
    }
  }, [enterCinemaMode, exitCinemaMode, isFullscreen, isImmersiveTheater]);

  // OTT Gesture & Double-Tap detection
  const handleVideoAreaInteraction = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (isScreenLocked) {
        setShowLockPrompt(true);
        setTimeout(() => setShowLockPrompt(false), 2500);
        return;
      }

      const now = Date.now();
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ("touches" in e) {
        if (e.touches.length > 1) return;
        clientX = e.touches[0]?.clientX ?? 0;
        clientY = e.touches[0]?.clientY ?? 0;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const relativeX = (clientX - rect.left) / rect.width;
      const lastTap = lastTapRef.current;

      if (
        lastTap &&
        now - lastTap.time < 350 &&
        Math.abs(clientX - lastTap.x) < 60 &&
        Math.abs(clientY - lastTap.y) < 60
      ) {
        // Double-tap recognized!
        lastTapRef.current = null;
        if (capabilities.canPlaybackControl) {
          if (relativeX < 0.35) {
            seekBy(-10);
            setSkipRipple({ direction: "left", id: now });
            setTimeout(() => setSkipRipple((s) => (s?.id === now ? null : s)), 750);
          } else if (relativeX > 0.65) {
            seekBy(10);
            setSkipRipple({ direction: "right", id: now });
            setTimeout(() => setSkipRipple((s) => (s?.id === now ? null : s)), 750);
          } else {
            togglePlayback();
          }
        } else {
          // Truthful mobile OTT: double tap left toggles audio mute, double tap right toggles cinema mode
          if (relativeX < 0.5) {
            toggleVideoMute();
          } else {
            toggleFullscreen();
          }
        }
      } else {
        lastTapRef.current = { time: now, x: clientX, y: clientY };
        if (!isHost) {
          if (remoteVideoRef.current && remoteVideoRef.current.paused) {
            void remoteVideoRef.current.play().catch(() => {});
          }
          if (isAutoplayMuted) {
            handleUnmuteRemote();
          }
        }
        setShowControls((prev) => !prev);
        resetControlsTimer();
      }
    },
    [capabilities.canPlaybackControl, handleUnmuteRemote, isAutoplayMuted, isHost, isScreenLocked, resetControlsTimer, seekBy, toggleFullscreen, togglePlayback, toggleVideoMute]
  );

  const formatSeconds = useCallback((sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }, []);

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Realtime channel for chat & emoji reactions
  useEffect(() => {
    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const topic = `room-chat:${sessionId}`;
    const channel = supabase
      .channel(topic, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "theater:reaction" }, ({ payload }: { payload: any }) => {
        if (payload.userId === userId) return;
        applyReaction(payload.emoji);
      })
      .on("broadcast", { event: "theater:playback" }, ({ payload }: { payload: any }) => {
        if (payload.userId === userId) return;
        if (payload.state) {
          setPlaybackState(payload.state);
          if (directVideoRef.current) {
            if (payload.state === "playing") {
              void directVideoRef.current.play().catch(() => {});
            } else {
              directVideoRef.current.pause();
            }
          }
        }
        if (typeof payload.position === "number") {
          setPositionSeconds(payload.position);
          if (directVideoRef.current && Math.abs(directVideoRef.current.currentTime - payload.position) > 2) {
            directVideoRef.current.currentTime = payload.position;
          }
        }
      })
      .on("broadcast", { event: "theater:drm-detected" }, ({ payload }: { payload: any }) => {
        setPartnerDrmReported(Boolean(payload?.isBlack));
      })
      .on("broadcast", { event: "theater:direct-media" }, ({ payload }: { payload: any }) => {
        if (payload?.url) {
          setDirectMediaUrl(payload.url);
          setDirectMediaTitle(payload.title || "Shared Movie");
          if (payload.duration) setEstimatedDuration(payload.duration);
        } else {
          setDirectMediaUrl(null);
          setDirectMediaTitle(null);
        }
      })
      .on("broadcast", { event: "theater:message" }, ({ payload }: { payload: any }) => {
        if (!payload || payload.userId === userId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
        if (!chatOpen) {
          setUnreadCount((c) => c + 1);
        }
      })
      .on("broadcast", { event: "theater:session_completed" }, ({ payload }: { payload: any }) => {
        setPartnerCompletedNotice({ completedBy: payload?.userId || "partner" });
        setTimeout(() => {
          window.location.assign("/together");
        }, 2500);
      })
      .on("broadcast", { event: "theater:partner_leave" }, () => {
        // Partner left room; stay alive without completing session
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "watch_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const row = payload.new as {
            id: string;
            content: string;
            user_id: string;
            playback_position?: number | null;
            created_at: string;
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                content: row.content,
                userId: row.user_id,
                playbackPosition: row.playback_position,
                createdAt: row.created_at,
              },
            ];
          });
          if (row.user_id !== userId && !chatOpen) {
            setUnreadCount((c) => c + 1);
          }
        },
      );

    channelRef.current = channel;

    const applyReaction = (emoji: string) => {
      const r: Reaction = {
        id: Math.random().toString(36),
        emoji,
        x: 15 + Math.random() * 70,
        y: 60 + Math.random() * 25,
      };
      setReactions((prev) => [...prev, r]);
      reactionTimersRef.current.push(
        window.setTimeout(() => {
          setReactions((prev) => prev.filter((x) => x.id !== r.id));
        }, 2500),
      );
    };

    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed || !auth.ok) return;
      channel.subscribe();
    });

    const timers = reactionTimersRef;
    return () => {
      disposed = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [chatOpen, sessionId, userId]);

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active && !isImmersiveTheater) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [isImmersiveTheater]);

  const lastReactionTimeRef = useRef<number>(0);
  const broadcastReaction = (emoji: string) => {
    const now = Date.now();
    if (now - lastReactionTimeRef.current < 350) {
      return;
    }
    lastReactionTimeRef.current = now;

    const r: Reaction = {
      id: Math.random().toString(36),
      emoji,
      x: 20 + Math.random() * 60,
      y: 65 + Math.random() * 20,
    };
    setReactions((prev) => [...prev, r]);
    reactionTimersRef.current.push(
      window.setTimeout(() => {
        setReactions((prev) => prev.filter((x) => x.id !== r.id));
      }, 2500),
    );
    void channelRef.current?.send({
      type: "broadcast",
      event: "theater:reaction",
      payload: { userId, emoji },
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content) return;
    setNewMessage("");

    const pos = stampTimestamp ? positionSeconds : null;
    const tempId = `wm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const msg: WatchMsg = {
      id: tempId,
      content,
      userId,
      playbackPosition: pos,
      createdAt: new Date().toISOString(),
    };

    // 1. Immediate optimistic update locally
    setMessages((prev) => [...prev, msg]);

    // 2. Realtime broadcast directly to partner over websocket
    void channelRef.current?.send({
      type: "broadcast",
      event: "theater:message",
      payload: msg,
    });

    // 3. Persist to database in background
    void sendWatchMessageAction({
      sessionId,
      content,
      playbackPosition: pos,
    }).then((res) => {
      if (res.ok && res.data.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, id: res.data.id } : m)),
        );
      }
    });
  };

  const providerSearchUrl = useMemo(() => {
    const cleanTitle = encodeURIComponent(title);
    const id = providerName.toLowerCase();
    if (id.includes("hotstar")) return `https://www.hotstar.com/in/search?q=${cleanTitle}`;
    if (id.includes("netflix")) return `https://www.netflix.com/search?q=${cleanTitle}`;
    if (id.includes("prime"))
      return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${cleanTitle}`;
    if (id.includes("disney")) return `https://www.disneyplus.com/search?q=${cleanTitle}`;
    if (id.includes("apple")) return `https://tv.apple.com/search?term=${cleanTitle}`;
    if (id.includes("sonyliv")) return `https://www.sonyliv.com/search/${cleanTitle}`;
    if (id.includes("zee5")) return `https://www.zee5.com/search?q=${cleanTitle}`;
    if (id.includes("crunchyroll")) return `https://www.crunchyroll.com/search?q=${cleanTitle}`;
    return `https://www.youtube.com/results?search_query=${cleanTitle}`;
  }, [providerName, title]);

  const nativeAppDeepLink = useMemo(() => {
    const cleanTitle = encodeURIComponent(title);
    const id = providerName.toLowerCase();
    if (id.includes("hotstar")) return `hotstar://search?q=${cleanTitle}`;
    if (id.includes("netflix")) return `netflix://search?q=${cleanTitle}`;
    if (id.includes("prime")) return `primevideo://search?phrase=${cleanTitle}`;
    if (id.includes("disney")) return `disneyplus://search?q=${cleanTitle}`;
    if (id.includes("youtube")) return `vnd.youtube://results?q=${cleanTitle}`;
    return providerSearchUrl;
  }, [providerName, title, providerSearchUrl]);

  const formattedTime = useMemo(() => {
    const hrs = Math.floor(positionSeconds / 3600);
    const mins = Math.floor((positionSeconds % 3600) / 60);
    const secs = positionSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }, [positionSeconds]);

  const formatMsgTime = (seconds?: number | null) => {
    if (typeof seconds !== "number") return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const cleanupMediaAndFullscreen = () => {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      try {
        void document.exitFullscreen().catch(() => {});
      } catch {
        /* ignore */
      }
    }

    try {
      stopScreenShare();
      stopVoiceCall();
    } catch {
      /* ignore */
    }

    try {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      /* ignore */
    }
  };

  const handleLeaveSession = () => {
    // Immediate, reliable exit to /together for both mobile and desktop
    cleanupMediaAndFullscreen();
    try {
      void notifyPartnerLeaving();
    } catch {
      /* ignore */
    }
    try {
      void leaveWatchSessionAction(sessionId, positionSeconds);
    } catch {
      /* ignore */
    }
    window.location.assign("/together");
  };

  const handleResumeLater = async () => {
    if (isSubmittingCompletion) return;
    setIsSubmittingCompletion(true);

    try {
      await notifyPartnerLeaving();
    } catch {
      /* ignore */
    }
    try {
      void channelRef.current?.send({
        type: "broadcast",
        event: "theater:partner_leave",
        payload: { senderUserId: userId },
      });
    } catch {
      /* ignore */
    }

    cleanupMediaAndFullscreen();

    try {
      await leaveWatchSessionAction(sessionId, positionSeconds);
    } catch (err) {
      console.error("[VirtualRoom] leaveWatchSessionAction error:", err);
    }

    window.location.assign("/together");
  };

  const handleConfirmFinished = async () => {
    if (isSubmittingCompletion) return;
    setIsSubmittingCompletion(true);

    try {
      await notifyPartnerLeaving();
    } catch {
      /* ignore */
    }
    try {
      void channelRef.current?.send({
        type: "broadcast",
        event: "theater:session_completed",
        payload: { userId },
      });
    } catch {
      /* ignore */
    }

    cleanupMediaAndFullscreen();

    let destination = "/together";
    try {
      const res = await finishWatchSessionAction(sessionId, positionSeconds);
      if (res.ok) {
        destination = `/together/memory/${sessionId}`;
      }
    } catch (err) {
      console.error("[VirtualRoom] finishWatchSessionAction error:", err);
    }

    window.location.assign(destination);
  };

  // Authoritative host capture state: genuine presence of live, enabled video track
  const isHostCapturing =
    isHost &&
    !!localStream &&
    localStream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled);

  // Authoritative active video stream presence for the cinema stage
  const hasActiveStream = isHost
    ? isHostCapturing
    : !!remoteStream &&
      remoteStream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled);

  // Effective host source resolution: combines immediate element resize detection with WebRTC diagnostic stats
  const sourceWidth = hostCaptureDimensions?.width ?? webrtcDiagStats?.localVideoTrack?.settings?.width;
  const sourceHeight = hostCaptureDimensions?.height ?? webrtcDiagStats?.localVideoTrack?.settings?.height;
  const isSourceResolutionLow = Boolean(
    isHost &&
    isHostCapturing &&
    !directMediaUrl &&
    typeof sourceWidth === "number" &&
    sourceWidth > 0 &&
    sourceWidth < 1280
  );

  // DRM Black Screen Detector for PC screen sharing Hotstar/Netflix
  // Strictly restricted to Host: running getImageData canvas polling on mobile hardware-decoded remote video
  // triggers synchronous GPU-to-CPU texture readbacks from MediaCodec, causing main-thread stutter.
  // The Viewer receives theater:drm-detected via Realtime broadcast from the Host.
  useEffect(() => {
    if (!isHost) {
      setIsDrmBlackScreenDetected(false);
      return;
    }

    const video = localVideoRef.current;
    if (!video || !hasActiveStream || Boolean(directMediaUrl)) {
      setIsDrmBlackScreenDetected(false);
      return;
    }

    let consecutiveBlackSamples = 0;
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const interval = window.setInterval(() => {
      if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused) return;
      try {
        ctx.drawImage(video, 0, 0, 16, 16);
        const imgData = ctx.getImageData(0, 0, 16, 16).data;
        let isBlack = true;
        for (let i = 0; i < imgData.length; i += 4) {
          if (imgData[i] > 12 || imgData[i + 1] > 12 || imgData[i + 2] > 12) {
            isBlack = false;
            break;
          }
        }
        if (isBlack) {
          consecutiveBlackSamples++;
          if (consecutiveBlackSamples >= 3) {
            setIsDrmBlackScreenDetected(true);
            if (isHost) {
              void channelRef.current?.send({
                type: "broadcast",
                event: "theater:drm-detected",
                payload: { isBlack: true },
              });
            }
          }
        } else {
          consecutiveBlackSamples = 0;
          setIsDrmBlackScreenDetected(false);
        }
      } catch {
        /* cross-origin canvas security exception */
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [directMediaUrl, hasActiveStream, isHost]);

  // Companion Mode decision:
  // Companion Mode is ONLY for:
  // 1. User explicitly requested it via button (both host and viewer), OR
  // 2. Current user is Host on a device that CANNOT capture tab/screen (mobile host).
  // A viewer MUST NEVER be automatically forced into Companion Mode merely because they are on mobile or WebRTC is connecting/reconnecting!
  const isCompanionMode =
    userSwitchedToCompanion ||
    (isHost && !canShareScreen && !hasActiveStream && !directMediaUrl);

  const isCinemaFullscreen = isImmersiveTheater || isFullscreen || isLandscape;

  return (
    <div
      ref={cinemaContainerRef}
      className={`relative flex h-full w-full flex-col overflow-hidden bg-[#050608] text-[#f7f6f2] select-none ${
        isCinemaFullscreen
          ? "fixed inset-0 z-50 h-[100dvh] w-screen rounded-none border-none p-0"
          : "rounded-none sm:rounded-2xl border-0 sm:border sm:border-white/[0.08] shadow-2xl"
      }`}
    >
      {/* Hidden audio element for remote partner voice call */}
      <audio ref={remoteVoiceAudioRef} autoPlay playsInline />
      {/* Dedicated decoupled audio element for remote movie stream */}
      <audio ref={remoteMovieAudioRef} autoPlay playsInline className="hidden" />

      {/* TOP CINEMA HEADER (Rendered in regular/portrait view; in OTT Fullscreen, the floating auto-hiding HUD handles header controls) */}
      {!isCinemaFullscreen && (
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.07] px-2.5 sm:px-6 bg-[#07090e]/95 backdrop-blur-md z-30 pt-[env(safe-area-inset-top,0px)]">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={handleLeaveSession}
              className="p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/[0.06] transition-colors md:hidden"
              title="Leave / Exit Theater"
              aria-label="Leave / Exit Theater"
            >
              <ChevronLeft size={18} />
            </button>
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
              style={{ backgroundColor: provider?.brandColor || "#f43f5e" }}
            />
            <div className="flex items-center gap-1.5 sm:gap-2 truncate">
              <h2 className="text-xs sm:text-sm font-semibold truncate tracking-wide text-white">
                {title}
              </h2>
              <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider text-zinc-400 bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.08]">
                {providerName}
              </span>
            </div>

            {/* Status Badge */}
            <div className="hidden xs:flex items-center gap-1.5 ml-1 sm:ml-2">
              {hasActiveStream ? (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live ({streamSourceType})
                </span>
              ) : isCompanionMode ? (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  <Compass size={10} /> Companion
                </span>
              ) : roomState === "RECONNECTING" ? (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                  <RefreshCw size={10} className="animate-spin" /> Reconnecting
                </span>
              ) : roomState === "STREAM_CONNECTING" ? (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full animate-pulse">
                  <Loader2 size={10} className="animate-spin" /> Connecting…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-zinc-400 bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-full">
                  <Film size={10} /> Cinema
                </span>
              )}

              {/* WebRTC Diagnostics Chip */}
              <button
                type="button"
                onClick={() => setShowDiagModal(true)}
                className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all ${
                  webrtcDiagStats?.failureMatrixCase === "HEALTHY_STREAMING"
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                    : webrtcDiagStats?.failureMatrixCase?.startsWith("CASE_")
                    ? "text-rose-300 bg-rose-500/20 border-rose-500/40 animate-pulse hover:bg-rose-500/30"
                    : "text-zinc-400 bg-white/[0.04] border-white/[0.08] hover:text-white"
                }`}
                title="Open WebRTC Diagnostics Inspector"
                aria-label="Open WebRTC Diagnostics Inspector"
              >
                <Activity size={10} className={webrtcDiagStats?.failureMatrixCase === "HEALTHY_STREAMING" ? "text-emerald-400" : "text-amber-400"} />
                <span>
                  {webrtcDiagStats?.failureMatrixCase === "HEALTHY_STREAMING"
                    ? `${isHost ? (webrtcDiagStats?.outboundVideo?.fps || 0) : (webrtcDiagStats?.inboundVideo?.fps || 0)} fps`
                    : webrtcDiagStats?.failureMatrixCase === "CONNECTING"
                    ? "Connecting"
                    : webrtcDiagStats?.failureMatrixCase?.replace("CASE_", "") || "Diag"}
                </span>
              </button>
            </div>
          </div>

          {/* Right Controls in Header */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Partner Presence Badge */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium px-2 py-1 sm:px-2.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
              <span
                className={`w-2 h-2 rounded-full transition-colors ${
                  partnerPresence === "watching" || partnerPresence === "online"
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    : partnerPresence === "left"
                      ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse"
                      : "bg-zinc-600"
                }`}
              />
              <span
                className={`text-[10px] sm:text-[11px] truncate max-w-[70px] sm:max-w-none ${
                  partnerPresence === "left"
                    ? "text-rose-300 font-semibold"
                    : partnerPresence === "watching" || partnerPresence === "online"
                      ? "text-emerald-300"
                      : "text-zinc-400"
                }`}
              >
                {partnerPresence === "watching" || partnerPresence === "online"
                  ? "Partner here"
                  : partnerPresence === "left"
                    ? "Left"
                    : "Offline"}
              </span>
            </div>

            {/* Voice Chat Toggle */}
            <button
              type="button"
              onClick={() => {
                if (voiceActive) {
                  stopVoiceCall();
                } else {
                  void startVoiceCall();
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 rounded-full text-xs font-medium border transition-all ${
                voiceActive
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                  : "bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:text-white"
              }`}
              title={voiceActive ? "Leave voice call" : "Join voice call with partner"}
            >
              <Phone size={12} />
              <span className="hidden lg:inline">
                {voiceActive ? "Voice Connected" : "Voice Call"}
              </span>
            </button>

            {/* Mic Mute Toggle when Voice Active */}
            {voiceActive && (
              <button
                type="button"
                onClick={toggleMic}
                className={`p-1.5 rounded-full border transition-all ${
                  micMuted
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-white/[0.05] text-zinc-200 border-white/[0.1] hover:text-white"
                }`}
                title={micMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {micMuted ? <MicOff size={13} /> : <Mic size={13} />}
              </button>
            )}

            {/* Picture-in-Picture Button */}
            {hasActiveStream && (
              <button
                type="button"
                onClick={() => void togglePiP()}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                title={isPiP ? "Exit Picture in Picture" : "Picture in Picture"}
                aria-label="Picture in Picture"
              >
                <PictureInPicture2 size={14} className={isPiP ? "text-amber-400" : ""} />
              </button>
            )}

            {/* Direct Movie Player Shortcut Button */}
            <button
              type="button"
              onClick={() => setShowDirectMediaModal(true)}
              className={`p-1.5 rounded-full transition-colors ${
                directMediaUrl ? "text-rose-400 bg-rose-500/10" : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
              }`}
              title="Play direct movie or video link"
              aria-label="Play direct movie"
            >
              <Film size={14} />
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              title={isFullscreen || isImmersiveTheater ? "Exit fullscreen" : "Enter fullscreen OTT mode"}
              aria-label={isFullscreen || isImmersiveTheater ? "Exit fullscreen" : "Enter fullscreen OTT mode"}
            >
              {isFullscreen || isImmersiveTheater ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            {/* Whispers Chat Toggle (Desktop) */}
            <button
              type="button"
              onClick={() => {
                setChatOpen((o) => !o);
                setUnreadCount(0);
              }}
              aria-label="Toggle whispers chat"
              className={`hidden md:inline-flex relative items-center gap-1.5 px-2.5 py-1 sm:px-3 rounded-full text-xs font-medium border transition-all ${
                chatOpen
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm"
                  : "bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:text-white"
              }`}
            >
              <MessageSquare size={13} />
              <span className="hidden sm:inline">Whispers</span>
              {unreadCount > 0 && (
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Leave Session */}
            <button
              type="button"
              disabled={isSubmittingCompletion}
              onClick={handleLeaveSession}
              aria-label="Leave watch session"
              className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 sm:px-3 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors disabled:opacity-60 disabled:cursor-wait inline-flex items-center gap-1"
            >
              <span>Leave</span>
            </button>
          </div>
        </header>
      )}

      {/* MAIN CINEMA STAGE: RESPONSIVE COMPOSITION */}
      <div className="relative flex flex-1 flex-col md:flex-row overflow-hidden min-h-0">
        {/* 1. CINEMA VIEWPORT STAGE */}
        <div className={`relative flex flex-col bg-black overflow-hidden min-h-0 ${
          isCinemaFullscreen
            ? "flex-1 w-full h-full"
            : "w-full aspect-video md:aspect-auto md:flex-1 shrink-0 md:shrink"
        }`}>
          {/* FLOATING MICRO-ANIMATED REACTIONS OVER VIDEO */}
          <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
            <AnimatePresence>
              {reactions.map((r) => (
                <motion.span
                  key={r.id}
                  initial={{ opacity: 0, y: 30, scale: 0.5 }}
                  animate={{ opacity: 1, y: -90, scale: 1.25 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 2.2, ease: "easeOut" }}
                  className="absolute text-4xl select-none filter drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
                  style={{ left: `${r.x}%`, top: `${r.y}%` }}
                >
                  {r.emoji}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          {/* FLOATING AUTOPLAY UNMUTE BANNER */}
          <AnimatePresence>
            {!isHost && isAutoplayMuted && hasActiveStream && remoteStream && remoteStream.getAudioTracks().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-30"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnmuteRemote();
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-500/90 text-slate-950 px-4 py-2 text-xs font-bold shadow-2xl hover:bg-amber-400 transition-all active:scale-95"
                >
                  <VolumeX size={14} className="animate-pulse" />
                  <span>Tap to Unmute Movie Audio</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* VIDEO STAGE CONTAINER */}
          <div
            onClick={handleVideoAreaInteraction}
            onMouseMove={resetControlsTimer}
            className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden min-h-0 cursor-pointer touch-manipulation group"
          >
            {/* SCREEN LOCK PROMPT (OTT EXPERIENCE) */}
            {showLockPrompt && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-black/90 border border-amber-400/40 px-5 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-xl shadow-2xl animate-fade-in pointer-events-auto">
                <Lock size={18} className="text-amber-400 animate-pulse" />
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Screen Locked</p>
                  <p className="text-[10px] text-zinc-400">Controls are hidden</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsScreenLocked(false);
                    setShowLockPrompt(false);
                    setShowControls(true);
                  }}
                  className="ml-2 px-3 py-1 rounded-full bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition-colors shadow-md active:scale-95"
                >
                  Unlock
                </button>
              </div>
            )}

            {/* SCREEN LOCKED TOP-RIGHT UNLOCK SHORTCUT */}
            {isScreenLocked && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsScreenLocked(false);
                  setShowControls(true);
                }}
                className="absolute top-4 right-4 z-40 p-2.5 rounded-full bg-black/70 border border-amber-400/50 text-amber-300 backdrop-blur-md shadow-xl hover:bg-black pointer-events-auto active:scale-95"
                title="Unlock screen controls"
              >
                <Lock size={16} />
              </button>
            )}

            {/* QUICK EXPAND TO CINEMA MODE IN PORTRAIT */}
            {!isCinemaFullscreen && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  enterCinemaMode();
                }}
                className="absolute bottom-3 right-3 z-30 min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-black/70 border border-white/25 text-white hover:bg-black/90 backdrop-blur-md transition-all shadow-xl active:scale-90 flex items-center justify-center pointer-events-auto"
                title="Enter Cinema Mode"
                aria-label="Enter Cinema Mode"
              >
                <Maximize2 size={16} />
              </button>
            )}

            {/* FULLSCREEN / LANDSCAPE CINEMATIC OTT HUD OVERLAY */}
            {isCinemaFullscreen && !isScreenLocked && (
              <div
                className={`absolute inset-0 z-40 flex flex-col justify-between p-4 sm:p-6 transition-opacity duration-300 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none ${
                  showControls || playbackState === "paused" ? "opacity-100" : "opacity-0"
                }`}
              >
                {/* TOP HUD ROW */}
                <div className="flex items-center justify-between pointer-events-auto pt-[env(safe-area-inset-top,0px)]">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        exitCinemaMode();
                      }}
                      className="min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center active:scale-95"
                      title="Exit Cinema Mode"
                      aria-label="Exit Cinema Mode"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLeaveSession();
                      }}
                      className="min-h-[44px] px-3.5 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-lg"
                      title="Leave Theater"
                      aria-label="Leave Theater"
                    >
                      <LogOut size={14} />
                      <span>Leave</span>
                    </button>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">{title}</h2>
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{providerName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Screen Lock toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsScreenLocked(true);
                        setShowControls(false);
                      }}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-amber-300 transition-colors"
                      title="Lock screen controls"
                    >
                      <Lock size={16} />
                    </button>

                    {/* WebRTC Diagnostics Button in Cinema HUD */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDiagModal(true);
                      }}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors"
                      title="Open WebRTC Diagnostics Inspector"
                      aria-label="Open WebRTC Diagnostics Inspector"
                    >
                      <Activity size={16} />
                    </button>

                    {/* Voice Call Mic Toggle */}
                    {voiceActive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMic();
                        }}
                        className={`p-2 rounded-full border transition-all ${
                          micMuted
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            : "bg-white/10 text-white border-white/20"
                        }`}
                        title={micMuted ? "Unmute" : "Mute"}
                      >
                        {micMuted ? <MicOff size={16} /> : <Mic size={16} />}
                      </button>
                    )}

                    {/* PiP */}
                    {hasActiveStream && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void togglePiP();
                        }}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title="Picture in Picture"
                      >
                        <PictureInPicture2 size={16} />
                      </button>
                    )}

                    {/* Whispers Chat in Fullscreen */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatOpen((c) => !c);
                        setUnreadCount(0);
                      }}
                      className={`relative p-2 rounded-full border transition-colors ${
                        chatOpen ? "bg-rose-500/30 text-rose-200 border-rose-500/50" : "bg-white/10 text-white border-white/10 hover:bg-white/20"
                      }`}
                      title="Open Whispers Chat"
                    >
                      <MessageSquare size={16} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* CENTER HUD: -10s, PLAY/PAUSE, +10s (Rendered ONLY if provider genuinely supports playback control) */}
                {capabilities.canPlaybackControl && (
                  <div className="flex items-center justify-center gap-8 sm:gap-12 pointer-events-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        seekBy(-10);
                      }}
                      className="p-3 sm:p-4 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black/80 hover:scale-110 active:scale-95 transition-all shadow-2xl flex flex-col items-center gap-0.5"
                      title="Rewind 10 seconds"
                    >
                      <RotateCcw size={22} />
                      <span className="text-[9px] font-mono font-bold">-10s</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlayback();
                      }}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-all shadow-2xl"
                      title={playbackState === "playing" ? "Pause" : "Play"}
                    >
                      {playbackState === "playing" ? <Pause size={30} /> : <Play size={30} className="translate-x-0.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        seekBy(10);
                      }}
                      className="p-3 sm:p-4 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black/80 hover:scale-110 active:scale-95 transition-all shadow-2xl flex flex-col items-center gap-0.5"
                      title="Forward 10 seconds"
                    >
                      <RotateCw size={22} />
                      <span className="text-[9px] font-mono font-bold">+10s</span>
                    </button>
                  </div>
                )}

                {/* BOTTOM HUD ROW: PROGRESS / LIVE STREAM INDICATOR & CONTROLS */}
                <div className="space-y-2 pointer-events-auto pb-[env(safe-area-inset-bottom,0px)]">
                  {capabilities.canPlaybackControl ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-zinc-300 min-w-[45px]">{formattedTime}</span>
                      <input
                        type="range"
                        min={0}
                        max={estimatedDuration}
                        value={positionSeconds}
                        onChange={(e) => seekToPosition(Number(e.target.value))}
                        className="ott-slider flex-1"
                        aria-label="Seek video position"
                      />
                      <span className="text-xs font-mono text-zinc-400 min-w-[45px] text-right">
                        {formatSeconds(estimatedDuration)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pb-1 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                          Live Stream
                        </span>
                        <span className="text-zinc-300">
                          Watched: <span className="text-white font-medium">{formattedTime}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-sans hidden xs:inline">
                        Synchronized with partner
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    {/* Reactions Bar inside OTT Fullscreen */}
                    <div className="flex items-center gap-1 sm:gap-2">
                      {THEATER_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            broadcastReaction(emoji);
                          }}
                          className="min-w-[40px] min-h-[40px] text-xl sm:text-2xl hover:scale-125 active:scale-90 transition-transform p-1 flex items-center justify-center"
                          aria-label={`Send reaction ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVideoMute();
                        }}
                        className="min-w-[40px] min-h-[40px] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center active:scale-95"
                        title={isVideoMuted ? "Unmute movie audio" : "Mute movie audio"}
                        aria-label={isVideoMuted ? "Unmute movie audio" : "Mute movie audio"}
                      >
                        {isVideoMuted ? <VolumeX size={16} className="text-amber-400" /> : <Volume2 size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          exitCinemaMode();
                        }}
                        className="min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center active:scale-95"
                        title="Exit Cinema Mode"
                        aria-label="Exit Cinema Mode"
                      >
                        <Minimize2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OTT DOUBLE-TAP SKIP RIPPLE OVERLAYS (Only if provider genuinely supports seek control) */}
            {capabilities.canPlaybackControl && skipRipple?.direction === "left" && (
              <div className="absolute left-8 top-1/2 -translate-y-1/2 z-40 pointer-events-none flex flex-col items-center gap-1 text-white bg-black/75 px-5 py-4 rounded-full border border-white/20 backdrop-blur-md animate-ott-ripple-left shadow-2xl">
                <RotateCcw size={28} />
                <span className="text-xs font-bold font-mono tracking-wider">-10s</span>
              </div>
            )}
            {capabilities.canPlaybackControl && skipRipple?.direction === "right" && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2 z-40 pointer-events-none flex flex-col items-center gap-1 text-white bg-black/75 px-5 py-4 rounded-full border border-white/20 backdrop-blur-md animate-ott-ripple-right shadow-2xl">
                <RotateCw size={28} />
                <span className="text-xs font-bold font-mono tracking-wider">+10s</span>
              </div>
            )}

            {/* OTT CENTER PLAY/PAUSE MOMENTARY PULSE */}
            {capabilities.canPlaybackControl && playPausePulse && (
              <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-black/75 border border-white/25 backdrop-blur-md flex items-center justify-center text-white shadow-2xl scale-125 transition-transform">
                  {playPausePulse === "playing" ? (
                    <Play size={28} className="translate-x-0.5" />
                  ) : (
                    <Pause size={28} />
                  )}
                </div>
              </div>
            )}

            {/* TEMPORARY ORIENTATION VISUAL CUE FOR CINEMA MODE */}
            <AnimatePresence>
              {showRotateCue && !isLandscape && isCinemaFullscreen && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-full border border-amber-500/30 bg-black/90 px-4 py-2 text-xs font-medium text-amber-200 shadow-2xl backdrop-blur-md whitespace-nowrap"
                >
                  <RotateCcw size={15} className="text-amber-400" />
                  <span>Turn your phone sideways for Cinema Mode</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Host source resolution banner if captured window is smaller than 720p */}
            {isSourceResolutionLow && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] shadow-lg backdrop-blur-md pointer-events-none max-w-[92vw] text-center">
                <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                <span>
                  ⚠️ Movie Window Minimized/Shrunk ({sourceWidth}x{sourceHeight || Math.round((sourceWidth! * 9) / 16)}): Keep your movie window (Netflix/Hotstar/tab) OPEN and MAXIMIZED behind this screen. Do NOT minimize it to the taskbar! (Minimizing kills resolution to 226x108).
                </span>
              </div>
            )}

            {/* A. HOST VIEW: LOCAL SHARED TAB STREAM (VISUAL PREVIEW ONLY - PERMANENTLY MUTED TO PREVENT ECHO) */}
            {isHost && (
              <video
                ref={localVideoRef}
                data-webrtc-role="local"
                muted={true}
                autoPlay
                playsInline
                webkit-playsinline="true"
                x5-playsinline="true"
                onResize={() => {
                  const video = localVideoRef.current;
                  if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                    setHostCaptureDimensions({ width: video.videoWidth, height: video.videoHeight });
                  }
                }}
                onLoadedMetadata={() => {
                  const video = localVideoRef.current;
                  if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                    setHostCaptureDimensions({ width: video.videoWidth, height: video.videoHeight });
                  }
                }}
                className={`h-full w-full object-contain ${
                  isHostCapturing && !directMediaUrl ? "block" : "hidden"
                }`}
              />
            )}

            {/* B. VIEWER VIEW: PERMANENTLY MOUNTED REMOTE WEBRTC VIDEO STREAM */}
            {!isHost && (
              <video
                ref={remoteVideoRef}
                data-webrtc-role="remote"
                muted={true}
                autoPlay
                playsInline
                webkit-playsinline="true"
                x5-playsinline="true"
                className={`h-full w-full object-contain ${
                  !directMediaUrl ? "block" : "hidden"
                }`}
                style={{ maxHeight: "100%", maxWidth: "100%" }}
              />
            )}

            {/* C. SYNCHRONIZED DIRECT MEDIA PLAYER (Direct Movie Link / Open-Source / YouTube) */}
            {directMediaUrl && (
              (() => {
                const ytId = extractYouTubeId(directMediaUrl);
                if (ytId) {
                  return (
                    <div className="relative h-full w-full flex items-center justify-center bg-black z-10">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&enablejsapi=1&playsinline=1&rel=0&iv_load_policy=3&controls=1`}
                        title="Synchronized YouTube Player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="h-full w-full aspect-video max-h-full max-w-full rounded-lg shadow-2xl"
                        style={{ border: "none" }}
                      />
                    </div>
                  );
                }
                return (
                  <video
                    ref={directVideoRef}
                    src={directMediaUrl}
                    playsInline
                    webkit-playsinline="true"
                    x5-playsinline="true"
                    className="h-full w-full object-contain block z-10"
                    style={{ maxHeight: "100%", maxWidth: "100%" }}
                    onTimeUpdate={(e) => {
                      if (isHost) {
                        setPositionSeconds(Math.floor(e.currentTarget.currentTime));
                      }
                    }}
                    onLoadedMetadata={(e) => {
                      if (e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                        setEstimatedDuration(Math.floor(e.currentTarget.duration));
                      }
                    }}
                    onPlay={() => setPlaybackState("playing")}
                    onPause={() => setPlaybackState("paused")}
                  />
                );
              })()
            )}

            {/* MOBILE TAP TO START VIDEO OVERLAY (When remote stream is ready but mobile browser requires user tap to play) */}
            {!isHost && hasActiveStream && (!isMediaRendering || !isVideoActuallyPlaying) && !isCompanionMode && !directMediaUrl && (
              <div
                onClick={async (e) => {
                  e.stopPropagation();
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.muted = true;
                    try {
                      await remoteVideoRef.current.play();
                      if (remoteVideoRef.current.videoWidth > 0) {
                        setIsMediaRendering(true);
                      }
                      setIsVideoActuallyPlaying(true);
                    } catch (err) {
                      console.warn("[VirtualRoom] Manual play error:", err);
                    }
                  }
                  if (remoteMovieAudioRef.current) {
                    remoteMovieAudioRef.current.muted = false;
                    void remoteMovieAudioRef.current.play().then(() => {
                      setIsAutoplayMuted(false);
                    }).catch(() => {});
                  }
                }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm cursor-pointer p-6 text-center select-none"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-600/50 animate-pulse active:scale-95 transition-all">
                  <Play size={32} className="translate-x-0.5" />
                </div>
                <h4 className="mt-4 text-sm sm:text-base font-semibold text-white tracking-wide">
                  Partner is Sharing Movie Stream
                </h4>
                <p className="text-xs text-rose-300 font-medium mt-1">
                  Tap anywhere to watch
                </p>
                <span className="text-[10px] text-zinc-400 mt-2 max-w-xs">
                  Mobile browsers require one screen tap to initiate streaming video playback
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDiagModal(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono text-zinc-300 bg-white/10 hover:bg-white/20 border border-white/20 transition-all pointer-events-auto"
                >
                  <Activity size={12} className="text-amber-400" />
                  <span>Inspect WebRTC Diagnostics</span>
                </button>
              </div>
            )}

            {/* DRM BLACK SCREEN DETECTED BANNER ON HOST (PC) */}
            {isHost && isDrmBlackScreenDetected && !directMediaUrl && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[94%] rounded-2xl border border-amber-500/40 bg-[#0d0f17]/95 p-4 shadow-2xl backdrop-blur-xl text-left space-y-2 pointer-events-auto">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                  <AlertCircle size={16} className="text-amber-400 shrink-0" />
                  <span>Streaming DRM Protection Detected</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Your browser is sending black video to your partner because Hotstar/Netflix DRM prevents screen recording with graphics acceleration enabled.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-[10px] border border-amber-500/20">
                    Fix: Chrome Settings &rarr; System &rarr; Turn OFF graphics acceleration &rarr; Restart Chrome
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDirectMediaModal(true);
                    }}
                    className="text-xs font-semibold text-rose-300 hover:text-white underline ml-auto"
                  >
                    Play Direct Movie Link &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* DRM PROTECTION NOTICE ON VIEWER (MOBILE) */}
            {!isHost && (isDrmBlackScreenDetected || partnerDrmReported) && !directMediaUrl && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 max-w-md w-[94%] rounded-2xl border border-amber-500/40 bg-[#0d0f17]/95 p-4 shadow-2xl backdrop-blur-xl text-left space-y-2 pointer-events-auto">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                  <AlertCircle size={16} className="text-amber-400 shrink-0" />
                  <span>Movie Stream is DRM-Protected</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Your partner is streaming DRM content (Hotstar/Netflix). We have alerted them to disable hardware acceleration in Chrome, or you can switch viewing modes below:
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserSwitchedToCompanion(true);
                    }}
                    className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-400 text-black hover:bg-amber-300 active:scale-95 transition-all shadow"
                  >
                    Switch to Companion Mode
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDirectMediaModal(true);
                    }}
                    className="text-xs text-zinc-300 hover:text-white underline ml-1"
                  >
                    Direct Movie Player
                  </button>
                </div>
              </div>
            )}

            {/* C. HOST SETUP GUIDE (When no screen capture is active) */}
            {isHost && !isHostCapturing && !isCompanionMode && !directMediaUrl && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 sm:p-6 text-center bg-gradient-to-b from-[#090b11]/90 via-[#07080d]/95 to-black backdrop-blur-md overflow-y-auto">
                <div className="max-w-lg w-full rounded-2xl border border-white/[0.08] bg-[#0c0e15]/90 p-6 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 my-auto">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto text-white shadow-xl"
                    style={{
                      backgroundColor: provider?.brandColor ? `${provider.brandColor}22` : "#ffffff11",
                      border: `1px solid ${provider?.brandColor || "#ffffff"}44`,
                    }}
                  >
                    <Tv size={26} style={{ color: provider?.brandColor || "#ffffff" }} />
                  </div>

                  <div>
                    <span className="text-[10px] font-mono font-medium uppercase tracking-[0.25em] text-amber-400">
                      Private Cinema Setup
                    </span>
                    <h3 className="text-xl sm:text-2xl font-serif font-normal text-white mt-1">
                      {title}
                    </h3>
                    <p className="text-xs text-zinc-400 font-light mt-2 leading-relaxed">
                      To watch together, launch the movie in a separate browser tab, then share
                      that tab with your partner. Audio & video stream privately via WebRTC.
                    </p>
                  </div>

                  {/* Step-by-Step Guidance */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                      <span className="text-[10px] font-mono text-zinc-400">STEP 1</span>
                      <p className="text-xs font-medium text-white">Open {providerName} (New Window)</p>
                      <p className="text-[11px] text-zinc-400">
                        Launch the movie in a separate window and keep it maximized behind CoupleConnect.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                      <span className="text-[10px] font-mono text-zinc-400">STEP 2</span>
                      <p className="text-xs font-medium text-white">Share Browser Tab</p>
                      <p className="text-[11px] text-zinc-400">
                        Select the tab where your movie is running.
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1 col-span-1 sm:col-span-2 text-left">
                      <span className="text-[10px] font-mono text-amber-400 font-bold">DRM TIP FOR HOTSTAR / NETFLIX</span>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        If sharing Hotstar or Netflix and your partner sees audio but black video, turn off Hardware Acceleration in Chrome (Settings &rarr; System &rarr; toggle off &ldquo;Use graphics acceleration when available&rdquo; and restart Chrome) or test with YouTube to verify.
                      </p>
                    </div>
                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-1 col-span-1 sm:col-span-2 text-left">
                      <span className="text-[10px] font-mono text-sky-400 font-bold">1080P HD QUALITY TIP</span>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        Tip: Keep the movie in its own maximized window. Do NOT click minimize (_) on it. Minimizing the movie window forces Chrome to shrink capture to a 226x108 blurry thumbnail. Keep the movie window open behind this browser window. For YouTube, use Direct Movie Sync below for native 1080p quality!
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <a
                      href={providerSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        updateState("OTT_OPEN");
                        try {
                          const newWin = window.open(
                            providerSearchUrl,
                            "_blank",
                            "width=1280,height=800,menubar=yes,toolbar=yes,location=yes,resizable=yes"
                          );
                          if (newWin) {
                            e.preventDefault();
                            newWin.focus();
                          }
                        } catch {
                          // Allow standard anchor fallback if popup was blocked
                        }
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-zinc-900 bg-white hover:bg-zinc-200 transition-all shadow-md active:scale-95"
                      title="Tip: Keep the movie in its own maximized window. Do NOT click minimize (_) on it."
                    >
                      <ExternalLink size={13} /> 1. Open {providerName} (New Window) ↗
                    </a>

                    <button
                      type="button"
                      onClick={() => void startScreenShare()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-md shadow-rose-600/20 active:scale-95"
                    >
                      <Share2 size={13} /> 2. Share Movie Tab
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDirectMediaModal(true)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-zinc-200 bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] transition-all active:scale-95"
                    >
                      <Film size={13} /> Direct / YouTube Sync 🎬
                    </button>
                  </div>

                  {/* Window Guidance Instruction */}
                  <p className="text-[11px] text-amber-300/90 text-center font-medium">
                    💡 Tip: Keep the movie in its own maximized window. Do NOT click minimize (_) on it.
                  </p>

                  {/* Fallback to Companion Mode option */}
                  <div className="pt-2 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setUserSwitchedToCompanion(true)}
                      className="text-[11px] text-zinc-400 hover:text-white transition-colors"
                    >
                      Watching via TV or DRM blocked? Switch to Companion Mode →
                    </button>
                  </div>

                  {errorMessage && (
                    <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* D. VIEWER WAITING LOUNGE (When viewer is waiting for remote stream to establish) */}
            {!isHost && !hasActiveStream && !isCompanionMode && roomState !== "STREAM_ENDED" && !directMediaUrl && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 sm:p-6 text-center bg-gradient-to-b from-[#090b11]/90 via-[#07080d]/95 to-black backdrop-blur-md overflow-y-auto">
                <div className="max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#0c0e15]/90 p-6 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 my-auto">
                  <div className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-xl overflow-hidden mx-auto border border-white/[0.1] shadow-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={backdrop} alt={title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Film size={26} className="text-white/80 animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono font-medium uppercase tracking-[0.25em] text-rose-400">
                      Private Cinema Lounge
                    </span>
                    <h3 className="text-lg sm:text-xl font-serif font-normal text-white mt-1">
                      {title}
                    </h3>
                    <p className="text-xs text-zinc-400 font-light mt-2 leading-relaxed">
                      {roomState === "LIVE" || roomState === "STREAM_CONNECTING"
                        ? "Partner is currently sharing their movie tab. Establishing direct WebRTC video stream…"
                        : "Your partner is preparing the movie stream. As soon as they share their tab, the theater will play here automatically in high definition."}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-zinc-300 bg-white/[0.03] border border-white/[0.06] rounded-full py-2 px-4 w-fit mx-auto">
                    <RefreshCw size={12} className="animate-spin text-rose-400" />
                    <span>
                      {roomState === "LIVE" || roomState === "STREAM_CONNECTING"
                        ? "Connecting to partner's movie stream…"
                        : "Awaiting partner WebRTC broadcast…"}
                    </span>
                  </div>

                  {/* Manual trigger button if viewer wants to re-check immediately */}
                  <div className="pt-1 flex flex-col gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => sendViewerReady()}
                      className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 active:scale-95 transition-all inline-flex items-center gap-1.5"
                    >
                      <Sparkles size={12} />
                      <span>{roomState === "LIVE" || roomState === "STREAM_CONNECTING" ? "Tap to Connect / Refresh Stream ⚡" : "Partner started? Request stream now ⚡"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDirectMediaModal(true)}
                      className="text-[11px] text-rose-300 hover:text-rose-200 underline transition-colors"
                    >
                      Or play direct movie together 🎬
                    </button>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setUserSwitchedToCompanion(true)}
                      className="text-[11px] text-zinc-400 hover:text-white transition-colors"
                    >
                      Want to open movie on your own app? Switch to Companion Mode →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* E. STREAM ENDED OVERLAY */}
            {roomState === "STREAM_ENDED" && !isCompanionMode && !directMediaUrl && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-black/90 backdrop-blur-md">
                <div className="max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#0c0e15] p-8 shadow-2xl space-y-5">
                  <Film size={32} className="text-zinc-500 mx-auto" />
                  <h3 className="text-xl font-serif text-white">The Movie Stream Ended</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    The host stopped sharing their browser tab. You can resume sharing, switch to
                    synchronized Companion Mode, or save your movie memory archive.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                    {isHost && canShareScreen && (
                      <button
                        type="button"
                        onClick={() => void startScreenShare()}
                        className="w-full sm:w-auto rounded-full bg-white text-zinc-900 px-5 py-2.5 text-xs font-semibold hover:bg-zinc-200 transition-all shadow-md active:scale-95"
                      >
                        Resume Sharing Tab
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setUserSwitchedToCompanion(true)}
                      className="w-full sm:w-auto rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                    >
                      Switch to Companion Mode
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* F. COMPANION MODE (Optimized for Mobile & DRM OTTs) */}
            {isCompanionMode && !directMediaUrl && (
              <div className="relative inset-0 flex-1 w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
                {/* Cinematic Ambient Backdrop */}
                <div
                  className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-25 scale-105"
                  style={{ backgroundImage: `url(${backdrop})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/90 to-[#06070a]" />

                <div className="relative z-10 max-w-lg w-full rounded-2xl border border-amber-500/25 bg-[#0d0f17]/95 p-6 sm:p-8 shadow-2xl text-center space-y-5 backdrop-blur-xl my-auto">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-300 shadow-lg">
                    <Compass size={24} />
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-400">
                      Companion Mode Active
                    </span>
                    <h3 className="text-xl sm:text-2xl font-serif font-light text-white mt-1">
                      {title}
                    </h3>
                    <p className="text-xs text-zinc-400 font-light mt-2 leading-relaxed">
                      Streaming provider protection prevents direct tab capture in this environment.
                      Open the movie on your device—{BRAND.name} synchronizes your shared timeline,
                      whispers, reactions, and voice connection.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <a
                      href={providerSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-xs font-bold text-zinc-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-400/20 active:scale-95"
                    >
                      <ExternalLink size={13} /> Open {providerName} on Device ↗
                    </a>

                    {isHost && canShareScreen && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserSwitchedToCompanion(false);
                          void startScreenShare();
                        }}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-zinc-200 hover:text-white transition-colors"
                      >
                        <Share2 size={13} /> Try Tab Share Again
                      </button>
                    )}

                    {!isHost && (
                      <button
                        type="button"
                        onClick={() => setUserSwitchedToCompanion(false)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-zinc-200 hover:text-white transition-colors"
                      >
                        <Film size={13} /> Return to Cinema Lounge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CINEMA CONTROL & TIMELINE BAR (Desktop View) */}
          <div className="hidden md:block border-t border-white/[0.07] px-3 sm:px-4 py-2 sm:py-2.5 bg-[#07090e]/95 backdrop-blur-md z-30 pb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              {/* Left: Time & Playback status */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = playbackState === "playing" ? "paused" : "playing";
                    setPlaybackState(next);
                    void channelRef.current?.send({
                      type: "broadcast",
                      event: "theater:playback",
                      payload: { userId, state: next, position: positionSeconds },
                    });
                  }}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-white text-zinc-950 flex items-center justify-center hover:bg-zinc-200 transition-all shadow-sm active:scale-95"
                  title={playbackState === "playing" ? "Pause timeline" : "Resume timeline"}
                  aria-label={playbackState === "playing" ? "Pause" : "Play"}
                >
                  {playbackState === "playing" ? <Pause size={14} /> : <Play size={14} />}
                </button>

                <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
                  <Clock size={12} className="text-zinc-500 shrink-0" />
                  <span className="text-white font-medium">{formattedTime}</span>
                </div>
              </div>

              {/* Center: Realtime Reaction Pills (Touch-friendly on mobile) */}
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 scrollbar-none">
                {THEATER_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => broadcastReaction(emoji)}
                    className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center text-lg sm:text-xl rounded-full hover:scale-125 transition-transform active:scale-90 opacity-90 hover:opacity-100 touch-manipulation"
                    title={`React with ${emoji}`}
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Right: Screen Sharing / Unmute controls */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {!isHost && hasActiveStream && isAutoplayMuted && (
                  <button
                    type="button"
                    onClick={handleUnmuteRemote}
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 flex items-center gap-1"
                    title="Unmute video"
                  >
                    <VolumeX size={12} />
                    <span className="hidden sm:inline">Unmute</span>
                  </button>
                )}

                {isHost && hasActiveStream && (
                  <button
                    type="button"
                    onClick={stopScreenShare}
                    className="text-xs font-medium text-rose-300 hover:text-rose-200 px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 transition-all active:scale-95"
                  >
                    Stop Sharing
                  </button>
                )}

                {isHost && !hasActiveStream && canShareScreen && !isCompanionMode && (
                  <button
                    type="button"
                    onClick={() => void startScreenShare()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 hover:text-white px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] transition-all active:scale-95"
                  >
                    <Share2 size={12} />
                    <span className="hidden sm:inline">Share Tab</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE OTT THEATER CONSOLE (Portrait Mode below Video Stage) */}
        {!isCinemaFullscreen && (
          <div className="md:hidden flex-1 flex flex-col min-h-0 bg-[#07090e] border-t border-white/[0.08] divide-y divide-white/[0.06]">
            {/* 1. MOVIE & SESSION INFO + TIMELINE + QUICK ACTIONS */}
            <div className="p-3 space-y-2.5 bg-[#090b12] shrink-0">
              {/* Title & Status Badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm font-bold text-white tracking-wide truncate">
                      {title}
                    </h1>
                    <span
                      className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-semibold shrink-0"
                      style={{
                        backgroundColor: provider?.brandColor ? `${provider.brandColor}22` : "#ffffff15",
                        color: provider?.brandColor || "#f43f5e",
                        border: `1px solid ${provider?.brandColor ? `${provider.brandColor}44` : "#ffffff25"}`,
                      }}
                    >
                      {providerName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                    {/* Live WebRTC / Companion Status */}
                    {hasActiveStream ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live {streamSourceType}
                      </span>
                    ) : isCompanionMode ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-300">
                        <Compass size={11} /> Companion Mode
                      </span>
                    ) : roomState === "STREAM_CONNECTING" ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-rose-300 animate-pulse">
                        <Loader2 size={11} className="animate-spin" /> Connecting…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-400">
                        <Film size={11} /> Cinema Lounge
                      </span>
                    )}

                    <span className="text-zinc-600">•</span>

                    {/* Partner Presence */}
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          partnerPresence === "watching" || partnerPresence === "online"
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                            : partnerPresence === "left"
                              ? "bg-rose-500 animate-pulse"
                              : "bg-zinc-600"
                        }`}
                      />
                      <span
                        className={
                          partnerPresence === "watching" || partnerPresence === "online"
                            ? "text-emerald-300/90 font-medium"
                            : "text-zinc-500"
                        }
                      >
                        {partnerPresence === "watching" || partnerPresence === "online"
                          ? "Partner here"
                          : partnerPresence === "left"
                            ? "Partner left"
                            : "Partner offline"}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Enter Cinema Mode quick shortcut button */}
                <button
                  type="button"
                  onClick={enterCinemaMode}
                  className="min-w-[44px] min-h-[44px] p-2 rounded-xl bg-white/[0.06] border border-white/[0.1] text-zinc-200 hover:text-white hover:bg-white/[0.1] active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-sm"
                  title="Enter Cinema Mode"
                  aria-label="Enter Cinema Mode"
                >
                  <Maximize2 size={16} />
                </button>
              </div>

              {/* Truthful Timeline or Live OTT Stream Status Bar */}
              {capabilities.canPlaybackControl ? (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={togglePlayback}
                      className="min-w-[44px] min-h-[44px] rounded-full bg-white text-zinc-950 flex items-center justify-center hover:bg-zinc-200 active:scale-90 transition-all shadow-sm shrink-0"
                      title={playbackState === "playing" ? "Pause playback" : "Resume playback"}
                      aria-label={playbackState === "playing" ? "Pause" : "Play"}
                    >
                      {playbackState === "playing" ? (
                        <Pause size={18} />
                      ) : (
                        <Play size={18} className="translate-x-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => seekBy(-10)}
                      className="min-w-[44px] min-h-[44px] rounded-full bg-white/[0.05] border border-white/[0.08] text-zinc-300 hover:text-white active:scale-90 transition-all flex items-center justify-center shrink-0"
                      title="Rewind 10 seconds"
                      aria-label="Rewind 10 seconds"
                    >
                      <RotateCcw size={16} />
                    </button>

                    <div className="flex-1 flex flex-col justify-center px-1">
                      <input
                        type="range"
                        min={0}
                        max={estimatedDuration}
                        value={positionSeconds}
                        onChange={(e) => seekToPosition(Number(e.target.value))}
                        className="ott-slider w-full"
                        aria-label="Seek timeline position"
                      />
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-0.5">
                        <span className="text-white font-medium">{formattedTime}</span>
                        <span>{formatSeconds(estimatedDuration)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => seekBy(10)}
                      className="min-w-[44px] min-h-[44px] rounded-full bg-white/[0.05] border border-white/[0.08] text-zinc-300 hover:text-white active:scale-90 transition-all flex items-center justify-center shrink-0"
                      title="Forward 10 seconds"
                      aria-label="Forward 10 seconds"
                    >
                      <RotateCw size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Truthful Live OTT Stream Status Bar */
                <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/15 px-2.5 py-0.5 rounded-full border border-rose-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                      Live Stream
                    </span>
                    <span className="text-[11px] text-zinc-300">
                      Watched: <span className="font-semibold text-white">{formattedTime}</span>
                    </span>
                  </div>

                  {!isHost && hasActiveStream && (
                    <button
                      type="button"
                      onClick={toggleVideoMute}
                      className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors active:scale-95"
                      title={isVideoMuted ? "Unmute audio" : "Mute audio"}
                      aria-label={isVideoMuted ? "Unmute audio" : "Mute audio"}
                    >
                      {isVideoMuted ? <VolumeX size={13} className="text-amber-400" /> : <Volume2 size={13} />}
                      <span>{isVideoMuted ? "Muted" : "Audio On"}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Horizontal Action Pills (Touch-friendly 44px min height) */}
              <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-none">
                {/* Voice Call Pill */}
                <button
                  type="button"
                  onClick={() => {
                    if (voiceActive) stopVoiceCall();
                    else void startVoiceCall();
                  }}
                  className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-all active:scale-95 shrink-0 ${
                    voiceActive
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                      : "bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:bg-white/[0.08]"
                  }`}
                  title={voiceActive ? "Leave voice call" : "Start voice call with partner"}
                  aria-label={voiceActive ? "Leave voice call" : "Start voice call"}
                >
                  <Phone size={13} className={voiceActive ? "animate-pulse text-emerald-400" : ""} />
                  <span>{voiceActive ? "Voice Connected" : "Voice Call"}</span>
                </button>

                {/* Mic Toggle when Voice is Active */}
                {voiceActive && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                      micMuted
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-white/[0.06] text-white border-white/10 hover:bg-white/12"
                    }`}
                    title={micMuted ? "Unmute microphone" : "Mute microphone"}
                    aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
                  >
                    {micMuted ? <MicOff size={15} /> : <Mic size={15} />}
                  </button>
                )}

                {/* Viewer Unmute Movie Audio button if Autoplay muted */}
                {!isHost && hasActiveStream && isAutoplayMuted && (
                  <button
                    type="button"
                    onClick={handleUnmuteRemote}
                    className="min-h-[44px] px-3.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 inline-flex items-center gap-1.5 active:scale-95 transition-all shrink-0 animate-pulse shadow-sm"
                    title="Unmute movie audio"
                    aria-label="Unmute movie audio"
                  >
                    <VolumeX size={14} />
                    <span>Unmute Movie</span>
                  </button>
                )}

                {/* Host Screen Share Buttons */}
                {isHost && hasActiveStream && (
                  <button
                    type="button"
                    onClick={stopScreenShare}
                    className="min-h-[44px] px-3.5 rounded-xl text-xs font-medium text-rose-300 border border-rose-500/30 bg-rose-500/10 active:scale-95 transition-all shrink-0 inline-flex items-center gap-1.5"
                    title="Stop sharing tab"
                    aria-label="Stop sharing tab"
                  >
                    <Share2 size={13} />
                    <span>Stop Sharing</span>
                  </button>
                )}

                {isHost && !hasActiveStream && canShareScreen && !isCompanionMode && (
                  <button
                    type="button"
                    onClick={() => void startScreenShare()}
                    className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 border border-rose-500/40 active:scale-95 transition-all shrink-0 inline-flex items-center gap-1.5 shadow-sm"
                    title="Share browser tab"
                    aria-label="Share browser tab"
                  >
                    <Share2 size={13} />
                    <span>Share Tab</span>
                  </button>
                )}

                {/* Direct Movie Player Pill */}
                <button
                  type="button"
                  onClick={() => setShowDirectMediaModal(true)}
                  className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all active:scale-95 shrink-0 ${
                    directMediaUrl
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm"
                      : "bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:bg-white/[0.08]"
                  }`}
                  title="Direct movie / video player"
                  aria-label="Direct movie / video player"
                >
                  <Film size={13} className={directMediaUrl ? "text-rose-400" : ""} />
                  <span>{directMediaUrl ? "Direct Movie Active" : "Direct Movie"}</span>
                </button>

                {/* OTT Native App Deep Link */}
                <a
                  href={nativeAppDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-3.5 rounded-xl text-xs font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.08] hover:text-white active:scale-95 transition-all inline-flex items-center gap-1.5 shrink-0"
                  title={`Open in ${providerName}`}
                  aria-label={`Open in ${providerName}`}
                >
                  <ExternalLink size={13} />
                  <span>Open {providerName}</span>
                </a>

                {/* Companion Mode Switcher */}
                <button
                  type="button"
                  onClick={() => setUserSwitchedToCompanion((c) => !c)}
                  className="min-h-[44px] px-3 rounded-xl text-xs font-medium text-zinc-400 bg-white/[0.02] border border-white/[0.06] hover:text-zinc-200 active:scale-95 transition-all inline-flex items-center gap-1.5 shrink-0"
                  title="Switch viewing mode"
                  aria-label="Switch viewing mode"
                >
                  <Compass size={13} />
                  <span>{isCompanionMode ? "Lounge Mode" : "Companion Mode"}</span>
                </button>
              </div>
            </div>

            {/* 2. INSTANT TOUCH REACTIONS BAR */}
            <div className="px-3 py-2 bg-[#08090f] shrink-0 flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400 shrink-0 ml-1 mr-0.5" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 hidden xs:inline shrink-0">
                  React:
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-around">
                {THEATER_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => broadcastReaction(emoji)}
                    className="min-w-[44px] min-h-[44px] rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-xl hover:bg-white/[0.08] active:scale-90 transition-all touch-manipulation shadow-sm"
                    title={`React with ${emoji}`}
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. COUPLE WHISPERS CHAT STREAM */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#050609]">
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-1.5 text-zinc-500">
                    <Sparkles size={20} className="text-rose-400/60 animate-pulse" />
                    <p className="text-xs font-medium text-zinc-400">No whispers yet</p>
                    <p className="text-[11px] text-zinc-600 max-w-xs leading-relaxed">
                      Whisper your thoughts, reactions, and favorite moments synced directly to this movie!
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.userId === userId;
                    const timeTag = formatMsgTime(m.playbackPosition);
                    return (
                      <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <div className="flex items-baseline gap-1.5 mb-0.5">
                          <span className="text-[10px] font-medium text-zinc-400">{isMe ? "You" : "Partner"}</span>
                          {timeTag && (
                            <span className="text-[9px] font-mono text-rose-300/80 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                              {timeTag}
                            </span>
                          )}
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed break-words ${
                            isMe
                              ? "bg-rose-600/90 text-white rounded-tr-none shadow-sm"
                              : "bg-white/[0.07] text-zinc-200 rounded-tl-none border border-white/[0.08]"
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* 4. PINNED WHISPER COMPOSER */}
              <form
                onSubmit={handleSendMessage}
                className="border-t border-white/[0.07] p-2.5 space-y-1.5 bg-[#06070b] pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shrink-0"
              >
                <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
                  <button
                    type="button"
                    onClick={() => setStampTimestamp((s) => !s)}
                    className={`min-h-[24px] inline-flex items-center gap-1 font-mono transition-colors ${
                      stampTimestamp ? "text-rose-400 font-semibold" : "text-zinc-500"
                    }`}
                    title="Toggle movie timestamp stamp"
                    aria-label="Toggle movie timestamp stamp"
                  >
                    <Clock size={11} />
                    <span>Stamp at {formattedTime}</span>
                  </button>
                  <span className="text-zinc-600 text-[10px]">Enter to send</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Whisper at this moment…"
                    aria-label="Whisper message"
                    className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-base sm:text-xs text-white placeholder-zinc-500 outline-none focus:border-rose-500/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="min-w-[56px] min-h-[44px] rounded-xl bg-white text-zinc-950 px-4 text-xs font-bold hover:bg-zinc-200 disabled:opacity-40 transition-all shadow-sm active:scale-95 shrink-0 flex items-center justify-center"
                    aria-label="Send whisper"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MOBILE CHAT BACKDROP OVERLAY (Active only in Cinema / Landscape mode) */}
        {isCinemaFullscreen && chatOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setChatOpen(false)}
          />
        )}

        {/* 2. CHAT SIDEBAR (DOCKED ON DESKTOP, SLIDE-OVER ON LANDSCAPE/CINEMA) */}
        {chatOpen && (
          <aside
            className={`fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] border-l border-white/[0.1] bg-[#07090e]/95 backdrop-blur-2xl shadow-2xl flex flex-col transition-all duration-300 ease-out md:static md:z-20 md:h-full md:w-80 md:w-[28%] md:min-w-[280px] md:max-w-sm md:rounded-none md:border-t-0 md:border-l md:shadow-none ${
              !isCinemaFullscreen ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Mobile Handle */}
            <div className="md:hidden flex items-center justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Chat Header */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-rose-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Theater Whispers
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-500">
                  Synced to movie
                </span>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Close whispers"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2 text-zinc-500">
                <Sparkles size={20} className="text-zinc-600" />
                <p className="text-xs">No whispers yet.</p>
                <p className="text-[11px] text-zinc-600 leading-relaxed max-w-xs">
                  Send thoughts, laugh at scenes, or react together. Each whisper captures the
                  exact movie second!
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.userId === userId;
                const timeTag = formatMsgTime(m.playbackPosition);
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-[10px] font-medium text-zinc-400">
                        {isMe ? "You" : "Partner"}
                      </span>
                      {timeTag && (
                        <span className="text-[9px] font-mono text-rose-300/80 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                          {timeTag}
                        </span>
                      )}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        isMe
                          ? "bg-rose-600/90 text-white rounded-tr-none shadow-sm"
                          : "bg-white/[0.06] text-zinc-200 rounded-tl-none border border-white/[0.06]"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Composer */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-white/[0.07] p-3 space-y-2 bg-[#050609] pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
          >
            <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
              <button
                type="button"
                onClick={() => setStampTimestamp((s) => !s)}
                className={`inline-flex items-center gap-1 font-mono transition-colors ${
                  stampTimestamp ? "text-rose-400 font-semibold" : "text-zinc-500"
                }`}
              >
                <Clock size={10} />
                <span>Stamp at {formattedTime}</span>
              </button>
              <span className="text-zinc-600">Enter to send</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Whisper at this moment…"
                aria-label="Whisper message"
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-base sm:text-xs text-white placeholder-zinc-500 outline-none focus:border-rose-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="rounded-xl bg-white text-zinc-950 px-4 py-2 text-xs font-semibold hover:bg-zinc-200 disabled:opacity-40 transition-all shadow-sm active:scale-95 shrink-0"
              >
                Send
              </button>
            </div>
          </form>
        </aside>
      )}

      {/* WARM RELATIONSHIP COMPLETION PROMPT MODAL */}
      <AnimatePresence>
        {showCompletionPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.12] bg-[#0c0d14]/95 p-6 shadow-2xl text-center space-y-5"
            >
              {/* Header Icon */}
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Film size={26} />
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-rose-400">
                  Movie Night Ended?
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  You watched &ldquo;{title}&rdquo;
                </h3>
                <p className="text-xs text-zinc-400">
                  Did you finish it together?
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingCompletion}
                  onClick={() => void handleConfirmFinished()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-amber-600 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSubmittingCompletion ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>We finished it</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSubmittingCompletion}
                  onClick={() => void handleResumeLater()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-5 py-3 text-sm font-medium text-zinc-200 hover:bg-white/[0.08] hover:text-white disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSubmittingCompletion ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Bookmark size={16} />
                      <span>Not yet — resume later</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <p className="text-[11px] text-zinc-500 text-left">
                  Your unfinished movies can be resumed anytime.
                </p>
                <button
                  type="button"
                  disabled={isSubmittingCompletion}
                  onClick={() => setShowCompletionPrompt(false)}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded transition-colors shrink-0"
                >
                  Keep Watching
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PARTNER COMPLETED NOTIFICATION OVERLAY */}
      <AnimatePresence>
        {partnerCompletedNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              className="w-full max-w-sm rounded-3xl border border-amber-500/25 bg-[#0c0d14]/95 p-6 shadow-2xl text-center space-y-4"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <CheckCircle2 size={28} />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  Movie Night Completed
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  &ldquo;{title}&rdquo; is finished!
                </h3>
                <p className="text-xs text-zinc-300">
                  Your partner marked the movie as finished. It has been added to your Memory Vault for 7 days.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 pt-2">
                <Loader2 size={14} className="animate-spin text-amber-400" />
                <span>Returning to theater…</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DIRECT SYNCHRONIZED MOVIE / VIDEO PLAYER MODAL */}
      <AnimatePresence>
        {showDirectMediaModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full rounded-2xl border border-white/[0.12] bg-[#0c0e15] p-6 shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film size={20} className="text-rose-400" />
                  <h3 className="text-base font-semibold text-white">Direct Movie Player</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDirectMediaModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08]"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Stream any YouTube link (e.g. youtube.com/watch?v=...) or direct video link (MP4, WebM, HLS) in 100% native HD sync on both PC and Mobile without screen recording blur or DRM black screens.
              </p>

              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  YouTube or Video Stream URL
                </label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... or .mp4"
                  value={directMediaInput}
                  onChange={(e) => setDirectMediaInput(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Quick sample open-source free movie links */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Or pick a sample stream:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setDirectMediaInput("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
                    }}
                    className="p-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-left hover:border-rose-500/60 hover:bg-rose-500/20 text-rose-200 transition-colors"
                  >
                    ▶️ YouTube 4K/1080p Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectMediaInput("/souls.mp4");
                    }}
                    className="p-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-left hover:border-rose-500/50 hover:bg-rose-500/10 text-zinc-300 transition-colors"
                  >
                    🎬 Soul Connection (Demo)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectMediaInput("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
                    }}
                    className="p-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-left hover:border-rose-500/50 hover:bg-rose-500/10 text-zinc-300 transition-colors"
                  >
                    🐰 Big Buck Bunny (1080p)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectMediaInput("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4");
                    }}
                    className="p-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-left hover:border-rose-500/50 hover:bg-rose-500/10 text-zinc-300 transition-colors"
                  >
                    🐘 Elephants Dream
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectMediaInput("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4");
                    }}
                    className="p-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-left hover:border-rose-500/50 hover:bg-rose-500/10 text-zinc-300 transition-colors"
                  >
                    🤖 Tears of Steel (Sci-Fi)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectMediaInput("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4");
                    }}
                    className="p-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-left hover:border-rose-500/50 hover:bg-rose-500/10 text-zinc-300 transition-colors"
                  >
                    🐉 Sintel (Fantasy Animation)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                {directMediaUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setDirectMediaUrl(null);
                      setDirectMediaTitle(null);
                      setShowDirectMediaModal(false);
                      void channelRef.current?.send({
                        type: "broadcast",
                        event: "theater:direct-media",
                        payload: { url: null },
                      });
                    }}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Stop Direct Stream
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const url = directMediaInput.trim();
                    if (!url) return;
                    setDirectMediaUrl(url);
                    setDirectMediaTitle("Synchronized Movie");
                    setShowDirectMediaModal(false);
                    void channelRef.current?.send({
                      type: "broadcast",
                      event: "theater:direct-media",
                      payload: { url, title: "Synchronized Movie" },
                    });
                  }}
                  className="rounded-full bg-rose-600 hover:bg-rose-500 px-5 py-2 text-xs font-semibold text-white transition-all shadow-md active:scale-95"
                >
                  Play Together in Sync 🎬
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WebRTC Media Pipeline Diagnostics Modal */}
      <WebRTCDiagnosticInspector
        isOpen={showDiagModal}
        onClose={() => setShowDiagModal(false)}
        localDiag={webrtcDiagStats}
        partnerDiag={partnerDiagStats}
        onRefreshStream={sendViewerReady}
        isHost={isHost}
        forceRelay={forceRelay}
        onToggleForceRelay={toggleForceRelay}
      />
      </div>
    </div>
  );
}
