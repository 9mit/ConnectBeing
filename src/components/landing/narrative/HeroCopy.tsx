"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Sparkles, Heart } from "lucide-react";

import { SITE, LANDING_HERO } from "@/content/site";

export function HeroCopy() {
  return (
    <section
      className="landing-section landing-hero relative pt-32 pb-20 text-center"
      aria-label={`${SITE.brand} sanctuary`}
    >
      <div className="relative z-10 mx-auto max-w-4xl px-5 flex flex-col items-center">
        {/* Sanctuary Pill */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="sanctuary-pill flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>A Sanctuary Built Exclusively for Two</span>
          </div>
        </motion.div>

        {/* Cinematic Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="display-hero text-[#fbf9f4] max-w-3xl tracking-tight"
        >
          Some people change your life. <br />
          <span className="italic font-light text-sky-400">Some become your universe.</span>
        </motion.h1>

        {/* Evocative Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mt-6 max-w-2xl text-base md:text-lg text-zinc-300 font-sans font-light leading-relaxed text-balance"
        >
          An intimate private space for two — end-to-end encrypted messaging, synchronized 4K theater, live emotional vibes, and shared memory vaults. Zero social feeds, zero surveillance.
        </motion.p>

        {/* Primary and Secondary Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
        >
          <Link
            href="/register"
            className="btn-cta-primary w-full sm:w-auto"
          >
            <span>Begin Our Story</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="btn-cta-secondary w-full sm:w-auto"
          >
            <span>Already together? Sign in →</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
