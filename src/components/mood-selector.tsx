"use client";

import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { useEffect, useState, useTransition } from "react";

import { getCurrentMoodsAction, setMoodAction } from "@/actions/mood";
import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";

const MOODS = [
  { value: "happy", label: "Happy", emoji: "😊" },
  { value: "cuddles", label: "Cuddles", emoji: "🤗" },
  { value: "space", label: "Space", emoji: "🧘" },
  { value: "excited", label: "Excited", emoji: "✨" },
  { value: "low", label: "Low", emoji: "😔" },
] as const;

export function MoodSelector({ coupleId }: { coupleId: string }) {
  const [mine, setMine] = useState<string | null>(null);
  const [partner, setPartner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void getCurrentMoodsAction().then((r) => {
      if (r.ok) {
        setMine(r.data.mine?.mood ?? null);
        setPartner(r.data.partner?.mood ?? null);
      }
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const topic = `couple:${coupleId}:moods`;
    const channel = supabase.channel(topic, { config: { private: true } });

    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed || !auth.ok) return;
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "moods",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => {
            void getCurrentMoodsAction().then((r) => {
              if (r.ok) {
                setMine(r.data.mine?.mood ?? null);
                setPartner(r.data.partner?.mood ?? null);
              }
            });
          },
        )
        .subscribe();
    });

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [coupleId]);

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        {MOODS.map((m) => (
          <motion.button
            key={m.value}
            type="button"
            whileTap={{ scale: 0.95 }}
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await setMoodAction({ mood: m.value });
                if (!res.ok) {
                  setError(res.error.message);
                  return;
                }
                setMine(m.value);
                setError(null);
              });
            }}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-3.5 text-sm font-semibold transition-all ${
              mine === m.value
                ? "border-amber-400 bg-amber-500/25 text-amber-200 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                : "border-purple-800/40 bg-purple-950/40 text-slate-300 hover:border-amber-500/30 hover:bg-purple-900/40"
            }`}
          >
            <span className="text-2xl">{m.emoji}</span>
            {m.label}
          </motion.button>
        ))}
      </div>
      <p className="text-center text-sm font-semibold text-amber-300">
        Partner Vibe: {partner ? `${MOODS.find((x) => x.value === partner)?.emoji} (${MOODS.find((x) => x.value === partner)?.label})` : "Not set yet"}
      </p>
      {error ? <p className="text-center text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2 rounded-xl">{error}</p> : null}
    </div>
  );
}
