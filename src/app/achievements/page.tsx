import { AppShell } from "@/components/app-shell";
import { AchievementsPanel } from "@/components/achievements-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Achievements & Trophies — MadLove",
  description: "Your relationship milestone trophies, secret badges, and unlocked achievements.",
};

export default async function AchievementsPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <AchievementsPanel />
    </AppShell>
  );
}
