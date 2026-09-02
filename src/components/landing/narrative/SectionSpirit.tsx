"use client";

import { motion } from "framer-motion";
import { Dog, Sparkles } from "lucide-react";

import { LANDING_CHAPTERS } from "@/content/site";

export function SectionSpirit() {
  const { aria, lines } = LANDING_CHAPTERS.spirit;

  return (
    <section className="landing-section relative py-20 px-4 text-center" aria-label={aria}>
      <div className="mx-auto max-w-4xl flex flex-col items-center space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <div className="sanctuary-pill">
            <Dog className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chapter V · Shared Spirit Companion</span>
          </div>
        </motion.div>

        {/* Luminous Spirit Companion Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-sm sanctuary-card p-6 text-center space-y-4"
        >
          <div className="relative flex justify-center py-2">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 via-sky-400 to-purple-600 p-0.5 shadow-xl shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-[#0d0718] flex items-center justify-center text-3xl font-mono text-emerald-300">
                (^•ω•^)
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-serif text-2xl font-bold text-zinc-100">Buddy</h4>
            <span className="text-xs text-emerald-400 font-medium">
              State: Thriving · 342 Days Together
            </span>
          </div>

          <p className="text-xs text-zinc-300 font-sans leading-relaxed">
            Nurtured through daily check-ins, shared quizzes, and movie nights as a pair.
          </p>
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
            Something small wakes between you. <br />
            <span className="italic text-sky-400 font-light">It breathes when you do.</span>
          </motion.p>
        </div>
      </div>
    </section>
  );
}
