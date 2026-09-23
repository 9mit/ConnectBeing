"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { SITE } from "@/content/site";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-50 pointer-events-none transition-all duration-300">
      <div
        className={`w-full transition-all duration-300 ${
          scrolled
            ? "bg-[#030206]/80 backdrop-blur-md border-b border-white/[0.06] py-3 shadow-lg shadow-black/40"
            : "bg-gradient-to-b from-[#030206]/90 via-[#030206]/30 to-transparent pt-4 pb-6"
        }`}
      >
        <nav
          className="pointer-events-auto mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-8"
          aria-label={SITE.brand}
        >
          {/* Brand Identity */}
          <Link
            href="/"
            className="group flex items-baseline gap-2.5 text-zinc-100 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            aria-label={`${SITE.brand} home`}
          >
            <span className="font-serif text-2xl font-light tracking-[0.04em] text-[#fbf9f4]">
              {SITE.brandMark}
            </span>
          </Link>

          {/* Minimal Editorial Nav Links */}
          <div className="hidden md:flex items-center gap-8 font-sans text-[11px] uppercase tracking-[0.18em] text-zinc-400">
            <a href="#why-sanctuary" className="hover:text-[#fbf9f4] transition-colors duration-200">
              Why {SITE.brand}
            </a>
            <a href="#experience" className="hover:text-[#fbf9f4] transition-colors duration-200">
              Experience
            </a>
            <a href="#privacy" className="hover:text-[#fbf9f4] transition-colors duration-200">
              Privacy
            </a>
          </div>

          {/* Clean Auth Action */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-sans text-zinc-300 hover:text-white tracking-wider transition-colors duration-200 min-h-[44px] px-3 inline-flex items-center justify-center rounded-full border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            >
              Sign In
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
