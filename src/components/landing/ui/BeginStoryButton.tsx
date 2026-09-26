"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
  const [loading, setLoading] = React.useState(false);

  return (
    <Link
      href="/begin"
      onClick={() => setLoading(true)}
      className={`${className} ${loading ? "opacity-85 pointer-events-none" : ""}`}
      aria-label="Begin Sanctuary — Begin Our Story"
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          <span>Entering…</span>
        </span>
      ) : children ? (
        children
      ) : (
        <>
          <span>Begin Our Story</span>
          {showIcon && <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
        </>
      )}
    </Link>
  );
}

