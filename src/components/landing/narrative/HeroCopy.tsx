"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Lock, MapPin, Film, Sparkles, ChevronDown } from "lucide-react";

import { LANDING_HERO, SITE } from "@/content/site";
import { RippleButton } from "../ui/RippleButton";

export function HeroCopy() {
  return (
    <section
      className="landing-section landing-hero relative flex flex-col items-center justify-center min-h-[100dvh] pt-32 pb-24 text-center"
      aria-label={`${SITE.brand} universe`}
    >
      {/* Celestial Pill Tag */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9 }}
        className="mb-6"
      >
        <div className="stardust-pill">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>An Intimate Digital Sanctuary</span>
        </div>
      </motion.div>

      {/* Main Brand Title */}
      <motion.h1
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="font-serif text-[clamp(4rem,15vw,9.5rem)] font-bold tracking-[0.06em] text-white leading-none drop-shadow-[0_0_40px_rgba(212,175,55,0.3)] select-none"
      >
        {SITE.brandMark}
      </motion.h1>

      {/* Subheading & Poetic Copy */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.2 }}
        className="mt-8 max-w-3xl mx-auto px-4 space-y-4"
      >
        <p className="display-md text-white font-serif font-light leading-snug">
          {LANDING_HERO.line1}
          <br />
          <span className="glow-text-gold italic font-semibold">
            {LANDING_HERO.line2}
          </span>
        </p>
        <p className="text-sm md:text-base text-slate-300 font-sans font-light leading-relaxed max-w-xl mx-auto">
          {LANDING_HERO.support}
        </p>
      </motion.div>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.4 }}
        className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 z-20"
      >
        <RippleButton href="/register">
          <span className="flex items-center gap-2.5 text-purple-950 font-extrabold tracking-wider">
            <span>{LANDING_HERO.cta}</span>
            <ArrowRight className="w-4 h-4 text-purple-950" />
          </span>
        </RippleButton>

        <Link
          href="/login"
          className="login-whisper px-6 py-3.5 rounded-full border border-amber-500/25 bg-purple-950/40 hover:bg-amber-500/15 text-slate-200 hover:text-amber-200 transition-all font-sans text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg"
        >
          <span>{LANDING_HERO.signIn}</span>
          <span className="text-amber-400">→</span>
        </Link>
      </motion.div>

      {/* Trust & Feature Badges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.6 }}
        className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-3xl mx-auto w-full px-4"
      >
        <div className="glass-card-luxury p-3.5 rounded-2xl flex items-center justify-center gap-2.5 text-xs text-slate-200 font-sans">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold">Zero-Knowledge E2EE</span>
        </div>
        <div className="glass-card-luxury p-3.5 rounded-2xl flex items-center justify-center gap-2.5 text-xs text-slate-200 font-sans">
          <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-semibold">Live Distance & Presence</span>
        </div>
        <div className="glass-card-luxury p-3.5 rounded-2xl flex items-center justify-center gap-2.5 text-xs text-slate-200 font-sans">
          <Film className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold">Synchronized Theater</span>
        </div>
      </motion.div>

      {/* Scroll Down Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ delay: 1.2, duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1 text-[10px] font-sans uppercase tracking-[0.3em] text-amber-300/80 pointer-events-none"
      >
        <span>{LANDING_HERO.scrollHint}</span>
        <ChevronDown className="w-4 h-4 text-amber-400 animate-bounce" />
      </motion.div>
    </section>
  );
}
