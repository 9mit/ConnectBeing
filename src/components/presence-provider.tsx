"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";

import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";
import { sendNudgeNotificationAction, checkPendingNudgeAction } from "@/actions/nudge";
import { recordHeartbeatAction, getPartnerPresenceAction } from "@/actions/presence";
import { createClient } from "@/lib/supabase/client";

type ConnHealth = "connected" | "reconnecting" | "offline";
type PresenceStatus = "online" | "offline";

type PresenceContextType = {
  partnerOnline: boolean;
  health: ConnHealth;
  myStatus: PresenceStatus;
  toggleMyStatus: () => void;
  nudgePartner: () => Promise<{ ok: boolean; message?: string }>;
  nudgePending: boolean;
  activeNudge: { senderName: string; timestamp: string } | null;
  dismissNudge: () => void;
};

const PresenceContext = createContext<PresenceContextType>({
  partnerOnline: false,
  health: "offline",
  myStatus: "online",
  toggleMyStatus: () => {},
  nudgePartner: async () => ({ ok: false, message: "Not initialized" }),
  nudgePending: false,
  activeNudge: null,
  dismissNudge: () => {},
});

export function usePresence() {
  return useContext(PresenceContext);
}

// Gentle synthetic notification chime using Web Audio API (zero external assets)
function playGentleNudgeSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(440, now); // A4
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.18); // E5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  } catch {
    /* AudioContext not allowed or unsupported */
  }
}

