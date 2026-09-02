"use client";

import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Heart } from "lucide-react";

import { LANDING_CHAPTERS } from "@/content/site";

export function SectionAi() {
  const { aria, lines } = LANDING_CHAPTERS.intelligence;

  return (
    <section className="landing-section relative py-20 px-4 text-center" aria-label={aria}>
      <div className="mx-auto max-w-4xl flex flex-col items-center space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <div className="sanctuary-pill">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Chapter IV · Relationship Intelligence</span>
          </div>
        </motion.div>

        {/* Luminous Synergy Matrix */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-lg sanctuary-card p-6 text-left space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
            <div>
              <span className="font-semibold text-zinc-100">Couple Synergy &amp; Harmony</span>
              <div className="text-[11px] text-zinc-400">Calculated locally on your devices</div>
            </div>
            <span className="text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
              96% Synergy
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {[
              { label: "Communication Rhythm & Warmth", val: 94 },
              { label: "Quality Time & Movie Nights", val: 98 },
              { label: "Ritual & Milestone Consistency", val: 92 },
            ].map((s) => (
              <div key={s.label} className="space-y-1.5">
                <div className="flex justify-between text-zinc-300">
                  <span>{s.label}</span>
                  <span className="font-semibold text-sky-400">{s.val}%</span>
                </div>
                <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-sky-400 rounded-full"
                    style={{ width: `${s.val}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-black/40 border border-white/10 rounded-lg text-[11px] text-zinc-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Deterministic on-device calculations. Zero private data shared with external LLMs.</span>
          </div>
        </motion.div>

        {/* Narrative Poetic Typography */}
        <div className="space-y-4 pt-2 max-w-2xl">
          <motion.p
            className="display-lg text-[#fbf9f4] tracking-tight"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.8 }}
          >
            Intelligence without a face. <br />
            <span className="italic text-sky-400 font-light">A constellation that learns your story.</span>
          </motion.p>
        </div>
      </div>
    </section>
  );
}
