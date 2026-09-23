import Link from "next/link";
import { redirect } from "next/navigation";

import { requireOnboardedUser, redirectPathForAuthError } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function OnboardingDecisionPage() {
  let user;
  try {
    user = await requireOnboardedUser();
  } catch (error) {
    redirect(redirectPathForAuthError(error));
  }

  // If already in an active couple, go straight to dashboard
  if (user.couple && user.couple.status === "active") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#07020f] text-slate-100 px-4 py-16 relative overflow-hidden flex items-center justify-center">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[140px] opacity-20 bg-gradient-to-br from-amber-500 via-rose-500 to-purple-600 pointer-events-none" />
      <div className="absolute bottom-10 -right-20 w-[400px] h-[400px] rounded-full blur-[120px] opacity-15 bg-amber-400 pointer-events-none" />

      <div className="mx-auto max-w-2xl relative z-10 space-y-10 text-center w-full">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-purple-950/60 text-[11px] font-bold uppercase tracking-widest text-amber-300">
            <span>✨</span> {BRAND.name} Sanctuary
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 font-display text-glow-gold">
            Do you already have someone?
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto leading-relaxed">
            {BRAND.name} is crafted for authentic, private connection. Choose how you would like to begin.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 text-left">
          {/* Card A: I have my person */}
          <Link
            href="/invite"
            className="group relative flex flex-col justify-between p-8 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-purple-950/70 to-[#0c0418]/90 backdrop-blur-2xl hover:border-amber-400 hover:shadow-[0_0_35px_rgba(212,175,55,0.25)] transition-all duration-300"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-amber-500/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                ❤️
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
                  Primary Path
                </span>
                <h2 className="text-2xl font-bold text-white font-display mt-0.5 group-hover:text-amber-200 transition-colors">
                  I have my person
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Generate a single-use, cryptographically verified partner link to unlock your private 2-person digital home.
              </p>
            </div>

            <div className="mt-8 pt-4 border-t border-amber-500/15 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-300 group-hover:text-amber-100">
              <span>Create Partner Invite</span>
              <span className="text-lg">→</span>
            </div>
          </Link>

          {/* Card B: I wanna try my luck */}
          <Link
            href="/matchmaking"
            className="group relative flex flex-col justify-between p-8 rounded-3xl border border-purple-800/40 bg-gradient-to-b from-purple-950/40 to-[#0a0316]/90 backdrop-blur-2xl hover:border-amber-500/50 hover:shadow-[0_0_35px_rgba(168,85,247,0.2)] transition-all duration-300"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                ✨
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
                  Discovery Layer
                </span>
                <h2 className="text-2xl font-bold text-white font-display mt-0.5 group-hover:text-purple-200 transition-colors">
                  I wanna try my luck
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Voluntarily enter our privacy-first compatibility engine to discover a potentially compatible person based on values and shared vibe.
              </p>
            </div>

            <div className="mt-8 pt-4 border-t border-purple-800/30 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-purple-300 group-hover:text-amber-200">
              <span>Explore Compatibility</span>
              <span className="text-lg">→</span>
            </div>
          </Link>
        </div>

        <div className="p-4 rounded-2xl border border-amber-500/15 bg-purple-950/20 text-xs text-slate-400 max-w-lg mx-auto flex items-center gap-3 text-left">
          <span className="text-base flex-shrink-0">🔒</span>
          <span>
            <strong>Zero Pressure & Private:</strong> Other users will never see your identity, email, or exact location. Mutual consent is strictly required before any introduction.
          </span>
        </div>
      </div>
    </div>
  );
}
