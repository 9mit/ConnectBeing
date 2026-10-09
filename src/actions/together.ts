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
import { createPartnerNotification } from "@/lib/notifications";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireVerifiedCouple } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import {
  createWatchSessionSchema,
  watchEventSchema,
  watchSessionMessageSchema,
} from "@/lib/validations";
import { and, asc, desc, eq, gt, inArray, isNull, lte, ne, or } from "drizzle-orm";
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
  currentPosition?: number,
): Promise<ActionResult<{ resumable: boolean }>> {
  try {
    const { user, couple } = await requireVerifiedCouple();
    await assertWatchSessionOwned(sessionId, couple.id);

    const session = await db.query.watchSessions.findFirst({
      where: and(
        eq(watchSessions.id, sessionId),
        eq(watchSessions.coupleId, couple.id),
      ),
    });

    if (!session) {
      throw new AppError("NOT_FOUND", "Watch session not found.", 404);
    }

    const now = new Date();
    const pos =
      typeof currentPosition === "number" && currentPosition >= 0
        ? Math.round(currentPosition)
        : undefined;

    // Atomically transition to ended_unfinished ONLY IF NOT COMPLETED.
    // If the session was already completed, ne(watchSessions.status, "completed")
    // guarantees that a "Not yet" or leave request NEVER reverts a completed session!
    const updated = await db
      .update(watchSessions)
      .set({
        status: "ended_unfinished",
        currentPosition: pos,
        playbackState: "paused",
        hostStreamActive: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(watchSessions.id, sessionId),
          eq(watchSessions.coupleId, couple.id),
          ne(watchSessions.status, "completed"),
        ),
      )
      .returning();

    await db
      .update(watchParticipants)
      .set({ leftAt: now })
      .where(
        and(
          eq(watchParticipants.sessionId, sessionId),
          eq(watchParticipants.userId, user.id),
        ),
      );

    try {
      revalidatePath("/together");
      revalidatePath(`/together/room/${sessionId}`);
    } catch {
      // safe fallback
    }

    return ok({ resumable: updated.length > 0 });
  } catch (e) {
    return fail(e);
  }
}

export async function finishWatchSessionAction(
  sessionId: string,
  playbackPosition?: number,
): Promise<ActionResult<{ memoryId: string; sessionId: string }>> {
  try {
    const { user, couple } = await requireVerifiedCouple();
    await assertWatchSessionOwned(sessionId, couple.id);

    const endedAt = new Date();
    // Strict 7-day retention: expires_at must equal endedAt + 7 days
    const expiresAt = new Date(endedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      // 1. Transactional state transition:
      // ONLY active / paused / ended_unfinished / scheduled -> completed
      // If already completed (e.g. concurrent request by partner), updated.length will be 0.
      const updated = await tx
        .update(watchSessions)
        .set({
          status: "completed",
          endedAt,
          currentPosition:
            typeof playbackPosition === "number" && playbackPosition >= 0
              ? Math.round(playbackPosition)
              : undefined,
          playbackState: "paused",
          hostStreamActive: false,
          updatedAt: endedAt,
        })
        .where(
          and(
            eq(watchSessions.id, sessionId),
            eq(watchSessions.coupleId, couple.id),
            inArray(watchSessions.status, ["active", "paused", "ended_unfinished", "scheduled"]),
          ),
        )
        .returning();

      // If already completed or not in resumable status:
      if (updated.length === 0) {
        const existingSession = await tx.query.watchSessions.findFirst({
          where: and(
            eq(watchSessions.id, sessionId),
            eq(watchSessions.coupleId, couple.id),
          ),
        });

        if (!existingSession) {
          throw new AppError("NOT_FOUND", "Watch session not found.", 404);
        }

        // Concurrently completed: query existing movie_memories record
        const existingMemory = await tx.query.movieMemories.findFirst({
          where: and(
            eq(movieMemories.sessionId, sessionId),
            eq(movieMemories.coupleId, couple.id),
          ),
        });

        return {
          memoryId: existingMemory?.id || "",
          sessionId,
          alreadyCompleted: true,
          watchDuration: 0,
        };
      }

      const session = updated[0];
      const watchDuration = session.startedAt
        ? Math.max(1, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 60000))
        : 1;

      // 2. Insert exactly one movie_memories record
      // With UNIQUE(session_id) and onConflictDoNothing, guarantees zero duplicate vault records.
      const memoryId = createId();
      await tx
        .insert(movieMemories)
        .values({
          id: memoryId,
          coupleId: couple.id,
          sessionId: session.id,
          title: session.title,
          provider: session.provider,
          posterUrl: session.posterUrl,
          watchDuration,
          date: endedAt,
          expiresAt,
        })
        .onConflictDoNothing({ target: movieMemories.sessionId });

      // Update participant record
      await tx
        .update(watchParticipants)
        .set({ leftAt: endedAt })
        .where(
          and(
            eq(watchParticipants.sessionId, sessionId),
            eq(watchParticipants.userId, user.id),
          ),
        );

      return {
        memoryId,
        sessionId,
        alreadyCompleted: false,
        watchDuration,
      };
    });

    if (!result.alreadyCompleted) {
      try {
        await appendRelationshipEvent({
          coupleId: couple.id,
          actorUserId: user.id,
          eventType: "watch_ended",
          payload: { sessionId, watchDuration: result.watchDuration, completed: true },
        });
        await incrementEngagement(couple.id, "watch");
        await bumpChallengeProgress({
          coupleId: couple.id,
          actorUserId: user.id,
          code: "movie_night",
        });
        await tryUnlockAchievement(couple.id, user.id, "first_watch");
      } catch (metricErr) {
        console.warn("[finishWatchSessionAction] Metrics update warning:", metricErr);
      }
    }

    try {
      revalidatePath("/together");
      revalidatePath(`/together/room/${sessionId}`);
    } catch {
      // safe fallback
    }

    return ok({ memoryId: result.memoryId, sessionId });
  } catch (e) {
    console.error("[finishWatchSessionAction] Error:", e);
    return fail(e);
  }
}

