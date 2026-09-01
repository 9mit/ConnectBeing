"use client";

import { motion } from "framer-motion";
import { Sparkles, Heart, Dog } from "lucide-react";

import { LANDING_CHAPTERS } from "@/content/site";

export function SectionSpirit() {
  const { aria, lines } = LANDING_CHAPTERS.spirit;

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
            <Dog className="w-3.5 h-3.5 text-amber-400" />
            <span>Chapter V · Living Companion</span>
          </div>
        </motion.div>

        {/* Digital Pet Spirit Companion Visualization */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-sm mx-auto rounded-3xl glass-card-luxury p-8 border border-amber-500/30 shadow-2xl relative overflow-hidden flex flex-col items-center text-center space-y-4"
        >
          {/* Glowing Avatar Orbit */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 to-purple-600 blur-xl opacity-60 animate-pulse" />
            <motion.div
              animate={{ y: [0, -8, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-purple-600 p-0.5 shadow-2xl flex items-center justify-center"
            >
              <div className="w-full h-full rounded-full bg-purple-950/90 flex items-center justify-center text-3xl font-display text-amber-200">
                ((っ˵•́▽•̀˵)っ♥
              </div>
            </motion.div>
          </div>

          <div>
            <h4 className="text-2xl font-serif font-bold text-white text-glow-gold">
              Buddy
            </h4>
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 font-sans">
              State: Thriving · Score: 98/100
            </span>
          </div>

          <p className="text-xs text-slate-300 font-sans font-light leading-relaxed">
            Nurtured together across 342 days of daily check-ins, shared quizzes, and movie nights.
          </p>
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
