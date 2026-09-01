import { AppShell } from "@/components/app-shell";
import { InsightsPanel } from "@/components/insights-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Insights & Synergy — MadLove",
  description: "Relationship insights, compatibility radar, and intimate conversation sparks.",
};

export default async function InsightsPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <InsightsPanel />
    </AppShell>
  );
}
