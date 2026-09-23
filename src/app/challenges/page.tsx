import { listAchievementsAction } from "@/actions/achievements";
import { listChallengesAction } from "@/actions/challenges";
import { listRemindersAction } from "@/actions/reminders";
import { AppShell } from "@/components/app-shell";
import { PlayPanel } from "@/components/play-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Quests & Challenges"),
  description: "Shared couple growth quests, rituals, and milestone achievements.",
};

export default async function ChallengesPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  const [achievements, challenges, reminders] = await Promise.all([
    listAchievementsAction(),
    listChallengesAction(),
    listRemindersAction(),
  ]);

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <PlayPanel initialData={{ achievements, challenges, reminders }} />
    </AppShell>
  );
}
