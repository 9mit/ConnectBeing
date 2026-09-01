"use client";

import { useState, useTransition } from "react";

import { generateInviteLinkAction } from "@/actions/invite";

export function InviteGenerator() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (url) {
      void navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await generateInviteLinkAction();
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            setUrl(result.data.url);
          });
        }}
        className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-6 py-3.5 text-sm font-extrabold text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 transition-all shadow-[0_0_20px_rgba(212,175,55,0.35)]"
      >
        {pending ? "Generating Link…" : "Generate Invite Link"}
      </button>
      
      {url ? (
        <div className="rounded-2xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 space-y-4 shadow-[0_0_25px_rgba(212,175,55,0.12)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Share this link with your partner</p>
            <p className="mt-2.5 break-all text-sm font-bold text-amber-200 font-mono bg-purple-950/60 border border-amber-500/30 p-4 rounded-xl shadow-inner">
              {url}
            </p>
          </div>
          
          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-purple-950 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider hover:from-amber-300 hover:to-amber-500 transition-colors shadow-lg shadow-amber-500/20"
            onClick={handleCopy}
          >
            {copied ? "Copied ✓" : "Copy Link"}
          </button>
        </div>
      ) : null}
      
      {error ? (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center">
          {error}
        </p>
      ) : null}
    </div>
  );
}
