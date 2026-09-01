"use client";

import { motion } from "framer-motion";
import { Camera, Lock, Sparkles, Heart, Clock } from "lucide-react";

import { LANDING_CHAPTERS } from "@/content/site";

export function SectionMemories() {
  const { aria, lines } = LANDING_CHAPTERS.memories;

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
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>Chapter II · Memory Vault</span>
          </div>
        </motion.div>

        {/* 3D Floating Memory Cards & Time Capsule Preview */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto text-left"
        >
          {/* Card 1: Polaroid Memory */}
          <div className="polaroid-card p-4 rounded-3xl transform -rotate-2 hover:rotate-0 transition-transform duration-300">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-rose-500/20 via-purple-600/20 to-amber-500/20 flex flex-col items-center justify-center p-4 border border-white/10 relative overflow-hidden">
              <Heart className="w-8 h-8 text-rose-400 fill-rose-400/30 mb-2" />
              <span className="text-[10px] font-sans uppercase font-bold tracking-widest text-amber-200">
                First Sunset
              </span>
            </div>
            <div className="mt-3 flex justify-between items-center px-1">
              <span className="text-xs font-serif text-slate-200">Sealed in Vault</span>
              <span className="text-[10px] font-mono text-amber-400/80">Oct 14</span>
            </div>
          </div>

          {/* Card 2: Time Capsule (Locked) */}
          <div className="polaroid-card p-4 rounded-3xl transform sm:translate-y-4 hover:translate-y-0 transition-transform duration-300 border-amber-500/30 bg-purple-950/60 shadow-[0_0_30px_rgba(212,175,55,0.15)]">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-900/40 flex flex-col items-center justify-center p-4 border border-amber-500/30 relative overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center mb-2 shadow-inner">
                <Lock className="w-4 h-4 text-amber-300" />
              </div>
              <span className="text-[10px] font-sans uppercase font-bold tracking-widest text-amber-300">
                Time Capsule
              </span>
            </div>
            <div className="mt-3 flex justify-between items-center px-1">
              <span className="text-xs font-serif text-amber-200 font-bold">Unlocks 1st Anniversary</span>
              <Clock className="w-3 h-3 text-amber-400" />
            </div>
          </div>

          {/* Card 3: Voice Letter */}
          <div className="polaroid-card p-4 rounded-3xl transform rotate-2 hover:rotate-0 transition-transform duration-300">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-cyan-500/20 via-indigo-600/20 to-purple-800/20 flex flex-col items-center justify-center p-4 border border-white/10 relative overflow-hidden">
              <Sparkles className="w-8 h-8 text-cyan-300 mb-2" />
              <span className="text-[10px] font-sans uppercase font-bold tracking-widest text-cyan-200">
                Midnight Audio
              </span>
            </div>
            <div className="mt-3 flex justify-between items-center px-1">
              <span className="text-xs font-serif text-slate-200">Whispered Note</span>
              <span className="text-[10px] font-mono text-cyan-400/80">0:48</span>
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
            className="display-md text-slate-300 font-serif"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.9 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.3, delay: 0.2 }}
          >
            {lines[1]}
          </motion.p>
          <motion.p
            className="display-lg text-white font-serif tracking-tight pt-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.2, delay: 0.4 }}
          >
            <span className="glow-text-gold italic font-medium">{lines[2]}</span>
          </motion.p>
        </div>
      </div>
    </section>
  );
}
