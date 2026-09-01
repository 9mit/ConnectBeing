import { db } from "@/db";
import { relationshipEvents } from "@/db/schema";
import { createId } from "@/lib/ids";

export type RelationshipEventType =
  | "message_sent"
  | "mood_logged"
  | "quiz_completed"
  | "watch_started"
  | "watch_ended"
  | "call_started"
  | "call_ended"
  | "memory_added"
  | "achievement_unlocked"
  | "challenge_completed";

export async function appendRelationshipEvent(input: {
  coupleId: string;
  actorUserId?: string | null;
  eventType: RelationshipEventType;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(relationshipEvents).values({
    id: createId(),
    coupleId: input.coupleId,
    actorUserId: input.actorUserId ?? null,
    eventType: input.eventType,
    payload: input.payload ?? {},
  });
}
