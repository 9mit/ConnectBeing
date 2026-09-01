"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import "@/app/landing.css";

import { LandingScrollProvider, useLandingScroll } from "./hooks/useLandingScroll";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { LandingHeader } from "./ui/LandingHeader";
import { HeroCopy } from "./narrative/HeroCopy";
import { SectionDistance } from "./narrative/SectionDistance";
import { SectionMemories } from "./narrative/SectionMemories";
import { SectionSync } from "./narrative/SectionSync";
import { BentoGrid } from "./narrative/BentoGrid";
import { InteractivePreview } from "./narrative/InteractivePreview";
import { SectionAi } from "./narrative/SectionAi";
import { SectionSpirit } from "./narrative/SectionSpirit";
import { SectionSunriseCta } from "./narrative/SectionSunriseCta";
import { RippleButton } from "./ui/RippleButton";
import { AudioController } from "./ui/AudioController";
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

function CursorStars() {
  const [bursts, setBursts] = useState<
    Array<{ id: number; x: number; y: number; dx: number; dy: number }>
  >([]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const id = Date.now();
      const next = Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 24 + Math.random() * 40;
        return {
          id: id + i,
          x: e.clientX,
          y: e.clientY,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
        };
      });
      setBursts((b) => [...b.slice(-18), ...next]);
      window.setTimeout(() => {
        setBursts((b) => b.filter((x) => !(x.id >= id && x.id <= id + 5)));
      }, 700);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      {bursts.map((b) => (
        <span
          key={b.id}
          className="cursor-burst"
          style={
            {
              left: b.x,
              top: b.y,
              "--dx": `${b.dx}px`,
              "--dy": `${b.dy}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

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

function ReducedMotionLanding() {
  return (
    <div className="madlove-landing">
      <LandingHeader />
      <AudioController />
      <div
        className="landing-bg-fallback"
        style={{ ["--universe-warmth" as string]: "0.2" }}
      />
      <main
        className="landing-scroll relative z-10 px-6 py-28 text-center"
        style={{ color: "var(--text-star)" }}
      >
        <p className="font-serif text-[clamp(3rem,12vw,7rem)] font-bold tracking-[0.08em] mb-10 text-glow-gold">
          {SITE.brandMark}
        </p>
        <p className="display-md mb-6">{LANDING_HERO.line1}</p>
        <p className="display-md mb-6">{LANDING_HERO.line2}</p>
        <p className="display-lg mb-16 mt-16">{LANDING_CHAPTERS.cta.line1}</p>
        <p className="display-md mb-12">
          {LANDING_CHAPTERS.cta.line2Prefix} {LANDING_CHAPTERS.cta.line2Em}.
        </p>
        <RippleButton href="/register">{LANDING_HERO.cta}</RippleButton>
        <p className="mt-8">
          <Link href="/login" className="login-whisper">
            {LANDING_HERO.signIn}
          </Link>
        </p>
      </main>
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

function FullLanding() {
  const progressRef = useRef(0);
  const onHeroComplete = useCallback(() => {}, []);

  return (
    <div className="madlove-landing">
      <a href="#begin" className="skip-link">
        Skip to begin
      </a>
      <div className="landing-bg-fallback" aria-hidden />

      <LandingScrollProvider progressRef={progressRef}>
        <CanvasHost progressRef={progressRef} onHeroComplete={onHeroComplete} />
        <CursorStars />
        <AudioController />
        <LandingHeader />
        <main className="landing-scroll">
          <HeroCopy />
          <FlowLine />
          <SectionDistance />
          <FlowLine />
          <SectionMemories />
          <FlowLine />
          <SectionSync />
          <FlowLine />
          <BentoGrid />
          <FlowLine />
          <InteractivePreview />
          <FlowLine />
          <SectionAi />
          <FlowLine />
          <SectionSpirit />
          <FlowLine />
          <SectionSunriseCta />
        </main>
      </LandingScrollProvider>
    </div>
  );
}

function LandingShell() {
  return (
    <div className="madlove-landing">
      <div className="landing-bg-fallback" aria-hidden />
    </div>
  );
}

export function LandingExperience() {
  const reduced = usePrefersReducedMotion();
  if (reduced === null) return <LandingShell />;
  if (reduced) return <ReducedMotionLanding />;
  return <FullLanding />;
}
