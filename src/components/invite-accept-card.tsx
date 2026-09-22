"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Sparkles, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

import { acceptCoupleInviteAction } from "@/actions/invite";

interface InviteAcceptCardProps {
  token: string;
  partnerName: string;
}

export function InviteAcceptCard({ token, partnerName }: InviteAcceptCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      const res = await acceptCoupleInviteAction(token);
      if (!res.ok) {
        setError(res.error.message || "Failed to join relationship space.");
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push(res.data.redirectTo || "/dashboard");
        router.refresh();
      }, 1000);
    });
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto p-8 rounded-3xl border border-amber-500/50 bg-gradient-to-b from-purple-950/90 to-[#0c0418] text-center space-y-5 shadow-[0_0_40px_rgba(212,175,55,0.3)] animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 border border-amber-300 flex items-center justify-center text-3xl mx-auto shadow-[0_0_25px_rgba(244,63,94,0.4)] animate-bounce">
          ❤️
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-white font-display text-glow-gold">
            Sanctuary Connected!
          </h2>
          <p className="text-sm text-slate-300">
            You and <strong className="text-amber-300">{partnerName}</strong> are now permanently connected. Entering your private home…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-8 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-purple-950/80 via-[#0d041c]/90 to-[#07020f] backdrop-blur-2xl shadow-[0_0_40px_rgba(212,175,55,0.15)] space-y-6 text-center">
      {/* Icon Badge */}
      <div className="relative mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-rose-500/20 via-purple-500/20 to-amber-500/20 border border-amber-500/30 flex items-center justify-center shadow-inner">
        <Heart className="w-10 h-10 text-rose-400 fill-rose-400/30 animate-pulse" />
        <Sparkles className="w-5 h-5 text-amber-300 absolute -top-1 -right-1" />
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-[11px] font-bold uppercase tracking-widest text-amber-300">
          <ShieldCheck className="w-3.5 h-3.5" /> Private Invitation
        </div>
        <h2 className="text-3xl font-extrabold text-white font-display tracking-tight text-glow-gold">
          Join {partnerName}
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed max-w-xs mx-auto">
          You are invited to join <strong className="text-amber-300">{partnerName}</strong>&apos;s private, end-to-end encrypted MadLove sanctuary.
        </p>
      </div>

      {/* Trust Details */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] text-xs text-slate-400 text-left space-y-2">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <span className="text-amber-400">✓</span>
          <span>Exclusive 2-person digital home</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <span className="text-amber-400">✓</span>
          <span>Persistent couple identity across all devices</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <span className="text-amber-400">✓</span>
          <span>Private memories, mood tracker, and theater</span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3.5 rounded-xl border border-red-500/40 bg-red-950/70 text-red-200 text-xs flex items-center gap-2 text-left">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action CTA */}
      <button
        type="button"
        disabled={pending}
        onClick={handleAccept}
        className="w-full py-4 px-6 rounded-2xl border border-amber-400/80 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-extrabold text-sm uppercase tracking-wider hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(212,175,55,0.35)] active:scale-[0.99]"
      >
        <span>{pending ? "Connecting Relationship…" : "Join Our Story"}</span>
        <ArrowRight className="w-4 h-4 text-slate-950" />
      </button>

      <p className="text-[11px] text-slate-500">
        By clicking &quot;Join Our Story&quot;, your account will be permanently linked with {partnerName}.
      </p>
    </div>
  );
}