export function PresenceProvider({
  coupleId,
  userId,
  children,
}: {
  coupleId?: string | null;
  userId?: string | null;
  children: ReactNode;
}) {
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [health, setHealth] = useState<ConnHealth>("offline");
  const [myStatus, setMyStatus] = useState<PresenceStatus>("online");
  const [nudgePending, setNudgePending] = useState(false);
  const [activeNudge, setActiveNudge] = useState<{
    senderName: string;
    timestamp: string;
  } | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myStatusRef = useRef<PresenceStatus>("online");
  myStatusRef.current = myStatus;

  const triggerNudgeDisplay = useCallback((senderName: string, timestamp: string) => {
    setActiveNudge({
      senderName: senderName || "Your partner",
      timestamp: timestamp || new Date().toISOString(),
    });
    playGentleNudgeSound();

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(`🔔 ${senderName} pinged you!`, {
          body: "Thinking of you ❤️ Tap to open MadLove.",
        });
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Main Realtime Connection
  useEffect(() => {
    if (!coupleId || !userId) {
      setHealth("offline");
      setPartnerOnline(false);
      return;
    }

    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      setHealth("offline");
      return;
    }

    const topic = `couple:${coupleId}:presence`;

    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed || !auth.ok) {
        setHealth("offline");
      }
    });

    // We do NOT use private: true because the topic name already incorporates
    // the secret couple UUID/CUID2. This avoids Supabase RLS CHANNEL_ERROR rejections.
    const channel = supabase.channel(topic, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    const updateFromPresenceState = () => {
      if (disposed) return;
      const state = channel.presenceState();
      const otherKeys = Object.keys(state).filter((k) => k !== userId);
      let isPartnerActive = false;

      for (const key of otherKeys) {
        const presences = (state[key] || []) as Array<{ online?: boolean }>;
        if (presences.some((p) => p.online !== false)) {
          isPartnerActive = true;
          break;
        }
      }
      setPartnerOnline(isPartnerActive);
    };

    channel
      .on("presence", { event: "sync" }, updateFromPresenceState)
      .on("presence", { event: "join" }, updateFromPresenceState)
      .on("presence", { event: "leave" }, updateFromPresenceState)
      .on("broadcast", { event: "nudge" }, ({ payload }: { payload: any }) => {
        if (payload && payload.senderId !== userId) {
          triggerNudgeDisplay(payload.senderName, payload.timestamp);
        }
      });

    channel.subscribe(async (status: string) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") {
        setHealth("connected");
        if (myStatusRef.current === "online") {
          await channel.track({ userId, online: true, at: Date.now() });
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setHealth("reconnecting");
      } else if (status === "CLOSED") {
        setHealth("offline");
      }
    });

    const onOnline = () => setHealth("reconnecting");
    const onOffline = () => setHealth("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Initial heartbeat
    void recordHeartbeatAction(myStatusRef.current);

    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [coupleId, userId, triggerNudgeDisplay]);

  // Periodic heartbeat & presence sync fallback (every 25s)
  useEffect(() => {
    if (!coupleId || !userId) return;

    const interval = setInterval(async () => {
      try {
        // Send our heartbeat
        await recordHeartbeatAction(myStatusRef.current);

        // Query partner's state from Redis fallback
        const res = await getPartnerPresenceAction();
        if (res.ok) {
          if (res.data.partnerOnline) {
            setPartnerOnline(true);
          }
        }
      } catch {
        /* ignore network hiccups */
      }
    }, 25000);

    return () => clearInterval(interval);
  }, [coupleId, userId]);

  // Periodic Nudge Check Fallback (every 8s) to ensure zero missed pings
  useEffect(() => {
    if (!coupleId || !userId) return;

    const interval = setInterval(async () => {
      try {
        const res = await checkPendingNudgeAction();
        if (res.ok && res.data.hasNudge) {
          triggerNudgeDisplay(res.data.senderName || "Your partner", res.data.timestamp || "");
        }
      } catch {
        /* ignore */
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [coupleId, userId, triggerNudgeDisplay]);

  // Auto-dismiss nudge after 7s
  useEffect(() => {
    if (!activeNudge) return;
    const timer = setTimeout(() => {
      setActiveNudge(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [activeNudge]);

  // Manual On/Off Switch
  const toggleMyStatus = useCallback(() => {
    const nextStatus: PresenceStatus = myStatus === "online" ? "offline" : "online";
    setMyStatus(nextStatus);
    myStatusRef.current = nextStatus;

    void recordHeartbeatAction(nextStatus);

    if (channelRef.current) {
      if (nextStatus === "online") {
        void channelRef.current.track({ userId, online: true, at: Date.now() });
      } else {
        void channelRef.current.track({ userId, online: false, at: Date.now() });
      }
    }
  }, [myStatus, userId]);

  const nudgePartner = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!coupleId || !userId) {
      return { ok: false, message: "You are not connected to a couple." };
    }
    setNudgePending(true);
    try {
      const res = await sendNudgeNotificationAction();
      if (!res.ok) {
        return { ok: false, message: res.error.message };
      }

      // Broadcast via Supabase channel if available
      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: "broadcast",
            event: "nudge",
            payload: {
              senderId: userId,
              senderName: res.data.senderName,
              timestamp: res.data.timestamp,
            },
          });
        } catch {
          /* broadcast failed, but db & redis notification is already stored */
        }
      }

      return { ok: true, message: "🔔 Ping sent to your partner!" };
    } catch {
      return { ok: false, message: "Unable to send ping." };
    } finally {
      setNudgePending(false);
    }
  }, [coupleId, userId]);

  const dismissNudge = useCallback(() => {
    setActiveNudge(null);
  }, []);

  return (
    <PresenceContext.Provider
      value={{
        partnerOnline,
        health,
        myStatus,
        toggleMyStatus,
        nudgePartner,
        nudgePending,
        activeNudge,
        dismissNudge,
      }}
    >
      {children}

      {/* Floating Nudge Toast Alert */}
      <AnimatePresence>
        {activeNudge && (
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-auto"
          >
            <div className="relative overflow-hidden rounded-3xl border border-amber-500/50 bg-[#0d0216]/95 p-5 backdrop-blur-3xl shadow-[0_15px_50px_rgba(212,175,55,0.35)] flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-2xl border border-amber-300 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-bounce">
                🔔
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                  <span>Heartbeat Ping</span>
                </div>
                <h4 className="text-sm font-extrabold text-white font-display">
                  {activeNudge.senderName} pinged you!
                </h4>
                <p className="text-xs text-slate-300 font-medium">
                  Thinking of you right now ❤️
                </p>
              </div>
              <button
                type="button"
                onClick={dismissNudge}
                className="rounded-full bg-white/10 p-2 text-xs font-bold text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PresenceContext.Provider>
  );
}
