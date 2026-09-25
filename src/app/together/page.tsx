import { and, desc, eq, gt, lte } from "drizzle-orm";

import { db } from "@/db";
import { movieMemories, watchSessions } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { requireVerifiedCoupleOrRedirect } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { TogetherClient } from "./TogetherClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Together"),
  description: "Virtual theater, synchronized playback, and shared cinematic memories.",
};

export default async function TogetherDashboardPage() {
  const auth = await requireVerifiedCoupleOrRedirect();
  const couple = auth.couple;
  const now = new Date();

  // Prune any expired vault memories for this couple server-side
  await db
    .delete(movieMemories)
    .where(
      and(
        eq(movieMemories.coupleId, couple.id),
        lte(movieMemories.expiresAt, now),
      ),
    )
    .catch(() => {});

  // Fetch Watch Together sessions for UP NEXT (active, scheduled, paused, ended_unfinished)
  const sessions = await db.query.watchSessions.findMany({
    where: eq(watchSessions.coupleId, couple.id),
    orderBy: [desc(watchSessions.updatedAt), desc(watchSessions.scheduledFor)],
    limit: 20,
  });

  const upNextSessions = sessions.filter(
    (s) =>
      s.status === "active" ||
      s.status === "scheduled" ||
      s.status === "paused" ||
      s.status === "ended_unfinished",
  );

  // Fetch active 7-day Memory Vault records from movie_memories
  const vaultMemories = await db.query.movieMemories.findMany({
    where: and(
      eq(movieMemories.coupleId, couple.id),
      gt(movieMemories.expiresAt, now),
    ),
    orderBy: [desc(movieMemories.date)],
    limit: 20,
  });

  return (
    <AppShell coupleId={couple.id} userId={auth.user.id}>
      <TogetherClient upNextSessions={upNextSessions} vaultMemories={vaultMemories} />
    </AppShell>
  );
}
