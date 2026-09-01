import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getInsightsAction, getRecentEventsAction, refreshInsightsAction } from "@/actions/insights";
import { getCurrentMoodsAction } from "@/actions/mood";
import { getPetStateAction } from "@/actions/pet";
import { AppShell } from "@/components/app-shell";
import { VerificationBanner } from "@/components/verification-banner";
import { db } from "@/db";
import { users } from "@/db/schema";
import { redirectPathForAuthError, requireOnboardedUser } from "@/lib/auth";
import { daysBetween, formatDaysTogether } from "@/lib/format";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let user;
  try {
    user = await requireOnboardedUser();
  } catch (error) {
    redirect(redirectPathForAuthError(error));
  }

  if (!user.coupleId || !user.couple) redirect("/invite");

  const partnerId =
    user.couple.userAId === user.id ? user.couple.userBId : user.couple.userAId;

  const [moods, pet, insights, partner, recentUs] = await Promise.all([
    getCurrentMoodsAction(),
    getPetStateAction(),
    getInsightsAction(),
    db.query.users.findFirst({
      where: eq(users.id, partnerId),
      with: { onboardingProfile: true },
    }),
    getRecentEventsAction(),
  ]);

  if (insights.ok && !insights.data.insight) {
    await refreshInsightsAction();
  }
  const insightResult =
    insights.ok && !insights.data.insight
      ? await getInsightsAction()
      : insights;

  const togetherSince = user.couple.anniversaryDate ?? user.couple.createdAt;
  const daysTogether = daysBetween(togetherSince);

  const data = {
    moods,
    pet,
    insightResult,
    recentUs,
    partnerName: partner?.onboardingProfile?.name ?? null,
    daysTogetherLabel: formatDaysTogether(daysTogether),
    daysTogether,
  };

  return (
    <AppShell coupleId={user.couple.id} userId={user.id}>
      <VerificationBanner couple={user.couple} />
      <DashboardClient data={data} />
    </AppShell>
  );
}
