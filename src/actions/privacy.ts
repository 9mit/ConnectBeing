"use server";

import { db } from "@/db";
import {
  calendarEvents,
  coupleMembers,
  couples,
  memories,
  moods,
  movieMemories,
  quizResponses,
  timeCapsules,
  userDevices,
  users,
} from "@/db/schema";
import { and, count, eq, isNull, or } from "drizzle-orm";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { isCoupleVerified } from "@/lib/couple-verification";
import { redis } from "@/lib/redis";
import { rateLimitOrThrow } from "@/lib/security";

export type PrivacyStatusDTO = {
  e2eeEnabled: boolean;
  myPublicKey: string | null;
  partnerPublicKey: string | null;
  verifiedUntil: string | null;
  isVerified: boolean;
  coupleId: string;
  totalMemories: number;
  totalMoods: number;
};

export async function getPrivacyStatusAction(): Promise<
  ActionResult<PrivacyStatusDTO>
> {
  try {
    const { user, couple } = await requireActiveCouple();

    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    const [partnerUser, memCountRows, moodCountRows, myDevs, partnerDevs] =
      await Promise.all([
        db.query.users.findFirst({
          where: eq(users.id, partnerId),
        }),
        db.select({ value: count() }).from(memories).where(eq(memories.coupleId, couple.id)),
        db.select({ value: count() }).from(moods).where(eq(moods.coupleId, couple.id)),
        db.select({ value: count() }).from(userDevices).where(
          and(eq(userDevices.userId, user.id), isNull(userDevices.revokedAt)),
        ),
        db.select({ value: count() }).from(userDevices).where(
          and(eq(userDevices.userId, partnerId), isNull(userDevices.revokedAt)),
        ),
      ]);

    const isVerified = isCoupleVerified(couple);
    const hasDevices = (myDevs[0]?.value ?? 0) > 0 && (partnerDevs[0]?.value ?? 0) > 0;
    const hasLegacy = Boolean(user.e2eePublicKey && partnerUser?.e2eePublicKey);

    return ok({
      e2eeEnabled: hasDevices || hasLegacy,
      myPublicKey: user.e2eePublicKey,
      partnerPublicKey: partnerUser?.e2eePublicKey ?? null,
      verifiedUntil: couple.verifiedUntil?.toISOString() ?? null,
      isVerified,
      coupleId: couple.id,
      totalMemories: memCountRows[0]?.value ?? 0,
      totalMoods: moodCountRows[0]?.value ?? 0,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function exportCoupleDataAction(): Promise<
  ActionResult<{ exportPayload: string }>
> {
  try {
    const { user, couple } = await requireActiveCouple();

    await rateLimitOrThrow({
      key: `rl:export:${couple.id}`,
      limit: 5,
      windowSeconds: 3600,
      message: "Data export limit reached. Please wait before exporting again.",
    });

    const [memRows, moodRows, movRows, calRows, capRows, quizRows] =
      await Promise.all([
        db.query.memories.findMany({
          where: eq(memories.coupleId, couple.id),
        }),
        db.query.moods.findMany({
          where: eq(moods.coupleId, couple.id),
        }),
        db.query.movieMemories.findMany({
          where: eq(movieMemories.coupleId, couple.id),
        }),
        db.query.calendarEvents.findMany({
          where: eq(calendarEvents.coupleId, couple.id),
        }),
        db.query.timeCapsules.findMany({
          where: eq(timeCapsules.coupleId, couple.id),
        }),
        db.query.quizResponses.findMany({
          where: eq(quizResponses.coupleId, couple.id),
        }),
      ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      requestedByUserId: user.id,
      coupleId: couple.id,
      relationshipCreated: couple.createdAt.toISOString(),
      anniversaryDate: couple.anniversaryDate?.toISOString() ?? null,
      petName: couple.petName,
      stats: {
        memoriesCount: memRows.length,
        moodsCount: moodRows.length,
        movieNightsCount: movRows.length,
        calendarEventsCount: calRows.length,
        timeCapsulesCount: capRows.length,
        quizResponsesCount: quizRows.length,
      },
      memories: memRows.map((m) => ({
        caption: m.caption,
        takenAt: m.takenAt.toISOString(),
        eventLabel: m.eventLabel,
      })),
      movieMemories: movRows.map((m) => ({
        title: m.title,
        date: m.date.toISOString(),
        watchDuration: m.watchDuration,
      })),
      calendarEvents: calRows.map((c) => ({
        title: c.title,
        description: c.description,
        eventDate: c.eventDate.toISOString(),
        category: c.category,
      })),
      timeCapsules: capRows.map((t) => ({
        title: t.title,
        isUnlocked: t.isUnlocked,
        unlockAt: t.unlockAt.toISOString(),
      })),
    };

    return ok({ exportPayload: JSON.stringify(exportData, null, 2) });
  } catch (e) {
    return fail(e);
  }
}

export async function requestCoupleDataDeletionAction(): Promise<
  ActionResult<{ scheduled: true }>
> {
  try {
    const { couple } = await requireActiveCouple();

    await rateLimitOrThrow({
      key: `rl:delete-couple:${couple.id}`,
      limit: 1,
      windowSeconds: 60 * 60,
      message: "Data deletion already requested. Please wait.",
    });

    // Transactionally dissolve couple, update memberships, and unlink users
    await db.transaction(async (tx) => {
      // 1. Mark couple status as dissolved
      await tx
        .update(couples)
        .set({
          status: "dissolved",
          dissolvedAt: new Date(),
        })
        .where(eq(couples.id, couple.id));

      // 2. Mark couple members as dissolved so unique active index is freed
      await tx
        .update(coupleMembers)
        .set({ status: "dissolved" })
        .where(eq(coupleMembers.coupleId, couple.id));

      // 3. Unlink both users so they are not permanently locked to dissolved couple
      await tx
        .update(users)
        .set({ coupleId: null, updatedAt: new Date() })
        .where(or(eq(users.id, couple.userAId), eq(users.id, couple.userBId)));
    });

    // 3. Purge couple-level Redis keys
    try {
      await Promise.all([
        redis.del(`verify:code:${couple.id}`),
        redis.del(`partner-joined:${couple.userAId}`),
        redis.del(`partner-joined:${couple.userBId}`),
        redis.del(`presence:couple:${couple.id}:${couple.userAId}`),
        redis.del(`presence:couple:${couple.id}:${couple.userBId}`),
      ]);
    } catch {
      // Best-effort Redis purge
    }

    return ok({ scheduled: true });
  } catch (e) {
    return fail(e);
  }
}
