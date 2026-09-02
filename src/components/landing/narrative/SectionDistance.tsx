"use client";

import { motion } from "framer-motion";
import { Compass, Radio, Heart } from "lucide-react";

import { LANDING_CHAPTERS } from "@/content/site";

export function SectionDistance() {
  const { aria, words } = LANDING_CHAPTERS.distance;

  return (
    <section className="landing-section relative py-20 px-4 text-center" aria-label={aria}>
      <div className="mx-auto max-w-4xl flex flex-col items-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <div className="sanctuary-pill">
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>Chapter I · Real-Time Distance &amp; Presence</span>
          </div>
        </motion.div>

        {/* Luminous Distance Diagram */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-lg p-6 sanctuary-card text-left space-y-4 relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-xs text-zinc-400 pb-3 border-b border-white/10">
            <span className="text-sky-400 font-semibold">Live Orbit Resonance</span>
            <span>Sub-Second Sync</span>
          </div>

          <div className="p-4 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between gap-4">
            <div className="flex flex-col items-center gap-1.5 text-xs">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-black font-bold shadow-lg shadow-sky-500/30">
                You
              </div>
              <span className="text-zinc-200 font-medium">Here</span>
            </div>

            <div className="flex-1 flex flex-col items-center relative px-2">
              <div className="w-full h-0.5 bg-gradient-to-r from-sky-400 via-rose-400 to-sky-400 relative overflow-hidden">
                <motion.div
                  className="absolute top-0 bottom-0 w-12 bg-white blur-[2px]"
                  animate={{ left: ["-25%", "125%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <div className="mt-2.5 text-[11px] text-zinc-300 flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 animate-pulse" />
                <span>Zero Space Between Souls</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1.5 text-xs">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center text-white font-bold shadow-lg shadow-rose-500/30">
                Partner
              </div>
              <span className="text-zinc-200 font-medium">Always</span>
            </div>
          </div>
        </motion.div>

        {/* Poetic Typography */}
        <div className="space-y-4 pt-2 max-w-2xl">
          <motion.p
            className="display-lg text-[#fbf9f4] tracking-tight"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.8 }}
          >
            Love isn&apos;t found.{" "}
            <span className="italic text-sky-400 font-light">It is built.</span>
          </motion.p>
          <p className="text-sm text-zinc-300 leading-relaxed font-light">
            When you are continents or rooms apart, distance is transformed from an empty gap into an intentional, shared presence.
          </p>
        </div>
      </div>
    </section>
  );
}
