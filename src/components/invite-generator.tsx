"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Heart, Check, Copy, ArrowRight } from "lucide-react";

import { generateInviteLinkAction, checkPartnerJoinedAction } from "@/actions/invite";

export function InviteGenerator() {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState<{
    partnerName: string;
  } | null>(null);

  const handleCopy = () => {
    if (url) {
      void navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Poll for partner joining when user is on this screen
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await checkPartnerJoinedAction();
        if (res.ok && res.data.hasJoined) {
          setPartnerJoined({
            partnerName: res.data.partnerName || "Your partner",
          });
          clearInterval(interval);
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 3500);
        }
      } catch {
        /* ignore polling errors */
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [router]);

  if (partnerJoined) {
    return (
      <div className="rounded-3xl border border-amber-500/50 bg-gradient-to-b from-purple-950/80 to-[#0c0418] p-8 text-center space-y-6 shadow-[0_0_40px_rgba(212,175,55,0.3)] animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 border border-amber-300 flex items-center justify-center text-3xl mx-auto shadow-[0_0_25px_rgba(244,63,94,0.4)] animate-bounce">
          🎉
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-300 text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> Connection Established
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display text-glow-gold">
            Your Partner Is Here!
          </h2>
          <p className="text-sm text-slate-200 max-w-md mx-auto leading-relaxed">
            <strong className="text-amber-300">{partnerJoined.partnerName}</strong> has accepted your invite and entered your private home.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
            className="w-full sm:w-auto py-3.5 px-8 rounded-2xl border border-amber-500/60 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-extrabold text-xs uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 mx-auto shadow-[0_0_25px_rgba(212,175,55,0.35)]"
          >
            <span>Enter Sanctuary With {partnerJoined.partnerName}</span>
            <Heart className="w-4 h-4 fill-current text-rose-700" />
          </button>
          <p className="text-[11px] text-slate-400 mt-3">Redirecting automatically in a moment…</p>
        </div>
      </div>
    );
  }

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
        className="rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-6 py-3.5 text-sm font-extrabold text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 transition-all shadow-[0_0_20px_rgba(212,175,55,0.35)] flex items-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        <span>{pending ? "Generating Link…" : "Generate Invite Link"}</span>
      </button>

      {url ? (
        <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 space-y-4 shadow-[0_0_25px_rgba(212,175,55,0.12)]">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Share this link with your partner
              </p>
              <span className="text-[10px] text-amber-400/80 animate-pulse font-medium">
                • Waiting for partner to open link…
              </span>
            </div>
            <p className="mt-2.5 break-all text-sm font-bold text-amber-200 font-mono bg-purple-950/60 border border-amber-500/30 p-4 rounded-2xl shadow-inner">
              {url}
            </p>
          </div>

          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-purple-950 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider hover:from-amber-300 hover:to-amber-500 transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied ✓</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
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
