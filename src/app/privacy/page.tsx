import { AppShell } from "@/components/app-shell";
import { PrivacyPanel } from "@/components/privacy-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy & Data Protection — MadLove",
  description: "End-to-end encryption keys, couple isolation guarantees, and complete data ownership.",
};

export default async function PrivacyPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <PrivacyPanel />
    </AppShell>
  );
}
