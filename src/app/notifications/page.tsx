import { listNotificationsAction } from "@/actions/notifications";
import { AppShell } from "@/components/app-shell";
import { NotificationsPanel } from "@/components/notifications-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Notifications & Alerts"),
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
