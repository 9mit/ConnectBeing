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
    <div className="space-y-6 rounded-3xl glass-panel border border-white/10 bg-[#0c0d0e]/80 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white font-serif">
          Community Infrastructure Support
        </h2>
        <p className="mt-2 text-sm text-zinc-300 font-sans leading-relaxed">
          MadLove is engineered to run at near-$0 initial operating cost using local intelligence,
          peer-to-peer WebRTC, and open-source models. Every couple gets unlimited encrypted chat,
          calling, movie sync, and memories for free.
        </p>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2 text-xs text-zinc-300">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 font-medium">Your Sanctuary Access:</span>
          <span className="font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            100% Unlocked · Free Forever
          </span>
        </div>
        <p className="text-[11px] text-zinc-400">
          No subscriptions, no ads, no paywalls, and no artificial daily limits.
        </p>
      </div>

      {error ? (
        <p
          className="text-xs font-semibold text-red-300 bg-red-950/80 border border-red-500/40 px-4 py-2.5 rounded-xl text-center shadow-md"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        {!premium ? (
          <button
            type="button"
            disabled={pending}
            onClick={subscribe}
            className="rounded-xl btn-cta-primary px-6 py-3 text-xs font-bold text-black disabled:opacity-50 transition-all hover:scale-105"
          >
            Send Optional Community Tip
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || data.cancelAtPeriodEnd}
            onClick={cancel}
            className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-xs font-bold text-zinc-300 hover:bg-white/10 transition-colors active:scale-95"
          >
            Cancel recurring tip
          </button>
        )}
      </div>

      <ul className="list-disc space-y-1.5 pl-5 text-xs text-zinc-400 font-sans border-t border-white/10 pt-4">
        <li>Private couple space with zero third-party trackers or ads</li>
        <li>On-device Relationship Intelligence Engine (RIE) preserving total privacy</li>
        <li>Direct WebRTC voice and video calls with Google STUN</li>
      </ul>
    </div>
  );
}
