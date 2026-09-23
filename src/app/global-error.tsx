"use client";

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
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-[#030104] text-slate-100 min-h-screen flex flex-col items-center justify-center p-4 antialiased">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white font-display select-none">
            {BRAND.name}
          </h1>
          <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-8 backdrop-blur-xl shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-rose-300">
              Application Error
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              We encountered a temporary rendering issue. Please click below to reload the application.
            </p>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/login?force=1";
                } else {
                  reset();
                }
              }}
              className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 py-3 text-xs font-bold text-white hover:from-rose-600 hover:to-pink-700 transition-all shadow-lg shadow-rose-500/20 cursor-pointer"
            >
              Reload {BRAND.name}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
