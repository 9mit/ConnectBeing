"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

import { SITE } from "@/content/site";

export function LandingHeader() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#07020f]/80 backdrop-blur-md border-b border-white/10">
      <nav
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8"
        aria-label={SITE.brand}
      >
        {/* Brand Identity */}
        <Link
          href="/"
          className="group flex items-baseline gap-2.5 text-zinc-100"
          aria-label={`${SITE.brand} home`}
        >
          <span className="font-serif text-2xl md:text-3xl font-bold tracking-[0.06em] text-[#fbf9f4]">
            {SITE.brandMark}
          </span>
          <span className="hidden sm:inline text-xs font-sans font-light tracking-widest text-sky-400">
            universe for two
          </span>
        </Link>

        {/* Clean Nav Links (Desktop) */}
        <div className="hidden md:flex items-center gap-8 font-sans text-xs font-medium text-zinc-300">
          <a
            href="#demo"
            className="hover:text-white transition-colors"
          >
            Interactive Demo
          </a>
          <a
            href="#sanctuary"
            className="hover:text-white transition-colors"
          >
            Sanctuary
          </a>
          <a
            href="#security"
            className="hover:text-white transition-colors"
          >
            Security &amp; Privacy
          </a>
        </div>

        {/* Auth Actions */}
        <div className="flex items-center gap-3 md:gap-5">
          <Link
            href="/login"
            className="text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>

          <Link
            href="/register"
            className="btn-cta-primary text-xs py-2 px-4 shadow-sm"
          >
            <span>Begin Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>
    </header>
  );
}
