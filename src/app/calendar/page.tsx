import { AppShell } from "@/components/app-shell";
import { CalendarPanel } from "@/components/calendar-panel";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Calendar & Rituals — MadLove",
  description: "Your shared relationship calendar, date nights, and celebration countdowns.",
};

export default async function CalendarPage() {
  const ctx = await requireVerifiedCoupleOrRedirect();

  return (
    <AppShell coupleId={ctx.couple.id} userId={ctx.user.id}>
      <CalendarPanel />
    </AppShell>
  );
}
