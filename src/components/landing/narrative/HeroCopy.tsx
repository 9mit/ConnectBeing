"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export function HeroCopy() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const prefersReduced = usePrefersReducedMotion();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.setAttribute("webkit-playsinline", "true");
      videoRef.current.setAttribute("playsinline", "true");
      if (!prefersReduced) {
        videoRef.current.muted = true;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            setVideoError(true);
          });
        }
      }
    }
  }, [prefersReduced]);

  return (
    <section
      className="landing-section landing-hero relative min-h-screen min-h-[100dvh] w-full overflow-hidden flex flex-col justify-between items-center text-center px-5 pt-28 pb-10 md:pt-36 md:pb-12"
      aria-label="MadLove sanctuary hero"
    >
      {/* Full-Screen Video Background (Covers 100% of Entire Screen) */}
      <div className="hero-fullscreen-video-container" aria-hidden="true">
        {prefersReduced || videoError ? (
          <Image
            src="/souls-poster.jpg"
            alt="Two luminous souls connecting across space"
            fill
            priority
            sizes="100vw"
            className="hero-fullscreen-video"
          />
        ) : (
          <video
            ref={videoRef}
            poster="/souls-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onLoadedData={() => setVideoLoaded(true)}
            onError={() => setVideoError(true)}
            className={`hero-fullscreen-video transition-opacity duration-1000 ${
              videoLoaded ? "opacity-100" : "opacity-80"
            }`}
            aria-label="Two luminous souls connecting in cosmic warmth"
          >
            <source src="/souls.mp4" type="video/mp4" />
          </video>
        )}
        <div className="hero-fullscreen-scrim" />
      </div>

      {/* Top: Headline */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 flex flex-col items-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-[clamp(2.8rem,7vw,5.5rem)] font-light tracking-[-0.015em] leading-[1.08] text-[#fbf9f4] text-center drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
        >
          Where two souls inhabit <br className="hidden sm:inline" />
          <span className="font-serif italic font-normal text-[#f4efe4]">
            one quiet universe.
          </span>
        </motion.h1>
      </div>

      {/* Center Breathing Room: The souls in the background video float and connect freely across the full screen */}
      <div className="flex-1 w-full min-h-[140px] md:min-h-[200px]" />

      {/* Bottom: Supporting Sentence + Primary CTA + Scroll Indicator */}
      <div className="relative z-10 mx-auto max-w-2xl px-4 flex flex-col items-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-lg text-sm md:text-base text-zinc-200 font-sans font-light leading-relaxed text-balance text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
        >
          A shared digital sanctuary for two — private, unhurried, and built for lasting intimacy.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 flex items-center justify-center w-full sm:w-auto"
        >
          <Link
            href="/register"
            className="btn-cta-primary"
          >
            <span>Begin Our Story</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.45 }}
          className="mt-6 md:mt-8"
        >
          <a href="#why-madlove" className="hero-scroll-hint" aria-label="Explore the sanctuary">
            <span>Scroll</span>
            <div className="hero-scroll-line" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