export async function deleteMovieMemoryAction(
  memoryId: string,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    const { couple } = await requireVerifiedCouple();

    // Verify ownership: memory must belong to current user's active couple
    const existing = await db.query.movieMemories.findFirst({
      where: and(
        eq(movieMemories.id, memoryId),
        eq(movieMemories.coupleId, couple.id),
      ),
    });

    if (!existing) {
      throw new AppError("NOT_FOUND", "Movie memory not found or access denied.", 404);
    }

    await db
      .delete(movieMemories)
      .where(
        and(
          eq(movieMemories.id, memoryId),
          eq(movieMemories.coupleId, couple.id),
        ),
      );

    try {
      revalidatePath("/together");
    } catch {
      // safe fallback
    }

    return ok({ deleted: true });
  } catch (e) {
    console.error("[deleteMovieMemoryAction] Error:", e);
    return fail(e);
  }
}


export async function endWatchSessionAction(
  sessionId: string,
): Promise<ActionResult<void>> {
  // Legacy / graceful fallback: leaving session preserves unfinished resumable state without vault insertion.
  const res = await leaveWatchSessionAction(sessionId);
  if (!res.ok) return fail(res.error);
  return ok();
}

export async function updateWatchSessionStreamAction(
  sessionId: string,
  updates: {
    hostStreamActive?: boolean;
    hostStreamType?: "none" | "tab" | "window" | "screen";
    playbackState?: "idle" | "playing" | "paused" | "buffering";
    currentPosition?: number;
    status?: "scheduled" | "active" | "paused" | "ended_unfinished" | "completed" | "cancelled";
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

export async function setWatchSessionDirectMediaAction(
  sessionId: string,
  mediaUrl: string | null,
  mediaTitle?: string | null,
): Promise<ActionResult<{ success: true }>> {
  try {
    const { couple } = await requireVerifiedCouple();
    await assertWatchSessionOwned(sessionId, couple.id);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (mediaUrl) {
      updateData.hostStreamActive = true;
      updateData.hostStreamType = `network:${mediaUrl}`;
      if (mediaTitle) {
        updateData.invitationMessage = mediaTitle;
      }
    } else {
      updateData.hostStreamActive = false;
      updateData.hostStreamType = "none";
    }

    await db
      .update(watchSessions)
      .set(updateData)
      .where(eq(watchSessions.id, sessionId));

    try {
      revalidatePath(`/together/room/${sessionId}`);
    } catch {
      // safe fallback
    }

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

export async function sendWatchMessageAction(
  rawInput: {
    sessionId: string;
    content: string;
    playbackPosition?: number | null;
  },
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, couple } = await requireVerifiedCouple();
    const parsed = watchSessionMessageSchema.parse(rawInput);
    await assertWatchSessionOwned(parsed.sessionId, couple.id);

    const messageId = createId();
    await db.insert(watchMessages).values({
      id: messageId,
      sessionId: parsed.sessionId,
      userId: user.id,
      content: parsed.content,
      playbackPosition: typeof parsed.playbackPosition === "number" ? parsed.playbackPosition : null,
      createdAt: new Date(),
    });

    return ok({ id: messageId });
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

