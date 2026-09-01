"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, FastForward, Rewind, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { endWatchSessionAction, sendWatchMessageAction } from "@/actions/together";
import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";
import { createClient } from "@/lib/supabase/client";

type SyncState = {
  state: "playing" | "paused" | "idle";
  position: number;
  updatedAt: number;
};

type Reaction = { id: string; emoji: string; x: number; y: number };
type WatchMsg = { id: string; content: string; userId: string };

export function VirtualRoom({
  sessionId,
  userId,
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
  const [sync, setSync] = useState<SyncState>({
    state: "idle",
    position: 0,
    updatedAt: Date.now(),
  });
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [messages, setMessages] = useState<WatchMsg[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const reactionTimers = useRef<number[]>([]);
  const internalTimerRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  useEffect(() => {
    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const topic = `room:${sessionId}`;
    const channel = supabase.channel(topic, { config: { private: true } });
    channelRef.current = channel;

    const applyReaction = (emoji: string) => {
      const r: Reaction = {
        id: Math.random().toString(36),
        emoji,
        x: 20 + Math.random() * 60,
        y: 80 + Math.random() * 20,
      };
      setReactions((prev) => [...prev, r]);
      reactionTimers.current.push(
        window.setTimeout(() => {
          setReactions((prev) => prev.filter((x) => x.id !== r.id));
        }, 2000),
      );
    };

    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed || !auth.ok) return;
      channel
        .on("broadcast", { event: "sync" }, ({ payload }) => {
          if (payload.userId === userId) return;
          setSync(payload.sync);
        })
        .on("broadcast", { event: "reaction" }, ({ payload }) => {
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
          (payload) => {
            const row = payload.new as {
              id: string;
              content: string;
              user_id: string;
            };
            setMessages((prev) => [
              ...prev,
              { id: row.id, content: row.content, userId: row.user_id },
            ]);
          },
        )
        .subscribe();
    });

    const timersRef = reactionTimers;
    return () => {
      disposed = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [sessionId, userId]);

  useEffect(() => {
    if (sync.state === "playing") {
      internalTimerRef.current = window.setInterval(() => {
        setSync((prev) => ({ ...prev, position: prev.position + 1 }));
      }, 1000);
    } else if (internalTimerRef.current) {
      clearInterval(internalTimerRef.current);
    }
    return () => {
      if (internalTimerRef.current) clearInterval(internalTimerRef.current);
    };
  }, [sync.state]);

  const broadcastSync = (next: SyncState) => {
    setSync(next);
    void channelRef.current?.send({
      type: "broadcast",
      event: "sync",
      payload: { userId, sync: next },
    });
  };

  const themeClass =
    theme === "violet-night"
      ? "from-violet-950 via-zinc-950 to-[#060204]"
      : theme === "amber-glow"
        ? "from-amber-950 via-zinc-950 to-[#060204]"
        : "from-rose-950 via-zinc-950 to-[#060204]";

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br ${themeClass} border border-white/10`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-400">
            {Math.floor(sync.position / 60)}:
            {String(sync.position % 60).padStart(2, "0")} · {sync.state}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/call"
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
          >
            <Phone size={14} /> Voice on Call
          </Link>
          <button
            type="button"
            onClick={() =>
              void endWatchSessionAction(sessionId).then(() =>
                router.push(`/together/memory/${sessionId}`),
              )
            }
            className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs text-red-200"
          >
            End
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.span
              key={r.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: -40 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute text-3xl"
              style={{ left: `${r.x}%`, top: `${r.y}%` }}
            >
              {r.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/10 py-3">
        <button
          type="button"
          onClick={() =>
            broadcastSync({
              ...sync,
              position: Math.max(0, sync.position - 10),
              updatedAt: Date.now(),
            })
          }
          aria-label="Rewind"
        >
          <Rewind size={18} className="text-slate-300" />
        </button>
        <button
          type="button"
          onClick={() =>
            broadcastSync({
              state: sync.state === "playing" ? "paused" : "playing",
              position: sync.position,
              updatedAt: Date.now(),
            })
          }
          aria-label="Play pause"
        >
          {sync.state === "playing" ? (
            <Pause size={22} className="text-white" />
          ) : (
            <Play size={22} className="text-white" />
          )}
        </button>
        <button
          type="button"
          onClick={() =>
            broadcastSync({
              ...sync,
              position: sync.position + 10,
              updatedAt: Date.now(),
            })
          }
          aria-label="Forward"
        >
          <FastForward size={18} className="text-slate-300" />
        </button>
        {["❤️", "😂", "🔥", "👏"].map((e) => (
          <button
            key={e}
            type="button"
            className="text-lg"
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

      <div className="max-h-28 space-y-1 overflow-y-auto border-t border-white/10 px-3 py-2 text-xs text-slate-300">
        {messages.map((m) => (
          <p key={m.id}>
            <span className="text-slate-500">
              {m.userId === userId ? "You" : "Partner"}:
            </span>{" "}
            {m.content}
          </p>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newMessage.trim()) return;
          void sendWatchMessageAction({
            sessionId,
            content: newMessage,
            playbackPosition: sync.position,
          }).then(() => setNewMessage(""));
        }}
        className="flex gap-2 border-t border-white/10 p-3"
      >
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Say something…"
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-white outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white"
        >
          Send
        </button>
      </form>
    </div>
  );
}
