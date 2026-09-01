import { desc, eq } from "drizzle-orm";


import { db } from "@/db";
import { watchSessions } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { TogetherClient } from "./TogetherClient";

export const dynamic = "force-dynamic";

export default async function TogetherDashboardPage() {
  const auth = await requireVerifiedCoupleOrRedirect();
  const couple = auth.couple;

  const sessions = await db.query.watchSessions.findMany({
    where: eq(watchSessions.coupleId, couple.id),
    orderBy: [desc(watchSessions.scheduledFor)],
    limit: 10,
  });

  const activeSessions = sessions.filter((s) => s.status === "active" || s.status === "scheduled");
  const pastSessions = sessions.filter((s) => s.status === "completed" || s.status === "cancelled");

  return (
    <AppShell coupleId={couple.id} userId={auth.user.id}>
      <TogetherClient activeSessions={activeSessions} pastSessions={pastSessions} />
    </AppShell>
  );
}
