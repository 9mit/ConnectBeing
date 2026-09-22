import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Heart, ShieldAlert, AlertTriangle, ArrowLeft } from "lucide-react";

import { getInvitePreviewAction } from "@/actions/invite";
import { InviteAcceptCard } from "@/components/invite-accept-card";
import { InvitePreviewBanner } from "@/components/invite-preview-banner";
import { db } from "@/db";
import { inviteTokens, onboardingProfiles } from "@/db/schema";
import { getAuthenticatedUserContext } from "@/lib/auth";
import { hashInviteToken } from "@/lib/crypto/invite-token";
import { setPendingInviteCookie } from "@/lib/invite-cookie";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export default async function InviteTokenPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;

  // Set HTTP-only cookie so invite token survives auth transitions
  if (/^[a-f0-9]{64}$/i.test(token)) {
    setPendingInviteCookie(token);
  }

  // Authoritative server-side identity & couple resolution
  const ctx = await getAuthenticatedUserContext();

  // Validate token format and check token in database
  let tokenValid = false;
  let tokenStatus = "invalid";
  let inviterName = "Your partner";

  if (/^[a-f0-9]{64}$/i.test(token)) {
    const tokenHash = hashInviteToken(token);
    const tokenRow = await db.query.inviteTokens.findFirst({
      where: eq(inviteTokens.tokenHash, tokenHash),
    });

    if (tokenRow) {
      if (tokenRow.status === "accepted" || tokenRow.used) {
        tokenStatus = "used";
      } else if (tokenRow.status === "revoked") {
        tokenStatus = "revoked";
      } else if (tokenRow.expiresAt.getTime() <= Date.now()) {
        tokenStatus = "expired";
      } else {
        tokenValid = true;
        tokenStatus = "valid";

        const inviterProfile = await db.query.onboardingProfiles.findFirst({
          where: eq(onboardingProfiles.userId, tokenRow.inviterId),
        });
        if (inviterProfile?.name) {
          inviterName = inviterProfile.name.trim();
        }

        // Partner B opened the link — mark in Redis so Partner A's screen updates in real-time
        if (!ctx.user || ctx.user.id !== tokenRow.inviterId) {
          try {
            await redis.set(`invite-opened:${tokenRow.inviterId}`, "true", { ex: 3600 });
          } catch {
            /* ignore redis error */
          }
        }
      }
    }
  }

  // 1. Invalid, Expired, Revoked, or Already Used Token
  if (!tokenValid) {
    let title = "Invite Link Unavailable";
    let message = "This invitation link is invalid or no longer active.";

    if (tokenStatus === "used") {
      title = "Invite Already Used";
      message = "This single-use invitation has already been accepted and joined.";
    } else if (tokenStatus === "expired") {
      title = "Invite Expired";
      message = "This invitation link has expired. Ask your partner to generate a new invite link.";
    } else if (tokenStatus === "revoked") {
      title = "Invite Cancelled";
      message = "This invitation was cancelled or replaced with a newer link.";
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07020f] text-slate-100 px-4 py-12 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] opacity-15 bg-rose-500 pointer-events-none" />
        <div className="w-full max-w-md p-8 rounded-3xl border border-white/10 bg-purple-950/40 backdrop-blur-xl text-center space-y-5 shadow-2xl relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 mx-auto text-2xl">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white font-display">{title}</h1>
            <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
          </div>
          <div className="pt-2 flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="py-3 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wider hover:brightness-110 transition-all text-center"
            >
              Go to Home
            </Link>
            <Link
              href="/login"
              className="py-3 px-6 rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 font-semibold text-xs hover:bg-white/[0.08] transition-all text-center"
            >
              Sign in with different account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated User -> Safe Public Preview + Prompt Auth
  if (ctx.onboardingStatus === "unauthenticated" || !ctx.user) {
    const preview = await getInvitePreviewAction(token);

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07020f] text-slate-100 px-4 py-12 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[140px] opacity-20 bg-gradient-to-br from-amber-500 via-rose-500 to-purple-600 pointer-events-none" />

        <div className="w-full max-w-md text-center space-y-8 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-purple-950/60 text-[11px] font-bold uppercase tracking-widest text-amber-300 mb-3">
              <span>✨</span> MadLove Sanctuary
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 font-display text-glow-gold">
              Your Partner Invited You
            </h1>
            <p className="text-sm text-slate-300 mt-2">
              <strong className="text-amber-300">{inviterName}</strong> has created a private couple space for the two of you.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-purple-950/80 to-[#0a0214]/90 backdrop-blur-2xl shadow-[0_0_35px_rgba(212,175,55,0.2)] space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-amber-500/30 flex items-center justify-center text-3xl mx-auto shadow-inner">
              ❤️
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Step 1 of 2: Authenticate
              </p>
              <h2 className="text-xl font-bold text-white font-display">
                Continue with Email to Join
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Sign in or create your private account. Your invitation will be waiting for your explicit confirmation after sign-in.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                href={`/register?token=${encodeURIComponent(token)}`}
                className="w-full block py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-extrabold text-xs uppercase tracking-wider hover:brightness-110 transition-all shadow-[0_0_25px_rgba(212,175,55,0.3)] text-center"
              >
                Create Account & Join
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                className="w-full block py-3 px-6 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] text-xs font-semibold transition-all text-center"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. User Already in an Active Couple -> Safe Conflict Resolution (NO silent reassignment)
  if (ctx.onboardingStatus === "paired" && ctx.activeCouple) {
    const currentPartnerName = ctx.partner?.profile?.name || "your partner";

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07020f] text-slate-100 px-4 py-12 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] opacity-15 bg-amber-500 pointer-events-none" />

        <div className="w-full max-w-md p-8 rounded-3xl border border-amber-500/40 bg-purple-950/80 backdrop-blur-2xl text-center space-y-6 shadow-2xl relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 mx-auto text-3xl">
            <ShieldAlert className="w-8 h-8 text-amber-400" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              Relationship Conflict Protection
            </div>
            <h1 className="text-2xl font-extrabold text-white font-display text-glow-gold">
              Already Connected
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              You are currently connected to <strong className="text-amber-300">{currentPartnerName}</strong> in MadLove.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              To protect the integrity of your sanctuary, you cannot join another couple while in an active relationship.
            </p>
          </div>

          <div className="pt-3">
            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-extrabold text-xs uppercase tracking-wider hover:brightness-110 transition-all shadow-[0_0_25px_rgba(212,175,55,0.3)] text-center"
            >
              <span>Return to My Sanctuary</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated User without Profile -> Redirect to Onboarding
  if (ctx.onboardingStatus === "needs_profile" || !ctx.user.isOnboarded) {
    await redis.set(`pending-invite:${ctx.user.id}`, token, { ex: 60 * 60 * 24 });
    redirect("/onboarding");
  }

  // 5. Authenticated + Onboarded + Unpaired -> Explicit Confirmation ("Join Our Story")
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07020f] text-slate-100 px-4 py-12 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[140px] opacity-25 bg-gradient-to-br from-amber-500 via-rose-500 to-purple-600 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <InviteAcceptCard token={token} partnerName={inviterName} />
      </div>
    </div>
  );
}
