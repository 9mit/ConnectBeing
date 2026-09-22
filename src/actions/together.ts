"use server";

import { db } from "@/db";
import {
  inAppNotifications,
  movieMemories,
  onboardingProfiles,
  watchEvents,
  watchMessages,
  watchParticipants,
  watchSessions,
} from "@/db/schema";
import { createPartnerNotification } from "@/actions/notifications";
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
import { and, asc, eq } from "drizzle-orm";
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
    const { user, couple } = await requireVerifiedCouple();

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

    const defaultPoster =
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80";
    const posterUrl = parsed.posterUrl?.trim() || defaultPoster;

    let scheduledForDate = new Date();
    if (parsed.scheduledFor) {
      const d = new Date(parsed.scheduledFor);
      if (!isNaN(d.getTime())) {
        scheduledForDate = d;
      }
    }

    await db.insert(watchSessions).values({
      id: sessionId,
      coupleId: couple.id,
      hostUserId: user.id,
      provider: dbProvider,
      title: parsed.title,
      posterUrl,
      scheduledFor: scheduledForDate,
      invitationMessage: parsed.invitationMessage || null,
      theme: parsed.theme || null,
      hostStreamActive: false,
      hostStreamType: "none",
      playbackState: "idle",
      currentPosition: 0,
    });

    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    const profile = await db.query.onboardingProfiles.findFirst({
      where: eq(onboardingProfiles.userId, user.id),
    });
    const senderName = profile?.name?.trim() || "Your partner";

    if (partnerId) {
      await createPartnerNotification({
        coupleId: couple.id,
        senderUserId: user.id,
        partnerUserId: partnerId,
        title: "🍿 Movie Night Planned",
        body: `${senderName} planned a movie date: "${parsed.title}"`,
        kind: "watch",
        link: `/together/room/${sessionId}`,
      }).catch((err) => {
        console.error("Failed to notify partner of watch session:", err);
      });

      // Keep confirmation in notifications for the creator too so both partners have it logged
      await db
        .insert(inAppNotifications)
        .values({
          id: createId(),
          coupleId: couple.id,
          userId: user.id,
          title: "🍿 Movie Night Scheduled",
          body: `You planned a movie date with your partner: "${parsed.title}"`,
          kind: "watch",
          link: `/together/room/${sessionId}`,
          read: true,
        })
        .catch((err) => {
          console.error("Failed to log movie plan for user:", err);
        });
    }

    try {
      revalidatePath("/together");
      revalidatePath("/notifications");
      revalidatePath("/dashboard");
    } catch {
      // ignore if invoked during render
    }

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

    try {
      revalidatePath(`/together/room/${sessionId}`);
    } catch {
      // safe fallback if invoked during RSC render
    }
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
): Promise<ActionResult<{ id: string; content: string; createdAt: string }>> {
  try {
    const parsed = watchSessionMessageSchema.parse(input);
    const { user, couple } = await requireVerifiedCouple();
    await assertWatchSessionOwned(parsed.sessionId, couple.id);

    const id = createId();
    const now = new Date();
    await db.insert(watchMessages).values({
      id,
      sessionId: parsed.sessionId,
      userId: user.id,
      content: parsed.content,
      playbackPosition: parsed.playbackPosition,
      createdAt: now,
    });

    return ok({ id, content: parsed.content, createdAt: now.toISOString() });
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

    const endedAt = new Date();
    if (session.status !== "completed") {
      await db
        .update(watchSessions)
        .set({ status: "completed", endedAt })
        .where(eq(watchSessions.id, sessionId));
    }

    const watchDuration = session.startedAt 
      ? Math.max(1, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 60000))
      : 1;

    // Check if memory recap was already recorded to avoid duplicate key conflicts
    const existingMemory = await db.query.movieMemories.findFirst({
      where: and(
        eq(movieMemories.sessionId, session.id),
        eq(movieMemories.coupleId, couple.id),
      ),
    });

    if (!existingMemory) {
      // Generate RIE Summary locally with robust fallback
      const msgsList = (session.messages || [])
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((m) => m.content);

      let aiSummary = null;
      try {
        const rie = getLocalAIProvider();
        aiSummary = await rie.generateSummary(msgsList, session.title, watchDuration);
      } catch (aiErr) {
        console.warn("[endWatchSessionAction] AI summary fallback:", aiErr);
        aiSummary = {
          recap: `You shared a cinematic watch of "${session.title}" (${watchDuration} mins) together in your private theater.`,
          bestMoments: ["Movie night together in private theater"],
          questions: [],
        };
      }

      try {
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
      } catch (insertMemErr) {
        console.warn("[endWatchSessionAction] Memory insert warning:", insertMemErr);
      }
    }

    try {
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
    } catch (metricErr) {
      console.warn("[endWatchSessionAction] Metrics update warning:", metricErr);
    }

    revalidatePath("/together");
    return ok();
  } catch (e) {
    console.error("[endWatchSessionAction] Error:", e);
    return fail(e);
  }
}

