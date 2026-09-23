"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled Application Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#070305] text-slate-100 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-[0.15] bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-md text-center space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-white font-display select-none">
          {BRAND.name}
        </h1>
        <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-8 backdrop-blur-xl shadow-2xl space-y-4">
          <h2 className="text-lg font-bold text-rose-300">
            Something went wrong
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            An unexpected error occurred while rendering this page. You can try refreshing or returning to the home page.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => reset()}
              className="rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-xs font-bold text-white hover:from-rose-600 hover:to-pink-700 transition-all shadow-lg shadow-rose-500/20 cursor-pointer"
            >
              Try Again
            </button>
            <Link
              href="/login?force=1"
              className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.08] transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
