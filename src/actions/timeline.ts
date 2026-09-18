"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  achievements,
  calendarEvents,
  challenges,
  memories,
  movieMemories,
  timeCapsules,
  userAchievements,
} from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { requireCoupleVerified } from "@/lib/couple-verification";
import { AppError } from "@/lib/errors";
import { appendRelationshipEvent } from "@/lib/events";
import { createId } from "@/lib/ids";
import { rateLimitOrThrow } from "@/lib/security";

const createTimeCapsuleSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
  unlockAt: z.string().datetime(),
  mediaStorageKey: z.string().max(500).optional(),
});

export type TimelineEventDTO = {
  id: string;
  kind: "memory" | "movie" | "achievement" | "capsule" | "calendar" | "challenge" | "milestone";
  title: string;
  subtitle: string | null;
  at: string;
  url: string | null;
  metadata?: Record<string, unknown>;
};

export type TimeCapsuleDTO = {
  id: string;
  title: string;
  message: string | null; // null if locked and viewer is not allowed yet
  unlockAt: string;
  isUnlocked: boolean;
  unlockedAt: string | null;
  createdById: string;
  createdAt: string;
  mediaStorageKey: string | null;
};

export async function getRelationshipTimelineAction(): Promise<
  ActionResult<{ events: TimelineEventDTO[] }>
> {
  try {
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    const [memRows, movieRows, achieveRows, calRows, chalRows, capRows] =
      await Promise.all([
        db.query.memories.findMany({
          where: eq(memories.coupleId, couple.id),
          orderBy: [desc(memories.takenAt)],
          limit: 30,
        }),
        db.query.movieMemories.findMany({
          where: eq(movieMemories.coupleId, couple.id),
          orderBy: [desc(movieMemories.date)],
          limit: 20,
        }),
        db.query.userAchievements.findMany({
          where: eq(userAchievements.coupleId, couple.id),
          with: { achievement: true },
          orderBy: [desc(userAchievements.unlockedAt)],
          limit: 20,
        }),
        db.query.calendarEvents.findMany({
          where: and(
            eq(calendarEvents.coupleId, couple.id),
            eq(calendarEvents.completed, true),
          ),
          orderBy: [desc(calendarEvents.eventDate)],
          limit: 20,
        }),
        db.query.challenges.findMany({
          where: and(
            eq(challenges.coupleId, couple.id),
            eq(challenges.status, "completed"),
          ),
          orderBy: [desc(challenges.completedAt)],
          limit: 20,
        }),
        db.query.timeCapsules.findMany({
          where: and(
            eq(timeCapsules.coupleId, couple.id),
            eq(timeCapsules.isUnlocked, true),
          ),
          orderBy: [desc(timeCapsules.unlockedAt)],
          limit: 20,
        }),
      ]);

    const events: TimelineEventDTO[] = [];

    for (const m of memRows) {
      events.push({
        id: `mem-${m.id}`,
        kind: "memory",
        title: m.caption || "Photo Memory",
        subtitle: m.eventLabel || "Captured Moment",
        at: m.takenAt.toISOString(),
        url: m.storageKey,
      });
    }

    for (const mm of movieRows) {
      events.push({
        id: `mov-${mm.id}`,
        kind: "movie",
        title: mm.title,
        subtitle: `Watched Together · ${mm.watchDuration} mins`,
        at: mm.date.toISOString(),
        url: mm.posterUrl,
      });
    }

    const allAchievements = await db.select().from(achievements);
    const achieveMap = new Map(allAchievements.map((a) => [a.id, a]));

    for (const a of achieveRows) {
      const ach = achieveMap.get(a.achievementId);
      events.push({
        id: `ach-${a.id}`,
        kind: "achievement",
        title: ach?.title || "Couple Trophy",
        subtitle: ach?.description || "Milestone unlocked",
        at: a.unlockedAt.toISOString(),
        url: null,
      });
    }

    for (const c of calRows) {
      events.push({
        id: `cal-${c.id}`,
        kind: "calendar",
        title: c.title,
        subtitle: c.description || "Shared Date",
        at: c.eventDate.toISOString(),
        url: null,
      });
    }

    for (const ch of chalRows) {
      events.push({
        id: `chal-${ch.id}`,
        kind: "challenge",
        title: ch.title,
        subtitle: "Completed Quest",
        at: ch.completedAt?.toISOString() ?? ch.createdAt.toISOString(),
        url: null,
      });
    }

    for (const tc of capRows) {
      events.push({
        id: `cap-${tc.id}`,
        kind: "capsule",
        title: `Time Capsule: ${tc.title}`,
        subtitle: "Unlocked Message from the Past",
        at: tc.unlockedAt?.toISOString() ?? tc.unlockAt.toISOString(),
        url: tc.mediaStorageKey,
      });
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return ok({ events });
  } catch (e) {
    return fail(e);
  }
}

export async function listTimeCapsulesAction(): Promise<
  ActionResult<{ capsules: TimeCapsuleDTO[] }>
> {
  try {
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    const rows = await db.query.timeCapsules.findMany({
      where: eq(timeCapsules.coupleId, couple.id),
      orderBy: [desc(timeCapsules.createdAt)],
    });

    const now = new Date();

    const capsules: TimeCapsuleDTO[] = rows.map((r) => {
      const isReadyToUnlock = r.unlockAt <= now;
      const canView = r.isUnlocked || isReadyToUnlock;

      return {
        id: r.id,
        title: r.title,
        message: canView ? r.message : null,
        unlockAt: r.unlockAt.toISOString(),
        isUnlocked: r.isUnlocked || isReadyToUnlock,
        unlockedAt: r.unlockedAt?.toISOString() ?? null,
        createdById: r.createdById,
        createdAt: r.createdAt.toISOString(),
        mediaStorageKey: canView ? r.mediaStorageKey : null,
      };
    });

    return ok({ capsules });
  } catch (e) {
    return fail(e);
  }
}

export async function createTimeCapsuleAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createTimeCapsuleSchema.parse(input);
    const { user, couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    await rateLimitOrThrow({
      key: `rl:capsule:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 10,
      message: "Slow down — too many time capsules.",
    });

    const id = createId();
    await db.insert(timeCapsules).values({
      id,
      coupleId: couple.id,
      createdById: user.id,
      title: parsed.title,
      message: parsed.message,
      unlockAt: new Date(parsed.unlockAt),
      mediaStorageKey: parsed.mediaStorageKey ?? null,
      isUnlocked: false,
    });

    await appendRelationshipEvent({
      coupleId: couple.id,
      actorUserId: user.id,
      eventType: "memory_added",
      payload: { capsuleTitle: parsed.title },
    });

    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function unlockTimeCapsuleAction(
  capsuleId: string,
): Promise<ActionResult<{ unlocked: boolean; message: string }>> {
  try {
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    const capsule = await db.query.timeCapsules.findFirst({
      where: and(
        eq(timeCapsules.id, capsuleId),
        eq(timeCapsules.coupleId, couple.id),
      ),
    });

    if (!capsule) {
      throw new AppError("NOT_FOUND", "Time capsule not found.", 404);
    }

    if (capsule.unlockAt > new Date()) {
      throw new AppError(
        "FORBIDDEN",
        `This time capsule is sealed until ${capsule.unlockAt.toLocaleDateString()}.`,
        403,
      );
    }

    if (!capsule.isUnlocked) {
      await db
        .update(timeCapsules)
        .set({ isUnlocked: true, unlockedAt: new Date() })
        .where(eq(timeCapsules.id, capsuleId));
    }

    return ok({ unlocked: true, message: capsule.message });
  } catch (e) {
    return fail(e);
  }
}
