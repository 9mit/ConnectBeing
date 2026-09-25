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
  return (
    <Link
      href="/begin"
      className={className}
      aria-label="Begin Sanctuary — Begin Our Story"
    >
      {children ? (
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

