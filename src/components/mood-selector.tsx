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

export function MoodSelector({
  coupleId,
  initialMoods,
}: {
  coupleId: string;
  initialMoods?: { mine: string | null; partner: string | null };
}) {
  const [mine, setMine] = useState<string | null>(initialMoods?.mine ?? null);
  const [partner, setPartner] = useState<string | null>(initialMoods?.partner ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!initialMoods) {
      void getCurrentMoodsAction().then((r) => {
        if (r.ok) {
          setMine(r.data.mine?.mood ?? null);
          setPartner(r.data.partner?.mood ?? null);
        }
      });
    }
  }, [initialMoods]);

  useEffect(() => {
    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const topic = `couple:${coupleId}:moods`;
    const channel = supabase.channel(topic);

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
            className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-medium transition-all ${
              mine === m.value
                ? "border-white/25 bg-white/15 text-white shadow-sm"
                : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/15 hover:bg-white/[0.05] hover:text-zinc-200"
            }`}
          >
            <span className="text-2xl">{m.emoji}</span>
            <span>{m.label}</span>
          </motion.button>
        ))}
      </div>
      <div className="text-center text-xs text-zinc-400 bg-[#0e1017] border border-white/[0.06] rounded-2xl p-4">
        <span>Partner’s current vibe: </span>
        <span className="text-zinc-200 font-medium">
          {partner
            ? `${MOODS.find((x) => x.value === partner)?.emoji} ${MOODS.find((x) => x.value === partner)?.label}`
            : "Not shared yet today"}
        </span>
      </div>
      {error ? (
        <p className="text-center text-xs font-medium text-rose-300 bg-rose-950/40 border border-rose-500/20 px-4 py-2 rounded-xl">
          {error}
        </p>
      ) : null}
    </div>
  );
}
