"use client";

import { useEffect, useState, useTransition } from "react";

import {
  getVerificationStatusAction,
  revealVerificationCodeAction,
  submitVerificationCodeAction,
} from "@/actions/verification";

export function VerifyPanel() {
  const [role, setRole] = useState<"revealer" | "submitter" | null>(null);
  const [verifiedUntil, setVerifiedUntil] = useState<string | null>(null);
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [dueSoon, setDueSoon] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setMessage(`Share this code with your partner before ${new Date(res.data.periodEnd).toLocaleString()}.`);
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
      setMessage("You’re verified for another week. Shared features are unlocked.");
      setInput("");
      refresh();
    });
  }

  const countdown =
    hoursRemaining != null
      ? hoursRemaining >= 24
        ? `${Math.floor(hoursRemaining / 24)}d ${Math.floor(hoursRemaining % 24)}h left`
        : `${Math.floor(hoursRemaining)}h left`
      : null;

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-display text-glow-gold">Weekly Verification</h1>
        <p className="mt-2 text-sm text-slate-300 font-medium leading-relaxed">
          Once a week, one partner shares a code and the other enters it. This
          keeps shared chat, calls, and Together unlocked.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-purple-950/70 px-4 py-3 text-sm text-amber-200 font-medium shadow-inner">
        {expired ? (
          <p className="text-red-400 font-bold">Verification expired — shared features are locked until you complete this.</p>
        ) : dueSoon ? (
          <p className="text-amber-300 font-bold">Verification due soon{countdown ? ` · ${countdown}` : ""}.</p>
        ) : (
          <p suppressHydrationWarning>
            Status: active
            {countdown ? ` · ${countdown}` : ""}
            {verifiedUntil
              ? ` · until ${new Date(verifiedUntil).toLocaleString()}`
              : ""}
          </p>
        )}
      </div>

      {role === "revealer" ? (
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
            Show this week’s code
          </button>
          {code ? (
            <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-amber-300 bg-purple-950/80 px-6 py-3.5 rounded-xl border border-amber-500/40 inline-block select-all shadow-[0_0_20px_rgba(212,175,55,0.25)]">
              {code}
            </p>
          ) : null}
        </div>
      ) : null}

      {role === "submitter" ? (
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
            Verify
          </button>
        </form>
      ) : null}

      {message ? <p className="text-sm font-bold text-amber-300 bg-purple-950/80 border border-amber-500/30 px-4 py-2.5 rounded-xl text-center">{message}</p> : null}
      {error ? <p className="text-sm font-bold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center">{error}</p> : null}
    </div>
  );
}
