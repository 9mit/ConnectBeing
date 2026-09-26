"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimers = useCallback(() => {
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  }, []);

  const startProgress = useCallback(() => {
    stopTimers();
    setVisible(true);
    setProgress(25);

    // Incrementally crawl towards ~85% while loading
    animTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) return prev;
        const diff = 85 - prev;
        return prev + Math.max(1, Math.floor(diff * 0.15));
      });
    }, 150);

    // Safety fallback: cancel after 8 seconds if navigation never arrived
    safetyTimerRef.current = setTimeout(() => {
      stopTimers();
      setProgress(100);
      fadeTimerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
    }, 8000);
  }, [stopTimers]);

  const completeProgress = useCallback(() => {
    stopTimers();
    setProgress(100);
    fadeTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  }, [stopTimers]);

  // Complete progress on route change
  useEffect(() => {
    completeProgress();
    return () => stopTimers();
  }, [pathname, searchParams, completeProgress, stopTimers]);

  // Global click interception for seamless internal navigation feedback
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // Ignore right clicks or clicks with modifiers
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      // Check if target or any parent is an anchor
      let target = e.target as HTMLElement | null;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }

      if (!target || target.tagName !== "A") return;
      const anchor = target as HTMLAnchorElement;

      // Ignore download, target="_blank", or protocol links
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

      // Handle same-page hash jumps
      if (href.startsWith("#")) return;

      try {
        const url = new URL(anchor.href, window.location.origin);
        // Only trigger for same-origin routes
        if (url.origin !== window.location.origin) return;

        // Ignore same URL navigation or in-page hash transitions
        const currentUrl = new URL(window.location.href);
        if (url.pathname === currentUrl.pathname && url.search === currentUrl.search) {
          return;
        }

        // Start instantaneous loading animation
        startProgress();
      } catch {
        // Not a standard URL
      }
    };

    const handleStart = () => startProgress();
    const handleDone = () => completeProgress();
    window.addEventListener("route-progress:start", handleStart);
    window.addEventListener("route-progress:done", handleDone);
    document.addEventListener("click", handleDocumentClick, { capture: true });

    return () => {
      window.removeEventListener("route-progress:start", handleStart);
      window.removeEventListener("route-progress:done", handleDone);
      document.removeEventListener("click", handleDocumentClick, { capture: true });
      stopTimers();
    };
  }, [startProgress, completeProgress, stopTimers]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[99999] h-[2.5px] pointer-events-none overflow-hidden transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-rose-400 shadow-[0_0_12px_rgba(245,158,11,0.9)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? "150ms" : "250ms",
        }}
      />
    </div>
  );
}
