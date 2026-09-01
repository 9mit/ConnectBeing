"use client";

import { motion } from "framer-motion";
import { Compass, Heart, Navigation } from "lucide-react";

import { LANDING_CHAPTERS } from "@/content/site";

export function SectionDistance() {
  const { aria, words } = LANDING_CHAPTERS.distance;

  return (
    <section className="landing-section relative z-10" aria-label={aria}>
      <div className="mx-auto max-w-3xl text-center px-4 space-y-12">
        {/* Chapter Header Chip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          className="flex justify-center"
        >
          <div className="stardust-pill">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Chapter I · Distance</span>
          </div>
        </motion.div>

        {/* Live Distance Orbital Visualization */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-md mx-auto p-8 rounded-3xl glass-card-luxury border border-amber-500/30 overflow-hidden shadow-2xl"
        >
          {/* Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-amber-500/10 to-rose-600/10 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-4">
            {/* You Node */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-purple-950 font-bold shadow-[0_0_20px_rgba(212,175,55,0.5)]">
                You
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300">Here</span>
            </div>

            {/* Glowing Distance Pulse Beam */}
            <div className="flex-1 flex flex-col items-center relative">
              <div className="w-full h-0.5 bg-gradient-to-r from-amber-400 via-rose-400 to-amber-400 relative overflow-hidden">
                <motion.div
                  className="absolute top-0 bottom-0 w-8 bg-white blur-[2px]"
                  animate={{ left: ["-20%", "120%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 border border-amber-500/30 shadow-inner">
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 animate-pulse" />
                <span className="text-[11px] font-mono font-bold text-amber-200">
                  Zero Space Between Souls
                </span>
              </div>
            </div>

            {/* Partner Node */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center text-white font-bold shadow-[0_0_20px_rgba(244,63,94,0.5)]">
                Partner
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-300">Always</span>
            </div>
          </div>
        </motion.div>

        {/* Poetic Lines */}
        <div className="space-y-6">
          {words.map((word, i) => (
            <motion.p
              key={`${word}-${i}`}
              className="display-lg text-white font-serif tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 1.1, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              {i === 1 ? (
                <span className="glow-text-gold italic font-semibold">{word}</span>
              ) : (
                word
              )}
            </motion.p>
          ))}
        </div>
      </div>
    </section>
  );
}
