import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { achievements, userAchievements } from "@/db/schema";
import { appendRelationshipEvent } from "@/lib/events";
import { createId } from "@/lib/ids";

export async function tryUnlockAchievement(
  coupleId: string,
  userId: string,
  code: string,
): Promise<boolean> {
  const achievement = await db.query.achievements.findFirst({
    where: eq(achievements.code, code),
  });
  if (!achievement) return false;

  const existing = await db.query.userAchievements.findFirst({
    where: and(
      eq(userAchievements.coupleId, coupleId),
      eq(userAchievements.userId, userId),
      eq(userAchievements.achievementId, achievement.id),
    ),
  });
  if (existing) return false;

  await db.insert(userAchievements).values({
    id: createId(),
    coupleId,
    userId,
    achievementId: achievement.id,
  });

  await appendRelationshipEvent({
    coupleId,
    actorUserId: userId,
    eventType: "achievement_unlocked",
    payload: { code },
  });

  return true;
}
