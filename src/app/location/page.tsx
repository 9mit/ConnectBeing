import { AppShell } from "@/components/app-shell";
import { LocationShare } from "@/components/location-share";
import { requireActiveCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Distance & Location — MadLove",
  description: "Privacy-preserved distance calculation and live presence.",
};

export default async function LocationPage() {
  const ctx = await requireActiveCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <LocationShare coupleId={ctx.couple.id} userId={ctx.user.id} />
    </AppShell>
  );
}
