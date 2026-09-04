"use client";

import { motion } from "framer-motion";
import { Lock, Sparkles, Milestone } from "lucide-react";

export function SectionArchive() {
  return (
    <section
      id="archive"
      className="landing-section relative py-20 md:py-28 px-5 text-center overflow-hidden"
      aria-label="The Relationship Archive"
    >
      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Narrative Chapter Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl mx-auto mb-14 text-center"
        >
          <p className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-zinc-400/80 mb-3">
            Chapter III · Why Couples Return
          </p>
          <h2 className="font-serif text-[clamp(2.2rem,5vw,3.6rem)] font-light tracking-[-0.015em] leading-[1.12] text-[#fbf9f4]">
            An archive that deepens <br />
            <span className="font-serif italic font-normal text-[#f4efe4]">
              with every passing year.
            </span>
          </h2>
          <p className="mt-4 text-base md:text-lg text-zinc-300/80 font-sans font-light leading-relaxed">
            Relationships are not ephemeral chat logs. MadLove gathers your milestones, sealed voice notes, and rituals into a timeless digital tapestry.
          </p>
        </motion.div>

        {/* Editorial Triptych */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 text-left max-w-5xl mx-auto pt-4 border-t border-b border-white/[0.06] py-12">
          {/* Pillar 1: Relationship Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="flex flex-col justify-between md:border-r md:border-white/[0.06] md:pr-8"
          >
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
                <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-zinc-400">
                  01 / Continuity
                </span>
                <Milestone className="w-3.5 h-3.5 text-zinc-400" />
              </div>

              <h3 className="font-serif text-2xl font-light text-[#fbf9f4] mt-6">
                Living Relationship Timeline
              </h3>
              <p className="mt-3 text-xs text-zinc-400 font-sans leading-relaxed">
                From the quiet morning you met to your tenth anniversary. Every landmark, shared journey, and milestone automatically woven into your personal history.
              </p>

              {/* Minimalist Typographic Mini-Timeline */}
              <div className="mt-8 space-y-3.5 font-mono text-[11px] pt-4 border-t border-white/[0.04]">
                <div className="flex items-center gap-3 text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  <span className="text-zinc-500">Day 1</span>
                  <span className="truncate">The first hello in Kyoto</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  <span className="text-zinc-500">Day 365</span>
                  <span className="truncate">First anniversary letter</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  <span className="text-zinc-500">Day 730</span>
                  <span className="truncate">Moved into our first home</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-3 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Automatic Milestone Weaving
            </div>
          </motion.div>

          {/* Pillar 2: Sealed Time Capsules */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex flex-col justify-between md:border-r md:border-white/[0.06] md:pr-8"
          >
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
                <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-zinc-400">
                  02 / Preservation
                </span>
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
              </div>

              <h3 className="font-serif text-2xl font-light text-[#fbf9f4] mt-6">
                Milestone Time Capsules
              </h3>
              <p className="mt-3 text-xs text-zinc-400 font-sans leading-relaxed">
                Record whispered audio letters and seal private photos that remain cryptographically locked until a specific future date or anniversary.
              </p>

              {/* Minimalist Capsule Representation */}
              <div className="mt-8 space-y-2 pt-4 border-t border-white/[0.04]">
                <div className="flex items-center gap-2 text-zinc-200 text-xs font-serif">
                  <Lock className="w-3 h-3 text-zinc-400" />
                  <span>&ldquo;For Our 5th Anniversary&rdquo;</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Unlocks in 314 days · Oct 14
                </div>
                <div className="text-[10px] font-mono text-zinc-500">
                  Ciphertext sealed until timestamp matches
                </div>
              </div>
            </div>

            <div className="mt-8 pt-3 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Cryptographic Date Lock
            </div>
          </motion.div>

          {/* Pillar 3: Evolving Celestial Spirit */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
                <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-zinc-400">
                  03 / Symbiosis
                </span>
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
              </div>

              <h3 className="font-serif text-2xl font-light text-[#fbf9f4] mt-6">
                Shared Celestial Companion
              </h3>
              <p className="mt-3 text-xs text-zinc-400 font-sans leading-relaxed">
                A subtle digital spirit that radiates warmth and evolves based on your shared rituals, movie nights, and daily check-ins as a couple.
              </p>

              {/* Minimalist Companion Representation */}
              <div className="mt-8 flex items-center gap-4 pt-4 border-t border-white/[0.04]">
                <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/15 flex items-center justify-center text-zinc-300 font-mono text-xs">
                  ✦
                </div>
                <div>
                  <div className="text-xs font-serif font-light text-zinc-200">
                    Aura Companion
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    Evolving with your connection
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-3 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Shared Couple Rituals
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
