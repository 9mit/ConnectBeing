import { AppShell } from "@/components/app-shell";
import { MoodSelector } from "@/components/mood-selector";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vibe & Mood Sync — MadLove",
  description: "Real-time emotional check-in, cuddle requests, and mood radar.",
};

export default async function MoodPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <MoodSelector coupleId={ctx.couple.id} />
    </AppShell>
  );
}
