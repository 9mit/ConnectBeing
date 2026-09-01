import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { challenges } from "@/db/schema";
import { appendRelationshipEvent } from "@/lib/events";
import { createId } from "@/lib/ids";

const DEFAULTS = [
  {
    code: "daily_checkin",
    title: "Daily check-in",
    description: "Both partners log a mood today",
    goal: 2,
  },
  {
    code: "shared_quiz",
    title: "Quiz together",
    description: "Complete the daily quiz",
    goal: 1,
  },
  {
    code: "movie_night",
    title: "Movie night",
    description: "Finish a Together session",
    goal: 1,
  },
] as const;

export type ChallengeCode = (typeof DEFAULTS)[number]["code"];

/** Ensure default quests exist for a couple (idempotent). */
export async function ensureDefaultChallenges(coupleId: string): Promise<void> {
  for (const d of DEFAULTS) {
    const existing = await db.query.challenges.findFirst({
      where: and(
        eq(challenges.coupleId, coupleId),
        eq(challenges.code, d.code),
        eq(challenges.status, "active"),
      ),
    });
    if (!existing) {
      const completed = await db.query.challenges.findFirst({
        where: and(
          eq(challenges.coupleId, coupleId),
          eq(challenges.code, d.code),
          eq(challenges.status, "completed"),
        ),
      });
      if (completed) continue;
      await db.insert(challenges).values({
        id: createId(),
        coupleId,
        code: d.code,
        title: d.title,
        description: d.description,
        goal: d.goal,
        progress: 0,
        status: "active",
      });
    }
  }
}

/**
 * Internal bump used by ritual actions (mood / quiz / watch).
 * Safe no-op when challenge missing or already completed.
 */
export async function bumpChallengeProgress(input: {
  coupleId: string;
  actorUserId: string;
  code: string;
  amount?: number;
}): Promise<{ completed: boolean }> {
  const amount = input.amount ?? 1;
  await ensureDefaultChallenges(input.coupleId);

  const row = await db.query.challenges.findFirst({
    where: and(
      eq(challenges.coupleId, input.coupleId),
      eq(challenges.code, input.code),
      eq(challenges.status, "active"),
    ),
  });
  if (!row) return { completed: false };

  const progress = Math.min(row.goal, row.progress + amount);
  const completed = progress >= row.goal;
  await db
    .update(challenges)
    .set({
      progress,
      status: completed ? "completed" : "active",
      completedAt: completed ? new Date() : null,
    })
    .where(eq(challenges.id, row.id));

  if (completed) {
    await appendRelationshipEvent({
      coupleId: input.coupleId,
      actorUserId: input.actorUserId,
      eventType: "challenge_completed",
      payload: { code: input.code },
    });
  }

  return { completed };
}
