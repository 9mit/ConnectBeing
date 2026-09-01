"use server";

import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  calendarEvents,
  couples,
  memories,
  moods,
  movieMemories,
  quizResponses,
  timeCapsules,
  users,
} from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";

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

    const [partnerUser, memCountRows, moodCountRows] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, partnerId),
      }),
      db.select({ value: count() }).from(memories).where(eq(memories.coupleId, couple.id)),
      db.select({ value: count() }).from(moods).where(eq(moods.coupleId, couple.id)),
    ]);

    const isVerified =
      !!couple.verifiedUntil && couple.verifiedUntil.getTime() >= Date.now();

    return ok({
      e2eeEnabled: !!(user.e2eePublicKey && partnerUser?.e2eePublicKey),
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

    // Mark couple status as dissolved and clean up references
    await db
      .update(couples)
      .set({
        status: "dissolved",
        dissolvedAt: new Date(),
      })
      .where(eq(couples.id, couple.id));

    return ok({ scheduled: true });
  } catch (e) {
    return fail(e);
  }
}
