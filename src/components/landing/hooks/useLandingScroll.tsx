"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  useMotionValue,
  useSpring,
  type MotionValue,
} from "framer-motion";

import { useLenis } from "./useLenis";

type LandingScrollContextValue = {
  progress: MotionValue<number>;
  progressRef: MutableRefObject<number>;
  mouse: MotionValue<{ x: number; y: number }>;
};

const LandingScrollContext = createContext<LandingScrollContextValue | null>(
  null,
);

export function LandingScrollProvider({
  children,
  progressRef,
}: {
  children: ReactNode;
  progressRef: MutableRefObject<number>;
}) {
  const raw = useMotionValue(0);
  const progress = useSpring(raw, {
    stiffness: 55,
    damping: 28,
    mass: 0.45,
  });
  const mouse = useMotionValue({ x: 0.5, y: 0.5 });

  const onLenisProgress = useCallback(
    (p: number) => {
      progressRef.current = p;
      raw.set(p);
      const root = document.querySelector(
        ".madlove-landing",
      ) as HTMLElement | null;
      root?.style.setProperty("--universe-warmth", String(p));
    },
    [progressRef, raw],
  );

  useLenis(onLenisProgress);

  useEffect(() => {
    const unsub = progress.on("change", (v) => {
      progressRef.current = v;
    });
    return unsub;
  }, [progress, progressRef]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.set({
        x: e.clientX / window.innerWidth,
        y: 1 - e.clientY / window.innerHeight,
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mouse]);

  const value = useMemo(
    () => ({ progress, progressRef, mouse }),
    [progress, progressRef, mouse],
  );

  return (
    <LandingScrollContext.Provider value={value}>
      {children}
    </LandingScrollContext.Provider>
  );
}

export function useLandingScroll() {
  const ctx = useContext(LandingScrollContext);
  if (!ctx) {
    throw new Error("useLandingScroll must be used within LandingScrollProvider");
  }
  return ctx;
}
