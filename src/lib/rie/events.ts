import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { relationshipEvents } from "@/db/schema";
import type { RieEvent, RieEventType } from "./types";

const TYPE_MAP: Partial<Record<string, RieEventType>> = {
  mood_logged: "mood_updated",
  quiz_completed: "quiz_completed",
  watch_started: "movie_started",
  watch_ended: "movie_finished",
  call_started: "call_started",
  call_ended: "call_ended",
  memory_added: "photo_saved",
};

/**
 * @deprecated Prefer the append-only `relationship_events` bus +
 * `runRelationshipIntelligence` (insight-generator). Maps bus rows into
 * legacy RieEvent shapes for any leftover callers.
 */
export async function collectEvents(coupleId: string): Promise<RieEvent[]> {
  const rows = await db.query.relationshipEvents.findMany({
    where: eq(relationshipEvents.coupleId, coupleId),
    orderBy: [desc(relationshipEvents.createdAt)],
    limit: 200,
  });

  const out: RieEvent[] = [];
  for (const r of rows) {
    const eventType = TYPE_MAP[r.eventType];
    if (!eventType) continue;
    out.push({
      id: r.id,
      coupleId,
      userId: r.actorUserId ?? "",
      eventType,
      payload: (r.payload ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt,
    });
  }
  return out;
}
