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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

import {
  endWatchSessionAction,
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

type Reaction = { id: string; emoji: string; x: number; y: number };
type WatchMsg = {
  id: string;
  content: string;
  userId: string;
  playbackPosition?: number | null;
  createdAt?: string;
};

const THEATER_REACTIONS = ["❤️", "😂", "🔥", "😱", "👏", "🍿"] as const;

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
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
    updateState,
    startScreenShare,
    stopScreenShare,
    startVoiceCall,
    stopVoiceCall,
    toggleMic,
    remoteVoiceAudioRef,
    notifyPartnerLeaving,
    sendViewerReady,
  } = useTheaterWebRTC({
    sessionId,
    userId,
    isHost,
    initialHostStreamActive,
  });

  // Theater Session & Playback States
  const [playbackState, setPlaybackState] = useState<"playing" | "paused">(() => {
    return initialPlaybackState === "paused" ? "paused" : "playing";
  });
  const [positionSeconds, setPositionSeconds] = useState(initialPosition);
  const [stampTimestamp, setStampTimestamp] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isAutoplayMuted, setIsAutoplayMuted] = useState(false);
  const [userSwitchedToCompanion, setUserSwitchedToCompanion] = useState(false);

  // OTT Mobile & Cinema Player States
  const [estimatedDuration, setEstimatedDuration] = useState(7200);
  const [showControls, setShowControls] = useState(true);
  const [isImmersiveTheater, setIsImmersiveTheater] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [mobileConsoleTab, setMobileConsoleTab] = useState<"whispers" | "controls" | "vibe">("whispers");
  const [skipRipple, setSkipRipple] = useState<{ direction: "left" | "right"; id: number } | null>(null);
  const [playPausePulse, setPlayPausePulse] = useState<"playing" | "paused" | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [showLockPrompt, setShowLockPrompt] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== "undefined") {
        const landscape = window.innerWidth > window.innerHeight && window.innerWidth < 1024;
        setIsLandscape(landscape);
      }
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
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

  // Attach local media stream to local video element (Host)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      void localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // Attach remote media stream to remote video element (Viewer) with robust autoplay mitigation
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;

    if (remoteStream) {
      videoEl.srcObject = remoteStream;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[VirtualRoom] Autoplay blocked, falling back to muted playback:", err);
          videoEl.muted = true;
          setIsAutoplayMuted(true);
          void videoEl.play().catch(() => {});
        });
      }
    } else {
      videoEl.srcObject = null;
      setIsAutoplayMuted(false);
    }
  }, [remoteStream]);

  const handleUnmuteRemote = useCallback(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = false;
      setIsAutoplayMuted(false);
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
    void channelRef.current?.send({
      type: "broadcast",
      event: "theater:playback",
      payload: { userId, state: playbackState, position: clamped },
    });
  }, [estimatedDuration, playbackState, userId]);

  const seekBy = useCallback((delta: number) => {
    setPositionSeconds((prev) => {
      const next = Math.max(0, Math.min(prev + delta, estimatedDuration));
      void channelRef.current?.send({
        type: "broadcast",
        event: "theater:playback",
        payload: { userId, state: playbackState, position: next },
      });
      return next;
    });
  }, [estimatedDuration, playbackState, userId]);

  const togglePlayback = useCallback(() => {
    const next = playbackState === "playing" ? "paused" : "playing";
    setPlaybackState(next);
    setPlayPausePulse(next);
    setTimeout(() => setPlayPausePulse(null), 800);
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
        lastTapRef.current = { time: now, x: clientX, y: clientY };
        setShowControls((prev) => !prev);
        resetControlsTimer();
      }
    },
    [isScreenLocked, resetControlsTimer, seekBy, togglePlayback]
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
        if (payload.state) setPlaybackState(payload.state);
        if (typeof payload.position === "number") setPositionSeconds(payload.position);
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

  const toggleFullscreen = useCallback(() => {
    const isCurrentlyFullscreen = isFullscreen || isImmersiveTheater;
    if (isCurrentlyFullscreen) {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
      setIsImmersiveTheater(false);
      setIsFullscreen(false);
    } else {
      if (cinemaContainerRef.current && cinemaContainerRef.current.requestFullscreen) {
        cinemaContainerRef.current
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {
            // iOS Safari iPhone fallback
            setIsImmersiveTheater(true);
            setIsFullscreen(true);
          });
      } else {
        const activeVideo = isHost ? localVideoRef.current : remoteVideoRef.current;
        if (activeVideo && (activeVideo as any).webkitEnterFullscreen) {
          try {
            (activeVideo as any).webkitEnterFullscreen();
          } catch {
            setIsImmersiveTheater(true);
          }
        } else {
          setIsImmersiveTheater(true);
        }
        setIsFullscreen(true);
      }
    }
  }, [isHost, isFullscreen, isImmersiveTheater]);

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

  const handleLeaveSession = async () => {
    if (isLeaving) return;
    setIsLeaving(true);

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

    if (typeof document !== "undefined" && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
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

    let destination = "/together";
    try {
      if (isHost) {
        const res = await endWatchSessionAction(sessionId);
        if (res.ok) {
          destination = `/together/memory/${sessionId}`;
        }
      } else {
        await leaveWatchSessionAction(sessionId);
      }
    } catch (err) {
      console.error("[VirtualRoom] Leave error:", err);
    }

    window.location.assign(destination);
  };

  // Determine active video stream presence
  const hasActiveStream =
    (roomState === "LIVE" || roomState === "STREAM_CONNECTING") &&
    (isHost ? !!localStream : !!remoteStream);

  // Companion Mode decision:
  // Automatically activate Companion Mode if:
  // 1. User explicitly requested it, OR
  // 2. Room state is explicitly FALLBACK_MODE, OR
  // 3. Current user is Host on a device that CANNOT capture tab/screen (mobile host).
  const isCompanionMode =
    userSwitchedToCompanion ||
    roomState === "FALLBACK_MODE" ||
    (isHost && !canShareScreen && !hasActiveStream);

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

      {/* TOP CINEMA HEADER (Rendered in regular/portrait view; in OTT Fullscreen, the floating auto-hiding HUD handles header controls) */}
      {!isCinemaFullscreen && (
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.07] px-2.5 sm:px-6 bg-[#07090e]/95 backdrop-blur-md z-30 pt-[env(safe-area-inset-top,0px)]">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/together")}
              className="p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/[0.06] transition-colors md:hidden"
              title="Back to Theater"
              aria-label="Back to Theater"
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
              disabled={isLeaving}
              onClick={() => void handleLeaveSession()}
              aria-label="Leave watch session"
              className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 sm:px-3 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors disabled:opacity-60 disabled:cursor-wait inline-flex items-center gap-1"
            >
              {isLeaving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <span>Leave</span>
              )}
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
            {!isHost && isAutoplayMuted && hasActiveStream && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-30"
              >
                <button
                  type="button"
                  onClick={handleUnmuteRemote}
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
            className="relative flex-1 flex items-center justify-center bg-black overflow-hidden min-h-0 cursor-pointer touch-manipulation group"
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

            {/* QUICK EXPAND TO FULLSCREEN IN PORTRAIT MODE */}
            {!isCinemaFullscreen && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                className="absolute bottom-3 right-3 z-30 p-2 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black/90 backdrop-blur-md transition-all shadow-lg active:scale-95 pointer-events-auto"
                title="Enter Fullscreen OTT Mode"
                aria-label="Enter Fullscreen OTT Mode"
              >
                <Maximize2 size={14} />
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
                        toggleFullscreen();
                      }}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                      title="Exit Fullscreen"
                    >
                      <ChevronLeft size={20} />
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

                {/* CENTER HUD: -10s, PLAY/PAUSE, +10s */}
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

                {/* BOTTOM HUD ROW: PROGRESS SLIDER & CONTROLS */}
                <div className="space-y-2 pointer-events-auto pb-[env(safe-area-inset-bottom,0px)]">
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
                          className="text-xl sm:text-2xl hover:scale-125 active:scale-90 transition-transform p-1"
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
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title={isVideoMuted ? "Unmute" : "Mute"}
                      >
                        {isVideoMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFullscreen();
                        }}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title="Exit Fullscreen"
                      >
                        <Minimize2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OTT DOUBLE-TAP SKIP RIPPLE OVERLAYS */}
            {skipRipple?.direction === "left" && (
              <div className="absolute left-8 top-1/2 -translate-y-1/2 z-40 pointer-events-none flex flex-col items-center gap-1 text-white bg-black/75 px-5 py-4 rounded-full border border-white/20 backdrop-blur-md animate-ott-ripple-left shadow-2xl">
                <RotateCcw size={28} />
                <span className="text-xs font-bold font-mono tracking-wider">-10s</span>
              </div>
            )}
            {skipRipple?.direction === "right" && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2 z-40 pointer-events-none flex flex-col items-center gap-1 text-white bg-black/75 px-5 py-4 rounded-full border border-white/20 backdrop-blur-md animate-ott-ripple-right shadow-2xl">
                <RotateCw size={28} />
                <span className="text-xs font-bold font-mono tracking-wider">+10s</span>
              </div>
            )}

            {/* OTT CENTER PLAY/PAUSE MOMENTARY PULSE */}
            {playPausePulse && (
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

            {/* A. HOST VIEW: LOCAL SHARED TAB STREAM */}
            {isHost && (
              <video
                ref={localVideoRef}
                muted={isVideoMuted}
                autoPlay
                playsInline
                className={`h-full w-full object-contain ${
                  hasActiveStream ? "block" : "hidden"
                }`}
              />
            )}

            {/* B. VIEWER VIEW: PERMANENTLY MOUNTED REMOTE WEBRTC VIDEO STREAM */}
            {!isHost && (
              <video
                ref={remoteVideoRef}
                muted={isVideoMuted}
                autoPlay
                playsInline
                className="h-full w-full object-contain"
              />
            )}

            {/* C. HOST SETUP GUIDE (When no stream is live) */}
            {isHost && !hasActiveStream && !isCompanionMode && (
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
                      <p className="text-xs font-medium text-white">Open {providerName}</p>
                      <p className="text-[11px] text-zinc-400">
                        Launch the movie in a dedicated tab and press play.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                      <span className="text-[10px] font-mono text-zinc-400">STEP 2</span>
                      <p className="text-xs font-medium text-white">Share Browser Tab</p>
                      <p className="text-[11px] text-zinc-400">
                        Select the tab where your movie is running.
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <a
                      href={providerSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => updateState("OTT_OPEN")}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-zinc-900 bg-white hover:bg-zinc-200 transition-all shadow-md active:scale-95"
                    >
                      <ExternalLink size={13} /> 1. Open {providerName} ↗
                    </a>

                    <button
                      type="button"
                      onClick={() => void startScreenShare()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-md shadow-rose-600/20 active:scale-95"
                    >
                      <Share2 size={13} /> 2. Share Movie Tab
                    </button>
                  </div>

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

            {/* D. VIEWER WAITING LOUNGE (When viewer is waiting for remote stream) */}
            {!isHost && !hasActiveStream && !isCompanionMode && (
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
                      Your partner is preparing the movie stream. As soon as they share their tab,
                      the theater will play here automatically in high definition.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-zinc-300 bg-white/[0.03] border border-white/[0.06] rounded-full py-2 px-4 w-fit mx-auto">
                    <RefreshCw size={12} className="animate-spin text-rose-400" />
                    <span>
                      {roomState === "STREAM_CONNECTING"
                        ? "Connecting to partner's movie stream…"
                        : "Awaiting partner WebRTC broadcast…"}
                    </span>
                  </div>

                  {/* Manual trigger button if viewer wants to re-check immediately */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => sendViewerReady()}
                      className="text-[11px] text-amber-300/80 hover:text-amber-200 underline transition-colors"
                    >
                      Partner already started? Request stream now ⚡
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
            {roomState === "STREAM_ENDED" && !isCompanionMode && (
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
            {isCompanionMode && (
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

        {/* MOBILE OTT CONSOLE (Portrait Mode below Video Stage) */}
        {!isCinemaFullscreen && (
          <div className="md:hidden flex-1 flex flex-col min-h-0 bg-[#07090e] border-t border-white/[0.08]">
            {/* Console Tabs */}
            <div className="flex items-center justify-around border-b border-white/[0.06] bg-[#0b0c13] px-1 py-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setMobileConsoleTab("whispers")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  mobileConsoleTab === "whispers"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <MessageSquare size={13} />
                <span>Whispers</span>
                {messages.length > 0 && (
                  <span className="text-[10px] font-mono bg-white/[0.08] px-1.5 py-0.2 rounded-full text-zinc-300">
                    {messages.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMobileConsoleTab("vibe")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  mobileConsoleTab === "vibe"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Sparkles size={13} />
                <span>Vibe & Reactions</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileConsoleTab("controls")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  mobileConsoleTab === "controls"
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Sliders size={13} />
                <span>Remote & Sync</span>
              </button>
            </div>

            {/* Tab 1: Live Whispers Stream */}
            {mobileConsoleTab === "whispers" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-1.5 text-zinc-500">
                      <Sparkles size={18} className="text-zinc-600" />
                      <p className="text-xs">No whispers yet.</p>
                      <p className="text-[11px] text-zinc-600 max-w-xs">
                        Whisper your thoughts, reactions, or favorite moments synced to this movie!
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
                            className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed ${
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

                {/* Mobile Composer */}
                <form
                  onSubmit={handleSendMessage}
                  className="border-t border-white/[0.07] p-2.5 space-y-1.5 bg-[#050609] pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
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
                      className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-base sm:text-xs text-white placeholder-zinc-500 outline-none focus:border-rose-500/50 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="rounded-xl bg-white text-zinc-950 px-4 py-2 text-xs font-bold hover:bg-zinc-200 disabled:opacity-40 transition-all shadow-sm active:scale-95 shrink-0"
                    >
                      Send
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab 2: Vibe & Reactions */}
            {mobileConsoleTab === "vibe" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400">
                    Realtime Reactions
                  </span>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Tap an emoji to float it over both your screens in real-time:
                  </p>
                  <div className="grid grid-cols-6 gap-2 mt-3">
                    {THEATER_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => broadcastReaction(emoji)}
                        className="aspect-square rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-2xl hover:bg-white/[0.08] active:scale-90 transition-all shadow-sm"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice Connection Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className={voiceActive ? "text-emerald-400" : "text-zinc-500"} />
                      <span className="text-xs font-semibold text-white">Voice Connection</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      voiceActive ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : "bg-white/[0.04] text-zinc-400 border-white/[0.08]"
                    }`}>
                      {voiceActive ? "Connected" : "Disconnected"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (voiceActive) stopVoiceCall();
                        else void startVoiceCall();
                      }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        voiceActive
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                          : "bg-emerald-500 text-black hover:bg-emerald-400"
                      }`}
                    >
                      {voiceActive ? "Leave Voice Call" : "Connect Voice with Partner"}
                    </button>

                    {voiceActive && (
                      <button
                        type="button"
                        onClick={toggleMic}
                        className={`p-2.5 rounded-xl border transition-all ${
                          micMuted
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            : "bg-white/[0.06] text-white border-white/10 hover:bg-white/12"
                        }`}
                        title={micMuted ? "Unmute" : "Mute"}
                      >
                        {micMuted ? <MicOff size={16} /> : <Mic size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Remote & Sync */}
            {mobileConsoleTab === "controls" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>{formattedTime}</span>
                    <span>{formatSeconds(estimatedDuration)}</span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={estimatedDuration}
                    value={positionSeconds}
                    onChange={(e) => seekToPosition(Number(e.target.value))}
                    className="ott-slider w-full"
                    aria-label="Seek position"
                  />

                  <div className="flex items-center justify-center gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => seekBy(-10)}
                      className="p-3 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white active:scale-95 transition-all"
                      title="Rewind 10s"
                    >
                      <RotateCcw size={18} />
                    </button>

                    <button
                      type="button"
                      onClick={togglePlayback}
                      className="w-12 h-12 rounded-full bg-white text-zinc-950 flex items-center justify-center hover:bg-zinc-200 active:scale-95 transition-all shadow-md"
                      title={playbackState === "playing" ? "Pause" : "Play"}
                    >
                      {playbackState === "playing" ? <Pause size={20} /> : <Play size={20} className="translate-x-0.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => seekBy(10)}
                      className="p-3 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white active:scale-95 transition-all"
                      title="Forward 10s"
                    >
                      <RotateCw size={18} />
                    </button>
                  </div>
                </div>

                {/* Quick Launch OTT App */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400">
                      Launch Native App
                    </span>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Open directly in your mobile {providerName} app:
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={nativeAppDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 transition-all shadow-sm active:scale-95"
                    >
                      <ExternalLink size={13} /> Open {providerName} ↗
                    </a>

                    <button
                      type="button"
                      onClick={() => setUserSwitchedToCompanion((c) => !c)}
                      className="px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-medium text-zinc-300 hover:text-white"
                    >
                      {isCompanionMode ? "Lounge Mode" : "Companion Mode"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MOBILE CHAT BACKDROP OVERLAY */}
        {chatOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setChatOpen(false)}
          />
        )}

        {/* 2. CHAT SIDEBAR (DOCKED ON DESKTOP, SLIDE-OVER ON LANDSCAPE/FULLSCREEN) */}
        {chatOpen && (
          <aside
            className="fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] border-l border-white/[0.1] bg-[#07090e]/95 backdrop-blur-2xl shadow-2xl flex flex-col transition-all duration-300 ease-out md:static md:z-20 md:h-full md:w-80 md:w-[28%] md:min-w-[280px] md:max-w-sm md:rounded-none md:border-t-0 md:border-l md:shadow-none"
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
      </div>
    </div>
  );
}
