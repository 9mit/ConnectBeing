"use client";

import { useRef } from "react";

import "@/app/landing.css";

import { LandingScrollProvider } from "./hooks/useLandingScroll";
import { LandingHeader } from "./ui/LandingHeader";
import { HeroCopy } from "./narrative/HeroCopy";
import { SectionDifferentiation } from "./narrative/SectionDifferentiation";
import { InteractivePreview } from "./narrative/InteractivePreview";
import { SectionArchive } from "./narrative/SectionArchive";
import { SectionTrust } from "./narrative/SectionTrust";
import { SectionSunriseCta } from "./narrative/SectionSunriseCta";
import { LandingFooter } from "./ui/LandingFooter";

function GlobalCosmicAtmosphere() {
  return <div className="global-cosmic-atmosphere" aria-hidden="true" />;
}

export function LandingExperience() {
  const progressRef = useRef(0);

  return (
    <div className="madlove-landing">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#fbf9f4] focus:text-[#020106] focus:font-sans focus:text-xs focus:font-semibold focus:tracking-wider focus:rounded-md focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        Skip to sanctuary experience
      </a>

      {/* Global continuous quiet atmosphere */}
      <GlobalCosmicAtmosphere />

      <LandingScrollProvider progressRef={progressRef}>
        <LandingHeader />

        {/* Semantic main content */}
        <main className="landing-scroll" id="main-content">
          {/* Sanctuary Hero & Soul Phenomenon */}
          <HeroCopy />

          {/* Chapter I: Solitude in a World of Crowds */}
          <SectionDifferentiation />

          {/* Chapter II: The Sanctuary Slate */}
          <div id="experience">
            <InteractivePreview />
          </div>

          {/* Chapter III: Why Couples Return (Memory Vaults & Timeline) */}
          <SectionArchive />

          {/* Chapter IV: The Cryptographic Boundary */}
          <SectionTrust />

          {/* Chapter V: Your Sanctuary Awaits */}
          <SectionSunriseCta />

          {/* Landing Page Footer · Ninegalaxies & CodeSamjho Ecosystem */}
          <LandingFooter />
        </main>
      </LandingScrollProvider>
    </div>
  );
}
