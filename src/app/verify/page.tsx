import { AppShell } from "@/components/app-shell";
import { VerifyPanel } from "@/components/verify-panel";
import { requireActiveCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Weekly Couple Verification — MadLove",
  description: "Synchronize your weekly couple verification code to keep your space active and secure.",
};

export default async function VerifyPage() {
  const ctx = await requireActiveCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <VerifyPanel />
    </AppShell>
  );
}
