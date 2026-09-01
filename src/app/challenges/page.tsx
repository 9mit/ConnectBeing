import { AppShell } from "@/components/app-shell";
import { PlayPanel } from "@/components/play-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quests & Challenges — MadLove",
  description: "Shared couple growth quests, rituals, and milestone achievements.",
};

export default async function ChallengesPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <PlayPanel />
    </AppShell>
  );
}
