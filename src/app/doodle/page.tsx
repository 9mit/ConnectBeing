import { eq } from "drizzle-orm";
import { getDoodleCanvasAction } from "@/actions/doodle";
import { AppShell } from "@/components/app-shell";
import { db } from "@/db";
import { onboardingProfiles } from "@/db/schema";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { DoodleClient } from "./DoodleClient";
import type { DoodleStroke } from "@/components/doodle/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Doodle"),
  description: "Private collaborative sketchbook for two partners to draw and sketch together in real time.",
};

export default async function DoodlePage() {
  const { user, couple } = await requireVerifiedCoupleOrRedirect();
  const res = await getDoodleCanvasAction();

  const partnerId =
    couple.userAId === user.id ? couple.userBId : couple.userAId;
  const partnerProfile = partnerId
    ? await db.query.onboardingProfiles.findFirst({
        where: eq(onboardingProfiles.userId, partnerId),
      })
    : null;

  const initialStrokes = (res.ok && res.data.canvas?.strokes
    ? (res.data.canvas.strokes as unknown as DoodleStroke[])
    : []) as DoodleStroke[];

  return (
    <AppShell coupleId={couple.id} userId={user.id}>
      <DoodleClient
        coupleId={couple.id}
        userId={user.id}
        initialStrokes={initialStrokes}
        partnerName={partnerProfile?.name}
      />
    </AppShell>
  );
}
