"use server";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { moods } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple, requireVerifiedCouple } from "@/lib/auth";
import { incrementEngagement } from "@/lib/engagement";
import { createId } from "@/lib/ids";
import { moodSchema } from "@/lib/validations";

export async function setMoodAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = moodSchema.parse(input);
    const { user, couple } = await requireVerifiedCouple();

    const id = createId();
    await db.insert(moods).values({
      id,
      coupleId: couple.id,
      userId: user.id,
      mood: parsed.mood,
      note: parsed.note,
    });

    await incrementEngagement(couple.id, "mood");
    const { appendRelationshipEvent } = await import("@/lib/events");
    await appendRelationshipEvent({
      coupleId: couple.id,
      actorUserId: user.id,
      eventType: "mood_logged",
      payload: { mood: parsed.mood },
    });
    const { bumpChallengeProgress } = await import("@/lib/challenges");
    await bumpChallengeProgress({
      coupleId: couple.id,
      actorUserId: user.id,
      code: "daily_checkin",
    });
    const { tryUnlockAchievement } = await import("@/lib/achievements");
    await tryUnlockAchievement(couple.id, user.id, "mood_logger");

    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function getCurrentMoodsAction(): Promise<
  ActionResult<{
    mine: { mood: string; note: string | null; createdAt: string } | null;
    partner: { mood: string; note: string | null; createdAt: string } | null;
  }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    const mine = await db.query.moods.findFirst({
      where: and(eq(moods.coupleId, couple.id), eq(moods.userId, user.id)),
      orderBy: [desc(moods.createdAt)],
    });

    const partner = await db.query.moods.findFirst({
      where: and(eq(moods.coupleId, couple.id), eq(moods.userId, partnerId)),
      orderBy: [desc(moods.createdAt)],
    });

    return ok({
      mine: mine
        ? {
            mood: mine.mood,
            note: mine.note,
            createdAt: mine.createdAt.toISOString(),
          }
        : null,
      partner: partner
        ? {
            mood: partner.mood,
            note: partner.note,
            createdAt: partner.createdAt.toISOString(),
          }
        : null,
    });
  } catch (e) {
    return fail(e);
  }
}
