"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useRef } from "react";

import "@/app/landing.css";

import { LandingScrollProvider, useLandingScroll } from "./hooks/useLandingScroll";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { LandingHeader } from "./ui/LandingHeader";
import { HeroCopy } from "./narrative/HeroCopy";
import { InteractivePreview } from "./narrative/InteractivePreview";
import { BentoGrid } from "./narrative/BentoGrid";
import { SectionDistance } from "./narrative/SectionDistance";
import { SectionMemories } from "./narrative/SectionMemories";
import { SectionSync } from "./narrative/SectionSync";
import { SectionAi } from "./narrative/SectionAi";
import { SectionSpirit } from "./narrative/SectionSpirit";
import { SectionSunriseCta } from "./narrative/SectionSunriseCta";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import { LANDING_HERO, LANDING_CHAPTERS, SITE } from "@/content/site";

const UniverseCanvas = dynamic(
  () =>
    import("./UniverseCanvas").catch((err) => {
      console.error("UniverseCanvas chunk failed:", err);
      return { default: () => null };
    }),
  {
    ssr: false,
    loading: () => null,
  },
);

function CanvasHost({
  progressRef,
  onHeroComplete,
}: {
  progressRef: React.MutableRefObject<number>;
  onHeroComplete: () => void;
}) {
  const { mouse } = useLandingScroll();
  return (
    <CanvasErrorBoundary>
      <UniverseCanvas
        progressRef={progressRef}
        mouse={mouse}
        onHeroComplete={onHeroComplete}
      />
    </CanvasErrorBoundary>
  );
}

function GlobalCosmicAtmosphere() {
  return (
    <div className="global-cosmic-atmosphere" aria-hidden>
      <div className="aurora-nebula-flow" />
      <div className="aurora-glow-field-1" />
      <div className="aurora-glow-field-2" />
      <div className="aurora-glow-field-3" />
      <div className="aurora-glow-field-4" />
    </div>
  );
}

function FlowLine() {
  return (
    <div className="flow-line-container" aria-hidden>
      <div className="flow-line" />
      <span className="flow-line-node" />
    </div>
  );
}

function ReducedMotionLanding() {
  return (
    <div className="madlove-landing">
      <LandingHeader />
      <GlobalCosmicAtmosphere />
      <main className="landing-scroll relative z-10 px-6 py-28 text-center max-w-4xl mx-auto space-y-8">
        <div className="sanctuary-pill inline-flex">
          <span>Private Sanctuary for Two</span>
        </div>
        <h1 className="font-serif text-[clamp(2.5rem,8vw,5.5rem)] font-bold tracking-[0.04em] text-[#fbf9f4]">
          {SITE.brandMark}
        </h1>
        <p className="display-md text-zinc-300">{LANDING_HERO.line1}</p>
        <p className="display-md text-sky-400 italic">{LANDING_HERO.line2}</p>
        <p className="text-zinc-400 font-sans text-sm max-w-lg mx-auto leading-relaxed">
          {LANDING_HERO.support}
        </p>

        <div className="pt-6 flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/register" className="btn-cta-primary">
            Begin Our Story
          </Link>
          <Link href="/login" className="btn-cta-secondary">
            Already together? Sign in →
          </Link>
        </div>
      </main>
    </div>
  );
}

function FullLanding() {
  const progressRef = useRef(0);
  const onHeroComplete = useCallback(() => {}, []);

  return (
    <div className="madlove-landing">
      <a href="#demo" className="skip-link">
        Skip to interactive demo
      </a>
      {/* Global full-bleed animated cosmic atmosphere spanning end-to-end */}
      <GlobalCosmicAtmosphere />

      <LandingScrollProvider progressRef={progressRef}>
        <CanvasHost progressRef={progressRef} onHeroComplete={onHeroComplete} />
        <LandingHeader />

        <main className="landing-scroll">
          {/* Section 01: Hero */}
          <HeroCopy />
          <FlowLine />

          {/* Section 02: Interactive Product Preview */}
          <InteractivePreview />
          <FlowLine />

          {/* Section 03: Curated Sanctuary Architecture */}
          <BentoGrid />
          <FlowLine />

          {/* Chapter I: Real-Time Presence & Distance */}
          <SectionDistance />
          <FlowLine />

          {/* Chapter II: Memory Vault & Time Capsules */}
          <SectionMemories />
          <FlowLine />

          {/* Chapter III: 4K Synchronized Streaming */}
          <SectionSync />
          <FlowLine />

          {/* Chapter IV: Relationship Intelligence */}
          <SectionAi />
          <FlowLine />

          {/* Chapter V: Living Spirit Companion */}
          <SectionSpirit />
          <FlowLine />

          {/* Section 04: Final Onboarding & Verification */}
          <SectionSunriseCta />
        </main>
      </LandingScrollProvider>
    </div>
  );
}

function LandingShell() {
  return (
    <div className="madlove-landing">
      <GlobalCosmicAtmosphere />
    </div>
  );
}

export function LandingExperience() {
  const reduced = usePrefersReducedMotion();
  if (reduced === null) return <LandingShell />;
  if (reduced) return <ReducedMotionLanding />;
  return <FullLanding />;
}
