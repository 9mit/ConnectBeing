"use client";

import { useEffect, useState, useTransition } from "react";

import {
  getVerificationStatusAction,
  revealVerificationCodeAction,
  submitVerificationCodeAction,
} from "@/actions/verification";
import { formatSessionDateTime } from "@/lib/date";

export function VerifyPanel() {
  const [role, setRole] = useState<"revealer" | "submitter" | null>(null);
  const [verifiedUntil, setVerifiedUntil] = useState<string | null>(null);
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [status, setStatus] = useState<"Verified" | "Expired" | null>(null);
  const [expired, setExpired] = useState(false);
  const [dueSoon, setDueSoon] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEarlyExchange, setShowEarlyExchange] = useState(false);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const res = await getVerificationStatusAction();
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setRole(res.data.role);
      setVerifiedUntil(res.data.verifiedUntil);
      setHoursRemaining(res.data.hoursRemaining);
      setIsVerified(res.data.isVerified);
      setStatus(res.data.status);
      setExpired(res.data.expired);
      setDueSoon(res.data.dueSoon);
      setError(null);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  function onReveal() {
    startTransition(async () => {
      setError(null);
      const res = await revealVerificationCodeAction();
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setCode(res.data.code);
      setMessage(`Share this code with your partner before ${formatSessionDateTime(res.data.periodEnd)}.`);
      refresh();
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const res = await submitVerificationCodeAction({ code: input });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setMessage(
        `Weekly verification complete! Both partners are immediately marked as Verified until ${formatSessionDateTime(res.data.verifiedUntil)}.`,
      );
      setInput("");
      setShowEarlyExchange(false);
      refresh();
    });
  }

  const countdown =
    hoursRemaining != null
      ? hoursRemaining >= 24
        ? `${Math.floor(hoursRemaining / 24)}d ${Math.floor(hoursRemaining % 24)}h left`
        : `${Math.floor(hoursRemaining)}h left`
      : null;

  const showCodeExchange = expired || dueSoon || !isVerified || showEarlyExchange;

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-display text-glow-gold">Weekly Verification</h1>
        <p className="mt-2 text-sm text-slate-300 font-medium leading-relaxed">
          Once a week, one partner shares a verification code and the other enters it.
          When verified, both partners remain unlocked until the next verification date.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-purple-950/70 px-4 py-3 text-sm text-amber-200 font-medium shadow-inner">
        {expired ? (
          <div className="space-y-1">
            <p className="text-red-400 font-bold text-base flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
              Status: Expired
            </p>
            <p className="text-xs text-red-300/80">
              Weekly verification expired for both partners. Shared chat, calls, and Together are locked until completed.
            </p>
          </div>
        ) : dueSoon ? (
          <div className="space-y-1">
            <p className="text-amber-300 font-bold text-base flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Status: Verified (Due soon)
              {countdown ? ` · ${countdown}` : ""}
            </p>
            <p className="text-xs text-amber-200/80">
              {verifiedUntil ? `Valid until ${formatSessionDateTime(verifiedUntil)}. ` : ""}
              Exchange this week’s code before it expires to stay verified.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-emerald-300 font-bold text-base flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Status: Verified
              {countdown ? ` · ${countdown}` : ""}
            </p>
            <p className="text-xs text-emerald-200/80">
              Both partners are verified for this period
              {verifiedUntil ? ` until ${formatSessionDateTime(verifiedUntil)}` : ""}.
              Shared features are fully unlocked.
            </p>
          </div>
        )}
      </div>

      {isVerified && !dueSoon && !expired ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-sm space-y-3">
          <div className="flex items-center gap-2.5 text-emerald-300 font-bold">
            <span className="text-lg">✓</span>
            <span>Weekly Verification Active</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Both partners are marked as verified for this period. The status remains{" "}
            <span className="text-emerald-300 font-semibold">“Verified”</span> until{" "}
            {verifiedUntil ? formatSessionDateTime(verifiedUntil) : "the next verification date"}.
            Once that date is reached, the verification status will expire for both partners and require a new weekly verification.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowEarlyExchange((v) => !v)}
              className="text-xs text-amber-300 hover:text-amber-200 underline underline-offset-4 font-semibold"
            >
              {showEarlyExchange ? "Hide code exchange" : "Exchange code early"}
            </button>
          </div>
        </div>
      ) : null}

      {showCodeExchange && role === "revealer" ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-300 font-medium leading-relaxed">
            You hold this week’s code. Show it to your partner so they can enter
            it on their device.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={onReveal}
            className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(212,175,55,0.35)] active:scale-[0.98]"
          >
            {pending ? "Revealing…" : "Show this week’s code"}
          </button>
          {code ? (
            <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-amber-300 bg-purple-950/80 px-6 py-3.5 rounded-xl border border-amber-500/40 inline-block select-all shadow-[0_0_20px_rgba(212,175,55,0.25)]">
              {code}
            </p>
          ) : null}
        </div>
      ) : null}

      {showCodeExchange && role === "submitter" ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-slate-300 font-medium leading-relaxed">
            Ask your partner for this week’s code, then enter it here.
          </p>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="XXXXXXXX"
            aria-label="Verification code"
            className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 font-mono tracking-widest text-base text-white outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
          />
          <button
            type="submit"
            disabled={pending || input.length !== 8}
            className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(212,175,55,0.35)] active:scale-[0.98]"
          >
            {pending ? "Verifying…" : "Verify"}
          </button>
        </form>
      ) : null}

      {message ? <p className="text-sm font-bold text-amber-300 bg-purple-950/80 border border-amber-500/30 px-4 py-2.5 rounded-xl text-center">{message}</p> : null}
      {error ? <p className="text-sm font-bold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center">{error}</p> : null}
    </div>
  );
}
