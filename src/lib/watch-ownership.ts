import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { watchSessions, type WatchSession } from "@/db/schema";
import { AppError } from "@/lib/errors";

/** Ensure a watch session belongs to the caller's couple before any write. */
export async function assertWatchSessionOwned(
  sessionId: string,
  coupleId: string,
): Promise<WatchSession> {
  const session = await db.query.watchSessions.findFirst({
    where: and(
      eq(watchSessions.id, sessionId),
      eq(watchSessions.coupleId, coupleId),
    ),
  });
  if (!session) {
    throw new AppError("NOT_FOUND", "Watch session not found.", 404);
  }
  return session;
}
