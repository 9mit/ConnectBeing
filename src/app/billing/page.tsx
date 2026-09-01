import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { BillingPanel } from "@/components/billing-panel";
import { redirectPathForAuthError, requireActiveCouple } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Support & Membership — MadLove",
  description: "Manage your MadLove couple universe membership and premium perks.",
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
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            Membership & Love Tier
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Support & Subscription
          </h1>
          <p className="mt-2 text-sm text-slate-300 font-medium">
            Manage your MadLove universe membership and unlocked features.
          </p>
        </header>
        <BillingPanel />
      </div>
    </AppShell>
  );
}
