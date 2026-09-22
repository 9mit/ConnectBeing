import Link from "next/link";
import { redirect } from "next/navigation";

import { InviteGenerator } from "@/components/invite-generator";
import { AppShell } from "@/components/app-shell";
import { redirectPathForAuthError, requireOnboardedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  let user;
  try {
    user = await requireOnboardedUser();
  } catch (error) {
    redirect(redirectPathForAuthError(error));
  }

  if (user.couple && user.couple.status === "active") redirect("/dashboard");

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Step 2: Connection</span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1">Invite your partner</h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed font-medium">
            Generate a secure, single-use invitation token. This link expires in 72 hours.
            Only the cryptographic hash is stored in our database — your invite link is completely private.
          </p>
        </div>
        <InviteGenerator />

        <div className="pt-6 border-t border-amber-500/20">
          <div className="p-6 rounded-3xl border border-purple-800/40 bg-gradient-to-r from-purple-950/40 to-[#0d0218]/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <span>✨</span>
                <span>Don&apos;t have a partner yet?</span>
              </div>
              <p className="text-xs text-slate-300">
                Try our optional, privacy-first compatibility engine to discover someone compatible.
              </p>
            </div>
            <Link
              href="/matchmaking"
              className="py-2.5 px-5 rounded-xl border border-amber-500/40 bg-amber-500/15 text-xs font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500 hover:text-slate-950 transition-all text-center flex-shrink-0"
            >
              I Wanna Try My Luck ✨
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
