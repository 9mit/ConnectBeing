import { AppShell } from "@/components/app-shell";
import { SecurityPanel } from "@/components/security-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security Center — MadLove",
  description: "Account protection, password updates, and session security.",
};

export default async function SecurityPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <SecurityPanel />
    </AppShell>
  );
}
