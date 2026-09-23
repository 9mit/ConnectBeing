import { listCalendarEventsAction } from "@/actions/calendar";
import { AppShell } from "@/components/app-shell";
import { CalendarPanel } from "@/components/calendar-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Calendar & Rituals"),
  description: "Your shared relationship calendar, date nights, and celebration countdowns.",
};

export default async function CalendarPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();
  const res = await listCalendarEventsAction();
  const initialEvents = res.ok ? res.data.events : [];

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <CalendarPanel initialEvents={initialEvents} />
    </AppShell>
  );
}
