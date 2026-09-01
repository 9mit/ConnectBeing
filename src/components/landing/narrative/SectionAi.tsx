"use client";

import { motion } from "framer-motion";
import { Brain, Sparkles, ShieldCheck, Heart, Zap } from "lucide-react";

import { LANDING_CHAPTERS } from "@/content/site";

export function SectionAi() {
  const { aria, lines } = LANDING_CHAPTERS.intelligence;

  return (
    <section className="landing-section relative z-10" aria-label={aria}>
      <div className="mx-auto max-w-4xl text-center px-4 space-y-12">
        {/* Chapter Header Chip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          className="flex justify-center"
        >
          <div className="stardust-pill">
            <Brain className="w-3.5 h-3.5 text-amber-400" />
            <span>Chapter IV · Relationship Intelligence</span>
          </div>
        </motion.div>

        {/* Synergy Radar Matrix Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl mx-auto rounded-3xl glass-card-luxury p-6 sm:p-8 border border-amber-500/30 shadow-2xl relative overflow-hidden text-left space-y-6"
        >
          {/* Header */}
          <div className="flex justify-between items-center border-b border-amber-500/20 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Local On-Device Engine
              </span>
              <h3 className="text-xl font-bold font-serif text-white text-glow-gold mt-0.5">
                Couple Synergy & Resonance
              </h3>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold text-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>96% Synergy</span>
            </div>
          </div>

          {/* Metric Bars */}
          <div className="space-y-4">
            {[
              { label: "Communication Rhythm", value: 94, icon: "💬" },
              { label: "Quality Time & Movie Nights", value: 98, icon: "🍿" },
              { label: "Ritual & Milestone Consistency", value: 92, icon: "🕯️" },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1.5 font-sans">
                <div className="flex justify-between text-xs font-semibold text-slate-200">
                  <span className="flex items-center gap-2">
                    <span>{stat.icon}</span>
                    <span>{stat.label}</span>
                  </span>
                  <span className="font-bold text-amber-300 font-mono">{stat.value}%</span>
                </div>
                <div className="h-2 w-full bg-purple-950/80 rounded-full overflow-hidden border border-amber-500/20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 shadow-[0_0_8px_#fbbf24]"
                    style={{ width: `${stat.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Privacy Guarantee Footer */}
          <div className="flex items-center gap-2 pt-2 text-[11px] text-slate-300 font-sans border-t border-amber-500/15">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Deterministic on-device calculations. No private chat data is ever shared with external LLMs.</span>
          </div>
        </motion.div>

        {/* Narrative Poetic Typography */}
        <div className="space-y-6 pt-4 max-w-2xl mx-auto">
          <motion.p
            className="display-md text-white font-serif"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.3 }}
          >
            {lines[0]}
          </motion.p>
          <motion.p
            className="display-lg text-white font-serif tracking-tight"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.3, delay: 0.3 }}
          >
            <span className="glow-text-gold italic font-medium">{lines[1]}</span>
          </motion.p>
        </div>
      </div>
    </section>
  );
}
