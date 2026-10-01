"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles, Download } from "lucide-react";

interface DoodleHeaderProps {
  partnerPresent: boolean;
  partnerDrawing: boolean;
  partnerName?: string;
  onDownloadClick?: () => void;
}

export function DoodleHeader({
  partnerPresent,
  partnerDrawing,
  partnerName,
  onDownloadClick,
}: DoodleHeaderProps) {
  const partnerLabel = partnerName || "Partner";

  return (
    <header className="flex items-center justify-between gap-3 w-full pb-2">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-2 -ml-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label="Back to sanctuary"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-serif text-lg sm:text-xl font-light text-[#f7f6f2] tracking-wide flex items-center gap-2">
            <span>Our Little Canvas</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-200/70" />
          </h1>
          <p className="text-[11px] text-zinc-400 font-light hidden sm:block">
            A quiet shared sketchbook for two
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Partner Presence & Live Drawing Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs">
          <span
            className={`h-2 w-2 rounded-full shrink-0 transition-all duration-300 ${
              partnerDrawing
                ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse"
                : partnerPresent
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                : "bg-zinc-600"
            }`}
            aria-hidden="true"
          />
          <span
            className={`text-[11px] sm:text-xs truncate font-medium ${
              partnerDrawing
                ? "text-amber-200"
                : partnerPresent
                ? "text-[#f7f6f2]"
                : "text-zinc-400"
            }`}
          >
            {partnerDrawing ? (
              <span className="flex items-center gap-1">
                <span>{partnerLabel} is drawing…</span>
              </span>
            ) : partnerPresent ? (
              `${partnerLabel} is here`
            ) : (
              `${partnerLabel} away`
            )}
          </span>
        </div>

        {/* Optional Download snapshot */}
        {onDownloadClick && (
          <button
            type="button"
            onClick={onDownloadClick}
            title="Save drawing to device"
            aria-label="Save drawing"
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
