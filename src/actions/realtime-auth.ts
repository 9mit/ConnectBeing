"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { watchSessions } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { AppError } from "@/lib/errors";

const COUPLE_TOPIC =
  /^couple:([a-zA-Z0-9_-]+):(chat|call|location|presence|moods)$/;
const ROOM_TOPIC =
  /^(?:room:([a-zA-Z0-9_-]+)(?::[a-zA-Z0-9_-]+)?|room-(?:signaling|chat|presence|reactions):([a-zA-Z0-9_-]+))$/;

/**
 * Client must call before joining a private Realtime channel.
 * Confirms the session user is a member of the couple / watch session.
 */
export async function authorizeRealtimeTopicAction(
  topic: string,
): Promise<ActionResult<{ allowed: true }>> {
  try {
    const { couple } = await requireActiveCouple();

    const coupleMatch = topic.match(COUPLE_TOPIC);
    if (coupleMatch) {
      if (coupleMatch[1] !== couple.id) {
        throw new AppError("FORBIDDEN", "Not a member of this channel.", 403);
      }
      return ok({ allowed: true });
    }

    const roomMatch = topic.match(ROOM_TOPIC);
    if (roomMatch) {
      const sessionId = roomMatch[1] || roomMatch[2]!;
      const session = await db.query.watchSessions.findFirst({
        where: and(
          eq(watchSessions.id, sessionId),
          eq(watchSessions.coupleId, couple.id),
        ),
      });
      if (!session) {
        throw new AppError("FORBIDDEN", "Not a member of this room.", 403);
      }
      return ok({ allowed: true });
    }

    throw new AppError("FORBIDDEN", "Unknown realtime topic.", 403);
  } catch (e) {
    return fail(e);
  }
}
