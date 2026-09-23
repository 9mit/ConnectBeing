import { AppShell } from "@/components/app-shell";
import { TimelinePanel } from "@/components/timeline-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Timeline & Time Capsules"),
  description: "Chronicles of your love story and sealed future time capsules.",
};

export default async function TimelinePage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <TimelinePanel />
    </AppShell>
  );
}
