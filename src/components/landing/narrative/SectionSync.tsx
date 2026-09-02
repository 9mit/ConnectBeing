"use client";

import { motion } from "framer-motion";
import { Film, Radio, Play, Pause, Heart } from "lucide-react";

import { LANDING_CHAPTERS } from "@/content/site";

export function SectionSync() {
  const { aria, lines } = LANDING_CHAPTERS.sync;

  return (
    <section className="landing-section relative py-20 px-4 text-center" aria-label={aria}>
      <div className="mx-auto max-w-4xl flex flex-col items-center space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <div className="sanctuary-pill">
            <Film className="w-3.5 h-3.5 text-rose-400" />
            <span>Chapter III · Virtual 4K Theater</span>
          </div>
        </motion.div>

        {/* Luminous Theater Deck */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-2xl sanctuary-card p-6 text-left space-y-4"
        >
          <div className="p-6 rounded-xl bg-gradient-to-br from-purple-950/70 via-black/80 to-sky-950/50 border border-white/10 flex flex-col justify-between min-h-[220px] space-y-4">
            <div className="flex justify-between items-center text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span className="font-semibold">Synchronized Streaming Room</span>
              </div>
              <div className="text-sky-400 font-mono text-[11px]">Sub-Frame Sync</div>
            </div>

            <div className="text-center py-4 space-y-1">
              <h4 className="font-serif text-2xl text-zinc-100 font-bold">Midnight in Paris</h4>
              <p className="text-xs text-zinc-400">Zero audio lag · Shared live reactions</p>
            </div>

            <div className="space-y-2">
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-rose-400 via-purple-400 to-sky-400 w-[74%]" />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>01:34:12</span>
                <span className="text-emerald-400">Both Devices Locked</span>
                <span>02:10:00</span>
              </div>
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
            When one moves… <br />
            <span className="italic text-sky-400 font-light">the other already knows.</span>
          </motion.p>
          <p className="text-sm text-zinc-300 leading-relaxed font-light">
            Watch together in perfect synchrony from any browser. Even if you pause or scrub, both screens stay exactly in frame.
          </p>
        </div>
      </div>
    </section>
  );
}
