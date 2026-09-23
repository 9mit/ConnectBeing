import nextDynamic from "next/dynamic";

import { AppShell } from "@/components/app-shell";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Voice & Video Call"),
  description: "Private, encrypted real-time calling with adaptive media quality.",
};

const CallPanel = nextDynamic(
  () => import("@/components/call-panel").then((m) => m.CallPanel),
  { ssr: false },
);

export default async function CallPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();
  const partnerId =
    ctx.couple.userAId === ctx.user.id
      ? ctx.couple.userBId
      : ctx.couple.userAId;

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <CallPanel
        coupleId={ctx.couple.id}
        userId={ctx.user.id}
        partnerId={partnerId}
      />
    </AppShell>
  );
}
