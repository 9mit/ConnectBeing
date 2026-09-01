"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Shield, Lock } from "lucide-react";

import { SITE } from "@/content/site";

export function LandingHeader() {
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#05010b]/90 via-[#05010b]/40 to-transparent h-32 backdrop-blur-[2px]" />
      
      <nav
        className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-8"
        aria-label={SITE.brand}
      >
        {/* Brand Identity */}
        <Link
          href="/"
          className="group relative flex flex-col leading-none"
          aria-label={`${SITE.brand} home`}
        >
          <div className="flex items-center gap-2">
            <span className="font-serif text-2xl md:text-3xl font-bold tracking-[0.14em] text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 text-glow-gold">
              {SITE.brandMark}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]" />
          </div>
          <span className="mt-1 text-[9px] font-sans uppercase tracking-[0.32em] text-amber-300/70 group-hover:text-amber-200 transition-colors">
            a universe for two
          </span>
        </Link>

        {/* Center Privacy Line Badge (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-purple-950/40 backdrop-blur-md shadow-inner">
          <Lock className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-sans tracking-[0.2em] uppercase font-semibold text-amber-200/80">
            {SITE.privacyLine}
          </span>
        </div>

        {/* Auth CTA Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          <Link
            href="/login"
            className="text-xs font-bold text-slate-200 hover:text-amber-300 px-3.5 py-2 transition-colors tracking-wider uppercase font-sans"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="relative overflow-hidden text-xs font-extrabold text-[#07020f] bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 px-5 py-2.5 rounded-full shadow-[0_0_25px_rgba(212,175,55,0.45)] hover:scale-[1.04] active:scale-[0.98] transition-all tracking-wider uppercase font-sans flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-950 fill-purple-950" />
            <span>Begin Free</span>
          </Link>
        </div>
      </nav>

      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
    </header>
  );
}
