"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  FastForward,
  Rewind,
  Phone,
  ExternalLink,
  Tv,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { endWatchSessionAction, joinWatchSessionAction, sendWatchMessageAction } from "@/actions/together";
import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";
import { createClient } from "@/lib/supabase/client";
import { getProvider } from "@/features/together/providers";
import {
  SyncProtocolManager,
  SyncMessage,
  DriftReport,
  SYNC_CONFIG,
} from "@/features/together/sync/protocol";
import { CapabilityLevel, PlaybackState } from "@/features/together/providers/types";

type Reaction = { id: string; emoji: string; x: number; y: number };
type WatchMsg = { id: string; content: string; userId: string; playbackPosition?: number | null };

export function VirtualRoom({
  sessionId,
  userId,
  partnerId,
  providerName = "JioHotstar",
  title,
  theme = "rose-dusk",
}: {
  sessionId: string;
  userId: string;
  partnerId?: string;
  coupleId?: string;
  providerName?: string;
  title: string;
  theme?: string;
  decor?: Record<string, unknown>;
}) {
  const router = useRouter();

  // Find provider adapter from registry
  const provider = useMemo(() => {
    return getProvider(providerName.toLowerCase()) || getProvider("jiohotstar");
  }, [providerName]);

  const capabilityLevel: CapabilityLevel = provider?.capabilityLevel || 3;

  // Sync Protocol Manager
  const protocol = useMemo(() => new SyncProtocolManager(sessionId, userId), [sessionId, userId]);

  const [state, setState] = useState<"playing" | "paused" | "buffering" | "idle">("idle");
  const [position, setPosition] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [partnerReady, setPartnerReady] = useState(false);
  const [drift, setDrift] = useState<DriftReport>({
    localPos: 0,
    remotePos: 0,
    driftSeconds: 0,
    inSync: true,
    requiresCorrection: false,
  });

  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [messages, setMessages] = useState<WatchMsg[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const stateRef = useRef(state);
  stateRef.current = state;
  const positionRef = useRef(position);
  positionRef.current = position;

  const reactionTimers = useRef<number[]>([]);
  const internalTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // Join session participant record on mount
  useEffect(() => {
    void joinWatchSessionAction(sessionId);
  }, [sessionId]);

  // Synchronized countdown runner
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = window.setTimeout(() => {
        setCountdown((c) => (c !== null ? c - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setState("playing");
      setCountdown(null);
    }
  }, [countdown]);

  // Main Realtime Connection & Protocol Event Handlers
  useEffect(() => {
    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const topic = `room:${sessionId}`;
    const channel = supabase.channel(topic, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    const applyReaction = (emoji: string) => {
      const r: Reaction = {
        id: Math.random().toString(36),
        emoji,
        x: 20 + Math.random() * 60,
        y: 75 + Math.random() * 20,
      };
      setReactions((prev) => [...prev, r]);
      reactionTimers.current.push(
        window.setTimeout(() => {
          setReactions((prev) => prev.filter((x) => x.id !== r.id));
        }, 2200),
      );
    };

    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed || !auth.ok) return;

      channel
        .on("broadcast", { event: "protocol_sync" }, ({ payload }: { payload: any }) => {
          const validated = protocol.processIncoming(payload as SyncMessage);
          if (!validated) return;

          switch (validated.type) {
            case "COUNTDOWN_START": {
              setCountdown(validated.countdown ?? SYNC_CONFIG.COUNTDOWN_DURATION_SECONDS);
              setPosition(validated.position);
              break;
            }
            case "PLAY": {
              setState("playing");
              const target = protocol.calculateTargetPosition(validated);
              const report = protocol.evaluateDrift(positionRef.current, target);
              setDrift(report);
              if (report.requiresCorrection) {
                setPosition(Math.round(target));
              }
              break;
            }
            case "PAUSE": {
              setState("paused");
              setPosition(validated.position);
              setDrift({
                localPos: positionRef.current,
                remotePos: validated.position,
                driftSeconds: Math.abs(positionRef.current - validated.position),
                inSync: true,
                requiresCorrection: false,
              });
              break;
            }
            case "SEEK": {
              setPosition(validated.position);
              setState(validated.state);
              break;
            }
            case "READY_STATE": {
              setPartnerReady(!!validated.isReady);
              break;
            }
            case "HEARTBEAT_PING": {
              const pong = protocol.handlePing(validated);
              void channel.send({ type: "broadcast", event: "protocol_sync", payload: pong });
              break;
            }
            case "HEARTBEAT_PONG": {
              protocol.handlePong(validated);
              break;
            }
            case "STATE_SYNC": {
              const target = protocol.calculateTargetPosition(validated);
              const report = protocol.evaluateDrift(positionRef.current, target);
              setDrift(report);
              if (report.requiresCorrection) {
                setPosition(Math.round(target));
              }
              break;
            }
          }
        })
        .on("broadcast", { event: "reaction" }, ({ payload }: { payload: any }) => {
          if (payload.userId === userId) return;
          applyReaction(payload.emoji);
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
            };
            setMessages((prev) => [
              ...prev,
              {
                id: row.id,
                content: row.content,
                userId: row.user_id,
                playbackPosition: row.playback_position,
              },
            ]);
          },
        )
        .subscribe();
    });

    // Lightweight periodic heartbeat ping every 12s
    heartbeatTimerRef.current = window.setInterval(() => {
      if (channelRef.current) {
        const ping = protocol.createEvent("HEARTBEAT_PING", stateRef.current, positionRef.current);
        void channelRef.current.send({
          type: "broadcast",
          event: "protocol_sync",
          payload: ping,
        });
      }
    }, SYNC_CONFIG.HEARTBEAT_INTERVAL_MS);

    const timersRef = reactionTimers;
    return () => {
      disposed = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [sessionId, userId, protocol]);

  // Local playback progression timer
  useEffect(() => {
    if (state === "playing") {
      internalTimerRef.current = window.setInterval(() => {
        setPosition((p) => p + 1);
      }, 1000);
    } else if (internalTimerRef.current) {
      clearInterval(internalTimerRef.current);
    }
    return () => {
      if (internalTimerRef.current) clearInterval(internalTimerRef.current);
    };
  }, [state]);

  // Dispatch authoritative protocol sync event
  const dispatchEvent = (
    type: "PLAY" | "PAUSE" | "SEEK" | "COUNTDOWN_START",
    targetState: PlaybackState,
    targetPos: number,
  ) => {
    const event = protocol.createEvent(type, targetState, targetPos, {
      countdown: type === "COUNTDOWN_START" ? SYNC_CONFIG.COUNTDOWN_DURATION_SECONDS : undefined,
    });

    if (type === "COUNTDOWN_START") {
      setCountdown(SYNC_CONFIG.COUNTDOWN_DURATION_SECONDS);
    } else {
      setState(targetState);
      setPosition(targetPos);
    }

    void channelRef.current?.send({
      type: "broadcast",
      event: "protocol_sync",
      payload: event,
    });
  };

  const handleToggleReady = () => {
    const next = !partnerReady;
    setPartnerReady(next);
    const event = protocol.createEvent("READY_STATE", state, position, { isReady: next });
    void channelRef.current?.send({
      type: "broadcast",
      event: "protocol_sync",
      payload: event,
    });
  };

  const formattedTime = useMemo(() => {
    const hrs = Math.floor(position / 3600);
    const mins = Math.floor((position % 3600) / 60);
    const secs = position % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }, [position]);

  const providerSearchUrl = useMemo(() => {
    const cleanTitle = encodeURIComponent(title);
    const id = providerName.toLowerCase();
    if (id.includes("hotstar")) return `https://www.hotstar.com/in/search?q=${cleanTitle}`;
    if (id.includes("netflix")) return `https://www.netflix.com/search?q=${cleanTitle}`;
    if (id.includes("prime")) return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${cleanTitle}`;
    if (id.includes("disney")) return `https://www.disneyplus.com/search?q=${cleanTitle}`;
    if (id.includes("apple")) return `https://tv.apple.com/search?term=${cleanTitle}`;
    if (id.includes("sonyliv")) return `https://www.sonyliv.com/search/${cleanTitle}`;
    if (id.includes("zee5")) return `https://www.zee5.com/search?q=${cleanTitle}`;
    if (id.includes("crunchyroll")) return `https://www.crunchyroll.com/search?q=${cleanTitle}`;
    return `https://www.youtube.com/results?search_query=${cleanTitle}`;
  }, [providerName, title]);

  const themeClass =
    theme === "violet-night"
      ? "from-violet-950 via-zinc-950 to-[#060204]"
      : theme === "amber-glow"
        ? "from-amber-950 via-zinc-950 to-[#060204]"
        : "from-rose-950 via-zinc-950 to-[#060204]";

  return (
    <div
      className="relative flex h-full min-h-[70vh] flex-col overflow-hidden rounded-2xl bg-[#06070a] border border-white/[0.08] shadow-2xl"
    >
      {/* Synchronized 3-2-1 Countdown Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-400 mb-2">
              Synchronizing Playback
            </span>
            <motion.div
              key={countdown}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              className="font-serif text-7xl sm:text-9xl font-light text-[#f7f6f2]"
            >
              {countdown > 0 ? countdown : "PLAY"}
            </motion.div>
            <p className="mt-4 text-xs text-zinc-400 font-light">
              Screens are locking to play at the exact same instant
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header & Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] px-5 py-3 gap-2 bg-[#090a0f]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: provider?.brandColor || "#7dd3fc" }}
          />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs sm:text-sm font-medium text-[#f7f6f2]">{title}</p>
              <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                {providerName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
              <span>{formattedTime}</span>
              <span>·</span>
              <span className={state === "playing" ? "text-emerald-400" : "text-amber-300"}>
                {state.toUpperCase()}
              </span>
              <span>·</span>
              <span>DRIFT: ±{drift.driftSeconds}s</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Partner Readiness Toggle */}
          <button
            type="button"
            onClick={handleToggleReady}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all ${
              partnerReady
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-white/[0.02] border-white/[0.08] text-zinc-300 hover:text-white"
            }`}
          >
            <CheckCircle2 size={12} />
            <span>{partnerReady ? "Partner Ready" : "Set Ready"}</span>
          </button>

          <Link
            href="/call"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-xs text-zinc-300 hover:text-white transition-colors"
          >
            <Phone size={12} /> <span>Voice Call</span>
          </Link>

          <button
            type="button"
            onClick={() =>
              void endWatchSessionAction(sessionId).then(() =>
                router.push(`/together/memory/${sessionId}`),
              )
            }
            className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/20 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Main Theater Centerpiece & Reaction Canvas */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        {/* Floating Emoji Reactions */}
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.span
              key={r.id}
              initial={{ opacity: 0, y: 30, scale: 0.6 }}
              animate={{ opacity: 1, y: -70, scale: 1.1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="pointer-events-none absolute text-3xl select-none"
              style={{ left: `${r.x}%`, top: `${r.y}%` }}
            >
              {r.emoji}
            </motion.span>
          ))}
        </AnimatePresence>

        {/* Private Cinema Center Hub */}
        <div className="z-10 max-w-md w-full rounded-2xl bg-[#0d0f15]/90 border border-white/[0.08] p-6 backdrop-blur-xl shadow-2xl space-y-4 text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg"
            style={{
              backgroundColor: provider?.brandColor ? `${provider.brandColor}22` : "#ffffff11",
              border: `1px solid ${provider?.brandColor || "#ffffff"}33`,
            }}
          >
            <Tv size={24} style={{ color: provider?.brandColor || "#ffffff" }} />
          </div>

          <div>
            <h3 className="text-xl font-serif font-light text-[#f7f6f2]">{title}</h3>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                {providerName}
              </span>
              <span className="text-[10px] text-zinc-600">·</span>
              <span className="text-[11px] text-amber-200/90 flex items-center gap-1 font-sans">
                <ShieldCheck size={12} />
                <span>Synchronized Theater Room</span>
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-400 font-light leading-relaxed">
            Open the movie in your streaming app or tab. This sanctuary synchronizes your
            timeline, instant whispers, reactions, and post-movie memory archive.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
            <a
              href={providerSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold text-[#07080b] bg-[#f7f6f2] hover:bg-white transition-all shadow-sm"
            >
              <ExternalLink size={13} /> Open {providerName} ↗
            </a>

            <button
              type="button"
              onClick={() => dispatchEvent("COUNTDOWN_START", "playing", position)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] transition-colors"
            >
              <Sparkles size={13} className="text-amber-300" /> Start 3-2-1 Countdown
            </button>
          </div>
        </div>
      </div>

      {/* Master Playback Remote Controls & Reaction Bar */}
      <div className="border-t border-white/[0.06] bg-[#090a0f]/90 backdrop-blur-md px-5 py-3 space-y-3">
        {/* Timeline Slider */}
        <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
          <span>{formattedTime}</span>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer">
            <div
              className="h-full bg-gradient-to-r from-amber-200 to-rose-200"
              style={{ width: `${Math.min(100, (position / 7200) * 100)}%` }}
            />
          </div>
          <span className="text-zinc-500">Shared Timeline</span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Play/Pause/Scrub */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => dispatchEvent("SEEK", state, Math.max(0, position - 10))}
              className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Rewind 10 seconds"
            >
              <Rewind size={16} />
            </button>

            <button
              type="button"
              onClick={() =>
                dispatchEvent(
                  state === "playing" ? "PAUSE" : "PLAY",
                  state === "playing" ? "paused" : "playing",
                  position,
                )
              }
              className="p-2.5 rounded-full bg-[#f7f6f2] text-[#07080b] hover:bg-white transition-all shadow-sm"
              title={state === "playing" ? "Pause" : "Play"}
            >
              {state === "playing" ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <button
              type="button"
              onClick={() => dispatchEvent("SEEK", state, position + 10)}
              className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Fast forward 10 seconds"
            >
              <FastForward size={16} />
            </button>
          </div>

          {/* Emoji Reactions Strip */}
          <div className="flex items-center gap-1">
            {["❤️", "😂", "🔥", "👏", "🍿", "🥺", "😱"].map((e) => (
              <button
                key={e}
                type="button"
                className="text-base hover:scale-125 transition-transform p-1 opacity-85 hover:opacity-100"
                onClick={() =>
                  void channelRef.current?.send({
                    type: "broadcast",
                    event: "reaction",
                    payload: { userId, emoji: e },
                  })
                }
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timestamped Whisper Message Log */}
      <div className="max-h-24 space-y-1 overflow-y-auto border-t border-white/[0.06] px-5 py-2 text-xs text-zinc-300 bg-[#07080b]/90 scrollbar-none">
        {messages.length === 0 ? (
          <p className="text-zinc-500 italic text-center py-1">
            Whispers sent here are synced to the exact movie second.
          </p>
        ) : (
          messages.map((m) => (
            <p key={m.id} className="flex items-baseline gap-2">
              <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
                {m.playbackPosition
                  ? `${Math.floor(m.playbackPosition / 60)}:${String(m.playbackPosition % 60).padStart(2, "0")}`
                  : formattedTime}
              </span>
              <span className="text-zinc-400 font-medium">
                {m.userId === userId ? "You" : "Partner"}:
              </span>
              <span className="text-zinc-200">{m.content}</span>
            </p>
          ))
        )}
      </div>

      {/* Message Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newMessage.trim()) return;
          void sendWatchMessageAction({
            sessionId,
            content: newMessage,
            playbackPosition: position,
          }).then(() => setNewMessage(""));
        }}
        className="flex gap-2 border-t border-white/[0.06] p-3 bg-[#090a0f]"
      >
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Whisper to your partner at this moment…"
          className="flex-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-[#f7f6f2] placeholder-zinc-500 outline-none focus:border-white/20 transition-colors"
        />
        <button
          type="submit"
          className="rounded-full bg-[#f7f6f2] text-[#07080b] px-4 py-2 text-xs font-semibold hover:bg-white transition-all"
        >
          Send
        </button>
      </form>
    </div>
  );
}
