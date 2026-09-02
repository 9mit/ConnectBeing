"use client";

import { motion } from "framer-motion";
import { Camera, Lock, Clock, Heart, Sparkles, Mic } from "lucide-react";

import { LANDING_CHAPTERS } from "@/content/site";

export function SectionMemories() {
  const { aria, lines } = LANDING_CHAPTERS.memories;

  return (
    <section className="landing-section relative py-20 px-4 text-center" aria-label={aria}>
      <div className="mx-auto max-w-4xl flex flex-col items-center space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <div className="sanctuary-pill">
            <Camera className="w-3.5 h-3.5 text-amber-300" />
            <span>Chapter II · Memory Vault &amp; Time Capsules</span>
          </div>
        </motion.div>

        {/* Luminous Memory Cards */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-4xl text-left"
        >
          {/* Card 1 */}
          <div className="sanctuary-card p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-rose-500/20 via-purple-600/20 to-sky-500/20 flex flex-col items-center justify-center p-4 border border-white/10 relative overflow-hidden">
                <Heart className="w-7 h-7 text-rose-400 fill-rose-400/40 mb-2" />
                <span className="text-xs font-semibold text-zinc-100">First Sunset</span>
              </div>
              <p className="mt-3 text-xs text-zinc-300 font-sans leading-relaxed">
                High-resolution memories encrypted and stored in your private couple vault.
              </p>
            </div>
            <div className="pt-3 border-t border-white/10 flex justify-between text-xs text-zinc-400">
              <span>Sealed in Vault</span>
              <span className="text-sky-300 font-medium">Oct 14</span>
            </div>
          </div>

          {/* Card 2: Time Capsule */}
          <div className="sanctuary-card p-5 flex flex-col justify-between space-y-4 border-amber-400/40 bg-[#160f26]/80 shadow-amber-500/10 shadow-xl">
            <div>
              <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-amber-500/20 to-purple-900/40 flex flex-col items-center justify-center p-4 border border-amber-500/30 relative overflow-hidden">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center mb-2">
                  <Lock className="w-4 h-4 text-amber-300" />
                </div>
                <span className="text-xs font-semibold text-amber-200">Time Capsule</span>
              </div>
              <p className="mt-3 text-xs text-zinc-300 font-sans leading-relaxed">
                Two-way letters and photos that open only when your milestone arrives.
              </p>
            </div>
            <div className="pt-3 border-t border-white/10 flex justify-between text-xs text-amber-300 font-medium">
              <span>Unlocks 1st Anniversary</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: Voice Note */}
          <div className="sanctuary-card p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-sky-500/20 via-indigo-600/20 to-purple-800/20 flex flex-col items-center justify-center p-4 border border-white/10 relative overflow-hidden">
                <Mic className="w-7 h-7 text-sky-400 mb-2" />
                <span className="text-xs font-semibold text-zinc-100">Midnight Audio</span>
              </div>
              <p className="mt-3 text-xs text-zinc-300 font-sans leading-relaxed">
                Whispered voice letters recorded in quiet moments, preserved forever.
              </p>
            </div>
            <div className="pt-3 border-t border-white/10 flex justify-between text-xs text-zinc-400">
              <span>Whispered Note</span>
              <span className="text-sky-300 font-medium">0:48</span>
            </div>
          </div>
        </motion.div>

        {/* Narrative Poetic Lines */}
        <div className="space-y-4 pt-2 max-w-2xl">
          <motion.p
            className="display-lg text-[#fbf9f4] tracking-tight"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.8 }}
          >
            Letters. Light. The sound of a voice. <br />
            <span className="italic text-sky-400 font-light">Everything you keep.</span>
          </motion.p>
        </div>
      </div>
    </section>
  );
}
