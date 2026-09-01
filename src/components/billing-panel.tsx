"use client";

import { useEffect, useState, useTransition } from "react";

import {
  cancelPremiumSubscriptionAction,
  createPremiumSubscriptionAction,
  getBillingStatusAction,
} from "@/actions/billing";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

export function BillingPanel() {
  const [status, setStatus] = useState<Awaited<
    ReturnType<typeof getBillingStatusAction>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void getBillingStatusAction().then(setStatus);
  }, []);

  function refresh() {
    void getBillingStatusAction().then(setStatus);
  }

  function subscribe() {
    setError(null);
    startTransition(async () => {
      try {
        await loadRazorpayScript();
        const result = await createPremiumSubscriptionAction();
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        const rzp = new window.Razorpay!({
          key: result.data.keyId,
          subscription_id: result.data.subscriptionId,
          name: "MadLove Support",
          description: "Optional tip — all features stay free",
          prefill: {
            email: result.data.email,
            name: result.data.name,
          },
          handler: () => refresh(),
        });
        rzp.open();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed");
      }
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelPremiumSubscriptionAction();
      if (!result.ok) setError(result.error.message);
      else refresh();
    });
  }

  if (!status) {
    return <p className="text-sm text-amber-300/80 italic">Loading billing…</p>;
  }
  if (!status.ok) {
    return <p className="text-sm text-red-300 font-semibold bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl">{status.error.message}</p>;
  }

  const data = status.data;
  const premium = data.tier === "premium";

  return (
    <div className="space-y-6 rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white font-display text-glow-gold">Support MadLove</h2>
        <p className="mt-2 text-sm text-slate-300 font-medium">
          Status: <strong className="text-amber-300 capitalize font-bold text-glow-gold">{data.tier}</strong>
          {data.status ? ` · ${data.status}` : ""} — every feature stays free
        </p>
        {data.currentPeriodEnd ? (
          <p className="mt-1.5 text-xs text-amber-400/70 font-medium">
            Period ends {new Date(data.currentPeriodEnd).toLocaleDateString()}
            {data.cancelAtPeriodEnd ? " · cancels at period end" : ""}
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs font-semibold text-amber-200 bg-purple-950/80 border border-amber-500/40 px-4 py-2.5 rounded-xl text-center shadow-md" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {!premium ? (
          <button
            type="button"
            disabled={pending}
            onClick={subscribe}
            className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider text-purple-950 hover:from-amber-300 hover:to-amber-500 transition-all shadow-[0_0_20px_rgba(212,175,55,0.35)] active:scale-[0.98] disabled:opacity-50"
          >
            Send optional tip
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || data.cancelAtPeriodEnd}
            onClick={cancel}
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500 hover:text-purple-950 transition-all active:scale-[0.98]"
          >
            Cancel at period end
          </button>
        )}
      </div>
      <ul className="list-disc space-y-2 pl-5 text-xs text-slate-300 font-medium border-t border-amber-500/20 pt-4">
        <li>All core MadLove features are free — powered by local RIE</li>
        <li>Optional support tip via Razorpay (never required for quiz/insights)</li>
      </ul>
    </div>
  );
}
