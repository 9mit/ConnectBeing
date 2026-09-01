"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";

import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";
import { sendNudgeNotificationAction } from "@/actions/nudge";
import { createClient } from "@/lib/supabase/client";

type ConnHealth = "connected" | "reconnecting" | "offline";

type PresenceContextType = {
  partnerOnline: boolean;
  health: ConnHealth;
  nudgePartner: () => Promise<{ ok: boolean; message?: string }>;
  nudgePending: boolean;
};

const PresenceContext = createContext<PresenceContextType>({
  partnerOnline: false,
  health: "offline",
  nudgePartner: async () => ({ ok: false, message: "Not initialized" }),
  nudgePending: false,
});

export function usePresence() {
  return useContext(PresenceContext);
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
  const [nudgePending, setNudgePending] = useState(false);
  const [activeNudge, setActiveNudge] = useState<{
    senderName: string;
    timestamp: string;
  } | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

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
        return;
      }
    });

    const channel = supabase.channel(topic, {
      config: { private: true, presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const others = Object.keys(state).filter((k) => k !== userId);
        setPartnerOnline(others.length > 0);
      })
      .on("broadcast", { event: "nudge" }, ({ payload }) => {
        if (payload && payload.senderId !== userId) {
          setActiveNudge({
            senderName: payload.senderName || "Your partner",
            timestamp: payload.timestamp || new Date().toISOString(),
          });
        }
      });

    channel.subscribe(async (status) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") {
        setHealth("connected");
        await channel.track({ userId, at: Date.now() });
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

    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [coupleId, userId]);

  async function nudgePartner(): Promise<{ ok: boolean; message?: string }> {
    if (!coupleId || !userId) {
      return { ok: false, message: "You are not connected to a couple." };
    }
    setNudgePending(true);
    try {
      const res = await sendNudgeNotificationAction();
      if (!res.ok) {
        return { ok: false, message: res.error.message };
      }
      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "nudge",
          payload: {
            senderId: userId,
            senderName: res.data.senderName,
            timestamp: res.data.timestamp,
          },
        });
      }
      return { ok: true, message: "Notification sent to partner!" };
    } catch {
      return { ok: false, message: "Unable to send nudge." };
    } finally {
      setNudgePending(false);
    }
  }

  return (
    <PresenceContext.Provider
      value={{ partnerOnline, health, nudgePartner, nudgePending }}
    >
      {children}

      {/* Floating Nudge Toast Alert */}
      <AnimatePresence>
        {activeNudge && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-auto"
          >
            <div className="relative overflow-hidden rounded-3xl border border-rose-500/30 bg-[#12040c]/90 p-5 backdrop-blur-2xl shadow-[0_10px_40px_rgba(244,63,94,0.3)] flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/20 text-2xl border border-rose-500/40 animate-bounce">
                ❤️
              </div>
              <div className="flex-1 space-y-0.5">
                <h4 className="text-sm font-extrabold text-white font-display">
                  {activeNudge.senderName} is calling for you!
                </h4>
                <p className="text-xs text-rose-200/80 font-medium">
                  Tap to connect & chat in your private space.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveNudge(null)}
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
