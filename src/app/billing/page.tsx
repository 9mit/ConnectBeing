import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { BillingPanel } from "@/components/billing-panel";
import { redirectPathForAuthError, requireActiveCouple } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Sanctuary & Support"),
  description: `${BRAND.name} is 100% free for all couples. Support the open-source infrastructure.`,
};

export default async function BillingPage() {
  let user, couple;
  try {
    const auth = await requireActiveCouple();
    user = auth.user;
    couple = auth.couple;
  } catch (error) {
    redirect(redirectPathForAuthError(error));
  }

  return (
    <AppShell coupleId={couple.id} userId={user.id}>
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="mb-6">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-400">
            Open Sanctuary · 100% Free Forever
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-serif mt-1">
            Zero Paywalls. Full Access.
          </h1>
          <p className="mt-2 text-sm text-zinc-300 font-sans">
            Every capability in {BRAND.name} is completely unlocked for you and your partner.
          </p>
        </header>
        <BillingPanel />
      </div>
    </AppShell>
  );
}
