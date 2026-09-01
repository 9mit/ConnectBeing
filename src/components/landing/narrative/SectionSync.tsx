"use client";

import { motion } from "framer-motion";
import { Film, Radio, Heart, Sparkles, Volume2 } from "lucide-react";

import { LANDING_CHAPTERS } from "@/content/site";

export function SectionSync() {
  const { aria, lines } = LANDING_CHAPTERS.sync;

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
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <span>Chapter III · Virtual Theater</span>
          </div>
        </motion.div>

        {/* Synchronized Theater Player Simulation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mx-auto rounded-3xl glass-card-luxury p-6 sm:p-8 border border-amber-500/30 shadow-2xl relative overflow-hidden text-left"
        >
          {/* Simulated Screen */}
          <div className="relative aspect-video w-full rounded-2xl bg-gradient-to-br from-purple-950 via-[#100624] to-black border border-white/10 flex flex-col justify-between p-5 overflow-hidden shadow-inner">
            {/* Top Badges */}
            <div className="flex justify-between items-center z-10">
              <div className="flex items-center gap-2 bg-purple-950/80 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] font-bold text-amber-300 uppercase tracking-wider backdrop-blur-md">
                <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
                <span>Synchronized · 4K Stream</span>
              </div>

              <div className="flex items-center -space-x-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 border border-purple-950 flex items-center justify-center text-[10px] font-bold text-purple-950 shadow-md">
                  You
                </div>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 border border-purple-950 flex items-center justify-center text-[10px] font-bold text-white shadow-md">
                  Her
                </div>
              </div>
            </div>

            {/* Center Floating Reactions */}
            <div className="flex justify-center items-center gap-4 py-4 z-10">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="text-4xl filter drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]"
              >
                🍿
              </motion.div>
              <motion.div
                animate={{ y: [0, -14, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                className="text-3xl filter drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]"
              >
                ✨
              </motion.div>
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                className="text-4xl filter drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]"
              >
                ❤️
              </motion.div>
            </div>

            {/* Bottom Controls */}
            <div className="space-y-2 z-10">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-300">
                <span className="font-bold text-amber-200">Interstellar (2014)</span>
                <span>48:20 / 2:49:00</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full w-[35%] bg-gradient-to-r from-amber-400 to-rose-400 rounded-full shadow-[0_0_8px_#fbbf24]" />
              </div>
            </div>
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
