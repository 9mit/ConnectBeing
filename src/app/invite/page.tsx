import { InviteGenerator } from "@/components/invite-generator";
import { AppShell } from "@/components/app-shell";
import { redirectPathForAuthError, requireOnboardedUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  let user;
  try {
    user = await requireOnboardedUser();
  } catch (error) {
    redirect(redirectPathForAuthError(error));
  }

  if (user.coupleId) redirect("/dashboard");

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
      </div>
    </AppShell>
  );
}
