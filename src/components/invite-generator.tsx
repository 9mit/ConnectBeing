"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Heart, Check, Copy, RefreshCw, ShieldCheck, Eye } from "lucide-react";

import {
  generateInviteLinkAction,
  checkPartnerJoinedAction,
  getActiveInviteAction,
} from "@/actions/invite";

export function InviteGenerator() {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [partnerOpened, setPartnerOpened] = useState(false);
  const [loadingActive, setLoadingActive] = useState(true);
  const [partnerJoined, setPartnerJoined] = useState<{
    partnerName: string;
  } | null>(null);

  // Load existing active invite if one exists
  useEffect(() => {
    let mounted = true;
    getActiveInviteAction()
      .then((res) => {
        if (mounted && res.ok && res.data.url) {
          setUrl(res.data.url);
          if (res.data.hasOpened) {
            setPartnerOpened(true);
          }
        }
      })
      .catch(() => {
        /* ignore fetch errors on mount */
      })
      .finally(() => {
        if (mounted) setLoadingActive(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleCopy = async () => {
    if (!url) return;
    let ok = false;
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok && typeof document !== "undefined") {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        ok = document.execCommand("copy");
        textArea.remove();
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateInviteLinkAction();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setUrl(result.data.url);
      setPartnerOpened(false);
    });
  };

  // Poll for partner opening link or joining sanctuary
  useEffect(() => {
    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(async () => {
      try {
        const res = await checkPartnerJoinedAction();
        if (cancelled || !res.ok) return;

        if (res.data.hasOpened) {
          setPartnerOpened(true);
        }

        // Only transition when partner has actually entered and accepted
        if (res.data.hasJoined) {
          setPartnerJoined({
            partnerName: res.data.partnerName || "Your partner",
          });
          clearInterval(interval);
          redirectTimer = setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 3500);
        }
      } catch {
        /* ignore polling errors */
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [router]);

  // Partner has officially joined! Show celebration modal before redirect
  if (partnerJoined) {
    return (
      <div className="rounded-3xl border border-amber-500/50 bg-gradient-to-b from-purple-950/90 via-[#0e041d] to-[#07020f] p-8 text-center space-y-6 shadow-[0_0_50px_rgba(212,175,55,0.35)] animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 border-2 border-amber-300 flex items-center justify-center text-4xl mx-auto shadow-[0_0_35px_rgba(244,63,94,0.5)] animate-bounce">
          🎉
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-300 text-xs font-bold uppercase tracking-widest shadow-inner">
            <Sparkles className="w-3.5 h-3.5" /> Connection Established
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display text-glow-gold tracking-tight">
            Your Partner Is Here!
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-md mx-auto leading-relaxed">
            <strong className="text-amber-300 font-bold">{partnerJoined.partnerName}</strong> has accepted your invite and entered your private home.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
            className="w-full sm:w-auto py-4 px-9 rounded-2xl border border-amber-400/80 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-extrabold text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 mx-auto shadow-[0_0_30px_rgba(212,175,55,0.4)]"
          >
            <span>Enter Sanctuary With {partnerJoined.partnerName}</span>
            <Heart className="w-4 h-4 fill-current text-rose-800" />
          </button>
          <p className="text-[11px] text-slate-400 mt-3 font-medium animate-pulse">
            Redirecting automatically in a moment…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!url ? (
        <button
          type="button"
          disabled={pending || loadingActive}
          onClick={handleGenerate}
          className="rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-7 py-4 text-sm font-extrabold text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 transition-all shadow-[0_0_25px_rgba(212,175,55,0.35)] flex items-center gap-2.5 active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4" />
          <span>
            {loadingActive
              ? "Checking Invite…"
              : pending
              ? "Generating Link…"
              : "Generate Invite Link"}
          </span>
        </button>
      ) : null}

      {url ? (
        <div className="rounded-3xl glass-panel border border-amber-500/40 bg-gradient-to-b from-purple-950/60 to-[#0d031c]/90 p-6 sm:p-7 space-y-5 shadow-[0_0_30px_rgba(212,175,55,0.15)] animate-in fade-in duration-300">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Share this link with your partner</span>
              </p>

              {partnerOpened ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 self-start sm:self-auto shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <Eye className="w-3 h-3 text-emerald-400" />
                  <span>Partner opened link! Waiting to join…</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-amber-300/90 bg-amber-500/10 border border-amber-500/20 self-start sm:self-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>Waiting for partner to open link…</span>
                </span>
              )}
            </div>

            <div className="mt-3 relative group">
              <p className="break-all text-xs sm:text-sm font-bold text-amber-200 font-mono bg-purple-950/70 border border-amber-500/30 p-4 rounded-2xl shadow-inner select-all">
                {url}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              className={`rounded-xl px-6 py-3 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg ${
                copied
                  ? "bg-emerald-500 text-slate-950 shadow-emerald-500/25 scale-[1.02]"
                  : "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-purple-950 hover:from-amber-300 hover:to-amber-500 shadow-amber-500/25 active:scale-[0.98]"
              }`}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={handleGenerate}
              className="rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white px-4 py-3 text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`} />
              <span>{pending ? "Generating…" : "Generate New Link"}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed border-t border-white/5 pt-3">
            💡 Send this link to your partner via WhatsApp, SMS, or any private message.
            As soon as they enter and join, you&apos;ll be connected automatically!
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center shadow-inner">
          {error}
        </p>
      ) : null}
    </div>
  );
}
