"use client";

import { motion } from "framer-motion";

export function SectionDifferentiation() {
  return (
    <section
      id="why-madlove"
      className="landing-section relative py-20 md:py-28 px-5 text-center overflow-hidden"
      aria-label="Why MadLove is different"
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
            Chapter I · Solitude in a World of Crowds
          </p>
          <h2 className="font-serif text-[clamp(2.2rem,5vw,3.6rem)] font-light tracking-[-0.015em] leading-[1.12] text-[#fbf9f4]">
            Built for an audience of <br />
            <span className="font-serif italic font-normal text-[#f4efe4]">
              exactly one.
            </span>
          </h2>
          <p className="mt-4 text-base md:text-lg text-zinc-300/80 font-sans font-light leading-relaxed">
            Every other platform seeks collective attention. MadLove is dedicated entirely to the one person who matters most.
          </p>
        </motion.div>

        {/* Editorial Diptych: The Crowd vs The Sanctuary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 text-left max-w-4xl mx-auto pt-4">
          {/* Left Column: The Noise of Generic Apps */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col justify-between space-y-8"
          >
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
                <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-zinc-400">
                  Everyday Platforms
                </span>
                <span className="text-[11px] font-mono text-zinc-500">Crowds &amp; Feeds</span>
              </div>

              <div className="mt-6 space-y-6 text-sm text-zinc-400 font-sans">
                <div className="space-y-1">
                  <div className="text-zinc-200 font-medium font-serif text-base">Overcrowded channels &amp; pings</div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Your partner&apos;s message is buried between team threads, group chats, and constant notification badges.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="text-zinc-200 font-medium font-serif text-base">Performative broadcasts</div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Feeds designed to keep you scrolling strangers instead of resting in presence with the one you love.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="text-zinc-200 font-medium font-serif text-base">Scattered memories</div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Photos lost in endless camera rolls; movie nights cobbled together over clumsy screenshares.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.04] text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              Environment: Noise &amp; Distraction
            </div>
          </motion.div>

          {/* Right Column: MadLove Sanctuary */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="flex flex-col justify-between space-y-8 md:border-l md:border-white/[0.06] md:pl-12"
          >
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
                <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#fbf9f4] font-medium">
                  MadLove Sanctuary
                </span>
                <span className="text-[11px] font-mono text-zinc-400">Strictly Pairwise</span>
              </div>

              <div className="mt-6 space-y-6 text-sm text-zinc-300 font-sans">
                <div className="space-y-1">
                  <div className="text-white font-medium font-serif text-base">
                    A single quiet room
                  </div>
                  <p className="text-xs text-zinc-300/90 leading-relaxed">
                    When your device illuminates with MadLove, you know instantly who it is. No other contact exists in this world.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="text-white font-medium font-serif text-base">
                    Synchronized living experiences
                  </div>
                  <p className="text-xs text-zinc-300/90 leading-relaxed">
                    Private cinema in unison, real-time shared presence, and ambient music experienced side-by-side.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="text-white font-medium font-serif text-base">
                    A lasting relationship archive
                  </div>
                  <p className="text-xs text-zinc-300/90 leading-relaxed">
                    Date-locked time capsules, an automatic milestone timeline, and an evolving celestial spirit.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.04] text-[10px] font-mono tracking-widest text-[#fbf9f4]/60 uppercase">
              Environment: Quiet Intimacy
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
