import { getCoupleProfilesAction } from "@/actions/profile";
import { AppShell } from "@/components/app-shell";
import { ProfilePanel } from "@/components/profile-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Couple Profile — MadLove",
  description: "View and edit your personal profile, partner profile, and relationship anniversary.",
};

export default async function ProfilePage() {
  const ctx = await requireVerifiedCoupleOrRedirect();
  const res = await getCoupleProfilesAction();
  const initialData = res.ok ? res.data : null;

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <ProfilePanel initialData={initialData} />
    </AppShell>
  );
}
