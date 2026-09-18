"use server";

import { db } from "@/db";
import {
  movieMemories,
  watchEvents,
  watchMessages,
  watchParticipants,
  watchSessions,
} from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireVerifiedCouple } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getLocalAIProvider } from "@/lib/rie";
import { createId } from "@/lib/ids";
import {
  createWatchSessionSchema,
  watchEventSchema,
  watchSessionMessageSchema,
} from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { tryUnlockAchievement } from "@/lib/achievements";
import { bumpChallengeProgress } from "@/lib/challenges";
import { incrementEngagement } from "@/lib/engagement";
import { appendRelationshipEvent } from "@/lib/events";
import { assertWatchSessionOwned } from "@/lib/watch-ownership";
import { searchUnifiedCatalog, type UnifiedContentItem } from "@/features/together/discovery/catalog";

export async function searchEntertainmentAction(
  query: string,
): Promise<ActionResult<UnifiedContentItem[]>> {
  try {
    await requireVerifiedCouple();
    const results = await searchUnifiedCatalog(query);
    return ok(results);
  } catch (e) {
    return fail(e);
  }
}

export async function createWatchSessionAction(
  input: unknown,
): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const parsed = createWatchSessionSchema.parse(input);
    const { couple } = await requireVerifiedCouple();

    const sessionId = createId();

    const validDbEnum = [
      "netflix",
      "prime",
      "disney",
      "apple",
      "jiohotstar",
      "sonyliv",
      "zee5",
      "crunchyroll",
      "youtube",
      "other",
    ] as const;

    const dbProvider = (validDbEnum as readonly string[]).includes(
      parsed.provider.toLowerCase(),
    )
      ? (parsed.provider.toLowerCase() as (typeof validDbEnum)[number])
      : "other";

    await db.insert(watchSessions).values({
      id: sessionId,
      coupleId: couple.id,
      provider: dbProvider,
      title: parsed.title,
      posterUrl: parsed.posterUrl,
      scheduledFor: parsed.scheduledFor ? new Date(parsed.scheduledFor) : new Date(),
      invitationMessage: parsed.invitationMessage,
      theme: parsed.theme,
    });

    revalidatePath("/together");

    return ok({ sessionId });
  } catch (e) {
    return fail(e);
  }
}

export async function joinWatchSessionAction(
  sessionId: string,
): Promise<ActionResult<void>> {
  try {
    const { user, couple } = await requireVerifiedCouple();

    const session = await db.query.watchSessions.findFirst({
      where: and(
        eq(watchSessions.id, sessionId),
        eq(watchSessions.coupleId, couple.id),
      ),
    });

    if (!session) {
      throw new AppError("NOT_FOUND", "Watch session not found.", 404);
    }

    const existing = await db.query.watchParticipants.findFirst({
      where: and(
        eq(watchParticipants.sessionId, sessionId),
        eq(watchParticipants.userId, user.id),
      ),
    });

    if (!existing) {
      await db.insert(watchParticipants).values({
        id: createId(),
        sessionId,
        userId: user.id,
      });
    } else {
      await db
        .update(watchParticipants)
        .set({ leftAt: null, joinedAt: new Date() })
        .where(eq(watchParticipants.id, existing.id));
    }

    if (session.status === "scheduled") {
      await db
        .update(watchSessions)
        .set({ status: "active", startedAt: new Date() })
        .where(eq(watchSessions.id, sessionId));
      await appendRelationshipEvent({
        coupleId: couple.id,
        actorUserId: user.id,
        eventType: "watch_started",
        payload: { sessionId },
      });
    }

    revalidatePath(`/together/room/${sessionId}`);
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function leaveWatchSessionAction(
  sessionId: string,
): Promise<ActionResult<void>> {
  try {
    const { user, couple } = await requireVerifiedCouple();
    await assertWatchSessionOwned(sessionId, couple.id);

    await db
      .update(watchParticipants)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(watchParticipants.sessionId, sessionId),
          eq(watchParticipants.userId, user.id),
        ),
      );

    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function sendWatchMessageAction(
  input: unknown,
): Promise<ActionResult<void>> {
  try {
    const parsed = watchSessionMessageSchema.parse(input);
    const { user, couple } = await requireVerifiedCouple();
    await assertWatchSessionOwned(parsed.sessionId, couple.id);

    await db.insert(watchMessages).values({
      id: createId(),
      sessionId: parsed.sessionId,
      userId: user.id,
      content: parsed.content,
      playbackPosition: parsed.playbackPosition,
    });

    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function recordWatchEventAction(
  input: unknown,
): Promise<ActionResult<void>> {
  try {
    const parsed = watchEventSchema.parse(input);
    const { user, couple } = await requireVerifiedCouple();
    await assertWatchSessionOwned(parsed.sessionId, couple.id);

    await db.insert(watchEvents).values({
      id: createId(),
      sessionId: parsed.sessionId,
      userId: user.id,
      eventType: parsed.eventType,
      playbackPosition: Math.round(parsed.playbackPosition),
    });

    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function endWatchSessionAction(
  sessionId: string,
): Promise<ActionResult<void>> {
  try {
    const { user, couple } = await requireVerifiedCouple();

    const session = await db.query.watchSessions.findFirst({
      where: and(
        eq(watchSessions.id, sessionId),
        eq(watchSessions.coupleId, couple.id),
      ),
      with: {
        messages: true,
      },
    });

    if (!session) {
      throw new AppError("NOT_FOUND", "Watch session not found.", 404);
    }

    if (session.status === "completed") return ok();

    const endedAt = new Date();
    await db
      .update(watchSessions)
      .set({ status: "completed", endedAt })
      .where(eq(watchSessions.id, sessionId));

    const watchDuration = session.startedAt 
      ? Math.round((endedAt.getTime() - session.startedAt.getTime()) / 60000)
      : 0;

    // Generate RIE Summary locally
    const msgsList = session.messages
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => m.content);

    const rie = getLocalAIProvider();
    const aiSummary = await rie.generateSummary(msgsList, session.title, watchDuration);

    await db.insert(movieMemories).values({
      id: createId(),
      coupleId: couple.id,
      sessionId: session.id,
      title: session.title,
      posterUrl: session.posterUrl,
      watchDuration,
      date: endedAt,
      aiSummary,
    });

    await appendRelationshipEvent({
      coupleId: couple.id,
      actorUserId: user.id,
      eventType: "watch_ended",
      payload: { sessionId, watchDuration },
    });
    await incrementEngagement(couple.id, "watch");
    await bumpChallengeProgress({
      coupleId: couple.id,
      actorUserId: user.id,
      code: "movie_night",
    });
    await tryUnlockAchievement(couple.id, user.id, "first_watch");

    revalidatePath("/together");
    return ok();
  } catch (e) {
    return fail(e);
  }
}
