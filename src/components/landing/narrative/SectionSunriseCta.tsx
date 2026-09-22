"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Lock, Heart } from "lucide-react";

import { LANDING_CHAPTERS, SITE } from "@/content/site";
import { BeginStoryButton } from "../ui/BeginStoryButton";

export function SectionSunriseCta() {
  const { aria } = LANDING_CHAPTERS.cta;

  return (
    <section
      id="security"
      className="landing-section relative py-24 md:py-32 px-4 text-center"
      aria-label={aria}
    >
      <div className="relative z-10 mx-auto max-w-4xl flex flex-col items-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <p className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-zinc-400/80">
            Chapter V · Your Sanctuary Awaits
          </p>
        </motion.div>

        {/* Editorial Heading */}
        <motion.h2
          className="display-hero text-[#fbf9f4] tracking-tight max-w-3xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8 }}
        >
          You found your person. <br />
          <span className="font-serif italic font-normal text-[#f4efe4]">
            Now build your universe.
          </span>
        </motion.h2>

        <motion.p
          className="max-w-xl text-sm md:text-base text-zinc-300/80 font-sans font-light leading-relaxed"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          Begin with a private pairing code. Instant cryptographic key derivation. No personal data sold, no algorithmic surveillance.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, delay: 0.25 }}
        >
          <BeginStoryButton className="btn-cta-primary w-full sm:w-auto" />

          <Link
            href="/login"
            className="btn-cta-secondary w-full sm:w-auto"
          >
            <span>Sign in with partner code →</span>
          </Link>
        </motion.div>

        {/* Unboxed Trust Seals */}
        <motion.div
          className="pt-8 pb-4 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-zinc-400 border-t border-white/[0.06] w-full max-w-2xl"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, delay: 0.35 }}
        >
          <span className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-300">ECDH P-256 E2EE</span>
          </span>

          <span className="hidden sm:inline text-zinc-600">·</span>

          <span className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-300">Zero Third-Party Trackers</span>
          </span>

          <span className="hidden sm:inline text-zinc-600">·</span>

          <span className="flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-300">Strictly Two Devices</span>
          </span>
        </motion.div>

        {/* Minimal Editorial Footer */}
        <div className="pt-12 border-t border-white/[0.06] w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="text-zinc-300 font-bold font-serif">{SITE.brandMark}</span>
            <span>· A sanctuary for two</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/security" className="hover:text-zinc-300 transition-colors">
              Security Overview
            </Link>
            <span>{LANDING_CHAPTERS.footer.whisper}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
