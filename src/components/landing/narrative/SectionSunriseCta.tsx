"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Lock, Sparkles, Heart } from "lucide-react";

import { LANDING_CHAPTERS, SITE } from "@/content/site";

export function SectionSunriseCta() {
  const { aria, line1, line2Prefix, line2Em } = LANDING_CHAPTERS.cta;

  return (
    <section
      id="security"
      className="landing-section relative py-28 px-4 text-center border-t border-white/10"
      aria-label={aria}
    >
      <div className="relative z-10 mx-auto max-w-4xl flex flex-col items-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <div className="sanctuary-pill">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Your Sanctuary Awaits</span>
          </div>
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
          <span className="italic font-light text-sky-400">Now build your universe.</span>
        </motion.h2>

        <motion.p
          className="max-w-xl text-base text-zinc-300 font-sans font-light leading-relaxed"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          Begin with a private pairing code. Instant cryptographic key derivation. No personal data sold, no algorithmic surveillance.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, delay: 0.25 }}
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
            <span>Sign in with partner code →</span>
          </Link>
        </motion.div>

        {/* Trust Seals Strip */}
        <motion.div
          className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl text-left text-xs"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, delay: 0.35 }}
        >
          <div className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-zinc-300">ECDH P-256 E2EE Chat</span>
          </div>

          <div className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-zinc-300">0 Third-Party Trackers</span>
          </div>

          <div className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center gap-2.5">
            <Heart className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-zinc-300">Strictly 2 Devices</span>
          </div>
        </motion.div>

        {/* Minimal Editorial Footer */}
        <div className="pt-16 border-t border-white/10 w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
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