export async function updateWatchSessionStreamAction(
  sessionId: string,
  updates: {
    hostStreamActive?: boolean;
    hostStreamType?: "none" | "tab" | "window" | "screen";
    playbackState?: "idle" | "playing" | "paused" | "buffering";
    currentPosition?: number;
    status?: "scheduled" | "active" | "completed" | "cancelled";
  },
): Promise<ActionResult<{ success: true }>> {
  try {
    const { couple } = await requireVerifiedCouple();
    await assertWatchSessionOwned(sessionId, couple.id);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (typeof updates.hostStreamActive === "boolean") {
      updateData.hostStreamActive = updates.hostStreamActive;
    }
    if (updates.hostStreamType) {
      updateData.hostStreamType = updates.hostStreamType;
    }
    if (updates.playbackState) {
      updateData.playbackState = updates.playbackState;
    }
    if (typeof updates.currentPosition === "number") {
      updateData.currentPosition = Math.max(0, Math.round(updates.currentPosition));
    }
    if (updates.status) {
      updateData.status = updates.status;
    }

    await db
      .update(watchSessions)
      .set(updateData)
      .where(eq(watchSessions.id, sessionId));

    return ok({ success: true });
  } catch (e) {
    return fail(e);
  }
}

export async function getWatchSessionDetailsAction(
  sessionId: string,
): Promise<
  ActionResult<{
    id: string;
    coupleId: string;
    hostUserId: string | null;
    provider: string;
    title: string;
    posterUrl: string | null;
    scheduledFor: string;
    status: string;
    hostStreamActive: boolean;
    hostStreamType: string;
    playbackState: string;
    currentPosition: number;
    isHost: boolean;
  }>
> {
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

    return ok({
      id: session.id,
      coupleId: session.coupleId,
      hostUserId: session.hostUserId,
      provider: session.provider,
      title: session.title,
      posterUrl: session.posterUrl,
      scheduledFor: session.scheduledFor.toISOString(),
      status: session.status,
      hostStreamActive: !!session.hostStreamActive,
      hostStreamType: session.hostStreamType || "none",
      playbackState: session.playbackState || "idle",
      currentPosition: session.currentPosition || 0,
      isHost: session.hostUserId ? session.hostUserId === user.id : couple.userAId === user.id,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function getWatchMessagesAction(
  sessionId: string,
): Promise<
  ActionResult<
    Array<{
      id: string;
      userId: string;
      content: string;
      playbackPosition: number | null;
      createdAt: string;
    }>
  >
> {
  try {
    const { couple } = await requireVerifiedCouple();
    await assertWatchSessionOwned(sessionId, couple.id);

    const msgs = await db.query.watchMessages.findMany({
      where: eq(watchMessages.sessionId, sessionId),
      orderBy: [asc(watchMessages.createdAt)],
      limit: 100,
    });

    return ok(
      msgs.map((m) => ({
        id: m.id,
        userId: m.userId,
        content: m.content,
        playbackPosition: m.playbackPosition,
        createdAt: m.createdAt.toISOString(),
      })),
    );
  } catch (e) {
    return fail(e);
  }
}

export async function deleteWatchSessionAction(
  sessionId: string,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    const { user, couple } = await requireVerifiedCouple();
    await assertWatchSessionOwned(sessionId, couple.id);

    const session = await db.query.watchSessions.findFirst({
      where: and(
        eq(watchSessions.id, sessionId),
        eq(watchSessions.coupleId, couple.id),
      ),
    });

    await db
      .delete(watchSessions)
      .where(
        and(
          eq(watchSessions.id, sessionId),
          eq(watchSessions.coupleId, couple.id),
        ),
      );

    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    if (session && partnerId) {
      const profile = await db.query.onboardingProfiles.findFirst({
        where: eq(onboardingProfiles.userId, user.id),
      });
      const senderName = profile?.name?.trim() || "Your partner";

      await createPartnerNotification({
        coupleId: couple.id,
        senderUserId: user.id,
        partnerUserId: partnerId,
        title: "🍿 Movie Night Cancelled",
        body: `${senderName} cancelled the planned movie: "${session.title}"`,
        kind: "watch",
        link: "/together",
      }).catch(() => {});
    }

    try {
      revalidatePath("/together");
      revalidatePath("/notifications");
      revalidatePath("/dashboard");
    } catch {
      // ignore outside request
    }

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}

