"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Code2, ArrowUpRight, ArrowRight, ExternalLink } from "lucide-react";

import { SITE, LANDING_CHAPTERS } from "@/content/site";
import { BRAND } from "@/lib/brand";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      aria-label="Site and ecosystem footer"
      className="landing-footer relative w-full pt-16 pb-14 px-5 sm:px-8 border-t border-white/[0.08] overflow-hidden"
    >
      {/* Ambient Celestial Glow Accent */}
      <div
        className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[800px] h-[340px] bg-gradient-to-b from-amber-500/[0.07] via-violet-500/[0.04] to-transparent blur-3xl -z-10"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Main Ecosystem Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Ninegalaxies Parent Studio Showcase */}
          <motion.div
            className="lg:col-span-7 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            {/* Logo with Soft Cosmic Halos */}
            <div className="relative group shrink-0">
              <div
                className="absolute -inset-3 rounded-full bg-gradient-to-tr from-amber-500/25 via-rose-500/15 to-indigo-500/25 blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-700 -z-10"
                aria-hidden="true"
              />
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-1.5 flex items-center justify-center transition-transform duration-500 group-hover:scale-[1.03]">
                <Image
                  src={SITE.parentCompany.logo}
                  alt={`${SITE.parentCompany.name} - Cosmic Astrolabe Emblem`}
                  width={112}
                  height={112}
                  className="w-full h-full object-contain filter drop-shadow-[0_0_18px_rgba(245,158,11,0.3)]"
                  priority={false}
                />
              </div>
            </div>

            {/* Brand Lockup Copy */}
            <div className="flex flex-col items-center sm:items-start">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-[0.22em] uppercase bg-amber-400/10 text-amber-200 border border-amber-400/20 mb-2">
                <Sparkles className="w-3 h-3 text-amber-300" aria-hidden="true" />
                <span>{SITE.parentCompany.tagline}</span>
              </div>

              <h3 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#fbf9f4]">
                {SITE.parentCompany.name}
              </h3>

              <p className="mt-1.5 text-xs sm:text-sm text-zinc-300/80 font-sans font-light leading-relaxed max-w-md">
                {SITE.parentCompany.description}
              </p>

              <div className="mt-3.5 flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-[11px] font-mono text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                  <span>Ninegalaxies Studio</span>
                </span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">Creator of {BRAND.name}</span>
              </div>
            </div>
          </motion.div>

          {/* Sister Product Spotlight (CodeSamjho) */}
          <motion.div
            className="lg:col-span-5 w-full"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <a
              href={SITE.sisterProduct.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit our sister product: ${SITE.sisterProduct.name} - ${SITE.sisterProduct.tagline} (opens in new tab)`}
              className="group relative block p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent border border-white/[0.08] hover:border-amber-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider uppercase bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  <Code2 className="w-3 h-3 text-amber-300" aria-hidden="true" />
                  <span>{SITE.sisterProduct.badge}</span>
                </span>

                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 group-hover:text-amber-200 transition-colors">
                  <span>Visit Product</span>
                  <ArrowUpRight
                    className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                    aria-hidden="true"
                  />
                </span>
              </div>

              {/* Product Name & Subheading */}
              <div className="mt-2">
                <div className="text-lg sm:text-xl font-serif font-medium text-[#fbf9f4] group-hover:text-amber-100 transition-colors flex items-center gap-2">
                  <span>{SITE.sisterProduct.name}</span>
                </div>
                <div className="text-[11px] sm:text-xs font-mono text-amber-200/80 tracking-wide mt-0.5">
                  {SITE.sisterProduct.tagline}
                </div>
              </div>

              {/* Product Description */}
              <p className="mt-2 text-xs text-zinc-300/80 font-sans font-light leading-relaxed">
                {SITE.sisterProduct.description}
              </p>

              {/* Action Bar */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-sans">
                <span className="text-zinc-500 font-mono text-[11px] group-hover:text-amber-300/80 transition-colors">
                  codesamjho.online
                </span>
                <span className="text-amber-300/90 font-medium inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  <span>Explore Platform</span>
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </span>
              </div>
            </a>
          </motion.div>
        </div>

        {/* Minimal Editorial Footer & Legal */}
        <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <span className="text-zinc-300 font-bold font-serif">{SITE.brandMark}</span>
            <span>·</span>
            <span>A sanctuary for two</span>
            <span className="hidden sm:inline">·</span>
            <span className="text-zinc-500">
              © {currentYear} {SITE.parentCompany.name}. All rights reserved.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-5 sm:gap-6">
            <Link
              href="/privacy"
              className="hover:text-zinc-300 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/security"
              className="hover:text-zinc-300 transition-colors"
            >
              Security Overview
            </Link>
            <a
              href={SITE.sisterProduct.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-300 transition-colors inline-flex items-center gap-1"
            >
              <span>CodeSamjho</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
            <span className="text-zinc-400 italic font-serif">
              {LANDING_CHAPTERS.footer.whisper}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
