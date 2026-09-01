"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { achievements as achievementRows, userAchievements } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { createId } from "@/lib/ids";

const DEFAULT_ACHIEVEMENTS = [
  { code: "first_message", title: "First Spark", description: "Sent your first encrypted love note.", icon: "💬", tier: "bronze" },
  { code: "first_vibe", title: "Emotional Resonance", description: "Checked in with your emotional vibe.", icon: "🎭", tier: "bronze" },
  { code: "first_movie", title: "Theater for Two", description: "Completed your first MadLove Together movie night.", icon: "🍿", tier: "bronze" },
  { code: "first_memory", title: "Captured Forever", description: "Preserved a precious photo memory in your vault.", icon: "📷", tier: "silver" },
  { code: "quiz_master", title: "Mind Readers", description: "Completed a daily connection quiz together.", icon: "❓", tier: "silver" },
  { code: "streak_7", title: "7-Day Constellation", description: "Kept your couple digital pet thriving for a full week.", icon: "✨", tier: "gold" },
  { code: "time_capsule_sealed", title: "Secret Keepers", description: "Sealed a message into the future in a time capsule.", icon: "⏳", tier: "gold" },
  { code: "eternal_bond", title: "Celestial Synchrony", description: "Achieved 100% compatibility synergy across all connection rituals.", icon: "👑", tier: "celestial" },
];

export async function listAchievementsAction(): Promise<
  ActionResult<{
    items: Array<{
      code: string;
      title: string;
      description: string;
      icon: string;
      tier: string;
      unlocked: boolean;
      unlockedAt: string | null;
    }>;
    unlockedCount: number;
    totalCount: number;
  }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    let all = await db.select().from(achievementRows);

    if (all.length === 0) {
      // Seed default achievements
      for (const da of DEFAULT_ACHIEVEMENTS) {
        await db.insert(achievementRows).values({
          id: createId(),
          code: da.code,
          title: da.title,
          description: da.description,
          icon: da.icon,
        }).onConflictDoNothing();
      }
      all = await db.select().from(achievementRows);
    }

    const unlocked = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.coupleId, couple.id),
          eq(userAchievements.userId, user.id),
        ),
      );

    const byId = new Map(unlocked.map((u) => [u.achievementId, u]));

    const items = all.map((a) => {
      const row = byId.get(a.id);
      const defaultMeta = DEFAULT_ACHIEVEMENTS.find((d) => d.code === a.code);
      return {
        code: a.code,
        title: a.title,
        description: a.description,
        icon: a.icon,
        tier: defaultMeta?.tier || "bronze",
        unlocked: Boolean(row),
        unlockedAt: row?.unlockedAt.toISOString() ?? null,
      };
    });

    const unlockedCount = items.filter((i) => i.unlocked).length;

    return ok({
      items,
      unlockedCount,
      totalCount: items.length,
    });
  } catch (e) {
    return fail(e);
  }
}
