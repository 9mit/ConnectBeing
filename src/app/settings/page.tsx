import { AppShell } from "@/components/app-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings — MadLove",
  description: "Customize your theme, digital companion, ambiance, and couple preferences.",
};

export default async function SettingsPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <SettingsPanel />
    </AppShell>
  );
}
