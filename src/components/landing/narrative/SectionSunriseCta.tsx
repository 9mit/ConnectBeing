"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Sparkles, Heart, Shield, Lock } from "lucide-react";

import { LANDING_CHAPTERS, LANDING_HERO, SITE } from "@/content/site";
import { RippleButton } from "../ui/RippleButton";

export function SectionSunriseCta() {
  const { aria, line1, line2Prefix, line2Em } = LANDING_CHAPTERS.cta;

  return (
    <section id="begin" className="landing-section relative text-slate-100 pb-16" aria-label={aria}>
      {/* Sunrise Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 via-purple-950/30 to-transparent pointer-events-none" />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center px-5 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.5 }}
        >
          <div className="stardust-pill mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Your Universe Awaits</span>
          </div>
        </motion.div>

        <motion.p
          className="display-md text-white font-serif max-w-xl"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ amount: 0.5 }}
          transition={{ duration: 1.2 }}
        >
          {line1}
        </motion.p>

        <motion.h2
          className="display-lg text-white font-serif tracking-tight"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.5 }}
          transition={{ duration: 1.2, delay: 0.2 }}
        >
          {line2Prefix}{" "}
          <span className="glow-text-gold italic font-semibold">{line2Em}</span>.
        </motion.h2>

        {/* CTA Button */}
        <motion.div
          className="pt-6"
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ amount: 0.4 }}
          transition={{ duration: 1, delay: 0.35, type: "spring", stiffness: 120 }}
        >
          <RippleButton href="/register">
            <span className="flex items-center gap-2.5 text-purple-950 font-extrabold tracking-wider">
              <span>{LANDING_HERO.cta}</span>
              <ArrowRight className="w-4 h-4 text-purple-950" />
            </span>
          </RippleButton>
        </motion.div>

        {/* Sign In Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ amount: 0.3 }}
          transition={{ delay: 0.6, duration: 1 }}
        >
          <Link
            href="/login"
            className="login-whisper flex items-center gap-2 text-slate-300 hover:text-amber-300 font-bold uppercase tracking-widest text-xs transition-colors"
          >
            <span>{LANDING_HERO.signIn}</span>
            <span className="text-amber-400">→</span>
          </Link>
        </motion.div>

        {/* Full Luxury Landing Footer */}
        <footer className="w-full pt-20 mt-16 border-t border-amber-500/20 text-xs font-sans text-slate-400 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl font-bold text-white tracking-widest text-glow-gold">
                {SITE.brandMark}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300/80">
                · for two
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-slate-300 text-xs font-medium">
              <Link href="/privacy" className="hover:text-amber-300 transition-colors">
                Privacy Center
              </Link>
              <Link href="/security" className="hover:text-amber-300 transition-colors">
                Security & Encryption
              </Link>
              <Link href="/verify" className="hover:text-amber-300 transition-colors">
                Couple Verification
              </Link>
              <Link href="/login" className="hover:text-amber-300 transition-colors">
                Member Sign In
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 pt-4 border-t border-white/5">
            <p>© {new Date().getFullYear()} MadLove. All rights reserved. Zero-knowledge couple sanctuary.</p>
            <p className="text-amber-400/80 font-serif italic">Some people become your universe.</p>
          </div>
        </footer>
      </div>
    </section>
  );
}
