"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

/** Smooth scroll; reports 0–1 page progress for the universe timeline. */
export function useLenis(onProgress?: (progress: number) => void) {
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    let lenis: Lenis;
    try {
      lenis = new Lenis({
        duration: 1.35,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        orientation: "vertical",
        gestureOrientation: "vertical",
        wheelMultiplier: 0.95,
        touchMultiplier: 1.6,
        autoRaf: false,
      });
    } catch (error) {
      console.error("Lenis init failed:", error);
      return;
    }

    const onScroll = ({ progress }: { progress: number }) => {
      onProgressRef.current?.(Math.min(1, Math.max(0, progress)));
    };
    lenis.on("scroll", onScroll);

    let frameId = 0;
    function raf(time: number) {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    }
    frameId = requestAnimationFrame(raf);

    requestAnimationFrame(() => {
      onProgressRef.current?.(Math.min(1, Math.max(0, lenis.progress)));
    });

    return () => {
      cancelAnimationFrame(frameId);
      lenis.off("scroll", onScroll);
      lenis.destroy();
    };
  }, []);
}
