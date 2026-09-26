import { and, eq, lt, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { ephemeralMedia, movieMemories } from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";

const MEDIA_BUCKET = "couple-media";

/**
 * Server-only background cleaner: Deletes expired ephemeral media storage objects
 * (e.g., viewed > 10 mins ago, or unviewed > 24 hours).
 *
 * NOTE: Placed in server lib to ensure it cannot be invoked as an unauthenticated
 * public RPC Server Action.
 */
export async function purgeExpiredEphemeralMedia(): Promise<{ purged: number }> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const expiredRows = await db.query.ephemeralMedia.findMany({
    where: or(
      and(eq(ephemeralMedia.status, "viewed"), lt(ephemeralMedia.viewedAt, tenMinutesAgo)),
      and(eq(ephemeralMedia.status, "delivered"), lt(ephemeralMedia.createdAt, twentyFourHoursAgo)),
    ),
    limit: 50,
  });

  let purged = 0;
  for (const row of expiredRows) {
    if (row.storageKey) {
      try {
        const admin = createAdminClient();
        await admin.storage.from(MEDIA_BUCKET).remove([row.storageKey]);
      } catch {
        // Storage object may already be removed
      }
    }
    await db
      .update(ephemeralMedia)
      .set({ status: "deleted", deletedAt: new Date(), storageKey: null })
      .where(eq(ephemeralMedia.id, row.id));
    purged++;
  }

  return { purged };
}

/**
 * Server-only background cleaner: Deletes expired movie memories records from vault.
 *
 * NOTE: Placed in server lib to ensure it cannot be invoked as an unauthenticated
 * public RPC Server Action.
 */
export async function cleanupExpiredVaultRecords(): Promise<{ deleted: number }> {
  try {
    const now = new Date();
    // Only delete expired movie_memories records.
    // NEVER touch watch_sessions, chat, or other memories!
    const result = await db
      .delete(movieMemories)
      .where(lte(movieMemories.expiresAt, now));

    const count = typeof (result as any).rowCount === "number" ? (result as any).rowCount : 0;
    return { deleted: count };
  } catch (err) {
    console.error("[cleanupExpiredVaultRecords] Error:", err);
    return { deleted: 0 };
  }
}
