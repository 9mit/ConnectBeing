import { listNotificationsAction } from "@/actions/notifications";
import { AppShell } from "@/components/app-shell";
import { NotificationsPanel } from "@/components/notifications-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications & Alerts — MadLove",
  description: "Activity feed, partner nudges, and ritual alerts.",
};

export default async function NotificationsPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();
  const res = await listNotificationsAction();
  const initialNotifications = res.ok ? res.data : undefined;

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <NotificationsPanel initialNotifications={initialNotifications} />
    </AppShell>
  );
}
