import { listAchievementsAction } from "@/actions/achievements";
import { AppShell } from "@/components/app-shell";
import { AchievementsPanel } from "@/components/achievements-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Achievements & Trophies"),
  description: "Your relationship milestone trophies, secret badges, and unlocked achievements.",
};

export default async function AchievementsPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();
  const res = await listAchievementsAction();
  const initialData = res.ok ? res.data : undefined;

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <AchievementsPanel initialData={initialData} />
    </AppShell>
  );
}
