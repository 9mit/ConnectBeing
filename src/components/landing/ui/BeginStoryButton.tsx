"use client";

import React, { useState, useEffect, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

interface BeginStoryButtonProps {
  className?: string;
  children?: React.ReactNode;
  showIcon?: boolean;
}

export function BeginStoryButton({
  className = "btn-cta-primary",
  children,
  showIcon = true,
}: BeginStoryButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);

  // Safety timer to clear navigating lock if navigation is aborted or taking unusually long
  useEffect(() => {
    if (!isNavigating) return;
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [isNavigating]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If opening in new tab or middle-click, allow default browser behavior
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
      return;
    }

    // Prevent duplicate rapid clicks
    if (isNavigating || isPending) {
      e.preventDefault();
      return;
    }

    setIsNavigating(true);

    // Prefer standard top-level navigation to ensure fresh server-side evaluation
    // and full cookie synchronization across redirects
    startTransition(() => {
      window.location.assign("/begin");
    });
  };

  const busy = isNavigating || isPending;

  return (
    <a
      href="/begin"
      onClick={handleClick}
      role="button"
      aria-disabled={busy}
      aria-busy={busy}
      className={`${className} ${busy ? "opacity-80 pointer-events-none cursor-wait" : ""}`}
      tabIndex={busy ? -1 : 0}
    >
      {children ? (
        children
      ) : (
        <>
          <span>{busy ? "Entering sanctuary..." : "Begin Our Story"}</span>
          {showIcon && (
            busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )
          )}
        </>
      )}
    </a>
  );
}
