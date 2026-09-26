"use server";

import { and, asc, desc, eq, lt, or } from "drizzle-orm";
import { randomUUID } from "crypto";

import { db } from "@/db";
import {
  ephemeralMedia,
  memories,
  messages,
  movieMemories,
  relationshipEvents,
} from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { getModerationProvider } from "@/lib/moderation";
import { redis } from "@/lib/redis";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ephemeralConfirmSchema,
  memoryMetaSchema,
  viewEphemeralSchema,
} from "@/lib/validations";
import { appendRelationshipEvent } from "@/lib/events";
import { isValidCoupleStorageKey, rateLimitOrThrow } from "@/lib/security";
import { z } from "zod";

const MEDIA_BUCKET = "couple-media";

function assertCoupleStorageKey(
  storageKey: string,
  kind: "ephemeral" | "memories",
  coupleId: string,
): void {
  if (!isValidCoupleStorageKey(storageKey, kind, coupleId)) {
    throw new AppError("FORBIDDEN", "Invalid storage key for couple.", 403);
  }
}

const presignSchema = z.object({
  kind: z.enum(["ephemeral", "memory"]),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function downloadStorageObject(storageKey: string): Promise<Buffer> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(MEDIA_BUCKET)
    .download(storageKey);

  if (error || !data) {
    throw new AppError(
      "NOT_FOUND",
      error?.message ?? "Upload not found in storage.",
      404,
    );
  }

  const ab = await data.arrayBuffer();

  // Guard against unexpectedly large files before converting to Buffer
  const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
  if (ab.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new AppError(
      "VALIDATION_ERROR",
      `File too large (${Math.round(ab.byteLength / 1024 / 1024)}MB). Maximum is 10MB.`,
      400,
    );
  }

  return Buffer.from(ab);
}

async function removeStorageObject(storageKey: string): Promise<void> {
  const admin = createAdminClient();
  await admin.storage.from(MEDIA_BUCKET).remove([storageKey]);
}

export async function createPresignedUploadAction(
  input: unknown,
): Promise<
  ActionResult<{ storageKey: string; uploadUrl: string; token: string; path: string }>
> {
  try {
    const parsed = presignSchema.parse(input);
    const { user, couple } = await requireActiveCouple();
    await rateLimitOrThrow({
      key: `rl:upload:${user.id}`,
      limit: 30,
      windowSeconds: 60 * 15,
      message: "Too many uploads. Try again later.",
    });

    const ext = extForMime(parsed.mimeType);
    const folder = parsed.kind === "ephemeral" ? "ephemeral" : "memories";
    const storageKey = `${folder}/${couple.id}/${randomUUID()}.${ext}`;

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(storageKey, { upsert: false });

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        error?.message ?? "Failed to create upload URL.",
        500,
      );
    }

    return ok({
      storageKey,
      uploadUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function confirmEphemeralUploadAction(
  input: unknown,
): Promise<ActionResult<{ mediaId: string; messageId: string }>> {
  let cleanupKey: string | undefined;
  try {
    const parsed = ephemeralConfirmSchema.parse(input);
    const { user, couple } = await requireActiveCouple();

    assertCoupleStorageKey(parsed.storageKey, "ephemeral", couple.id);
    cleanupKey = parsed.storageKey;

    await rateLimitOrThrow({
      key: `rl:ephemeral-confirm:${user.id}`,
      limit: 20,
      windowSeconds: 60 * 10,
      message: "Too many ephemeral confirmations. Try again later.",
    });

    const bytes = await downloadStorageObject(parsed.storageKey);
    const moderation = await getModerationProvider().checkImage(
      bytes,
      parsed.mimeType,
    );

    if (!moderation.safe) {
      await removeStorageObject(parsed.storageKey);
      cleanupKey = undefined;
      throw new AppError(
        "MODERATION_REJECTED",
        "Image rejected by content moderation.",
        422,
        { reasonCode: moderation.reasonCode ?? "UNSAFE_CONTENT" },
      );
    }

    const mediaId = createId();
    const messageId = createId();

    await db.transaction(async (tx) => {
      await tx.insert(ephemeralMedia).values({
        id: mediaId,
        coupleId: couple.id,
        senderId: user.id,
        storageKey: parsed.storageKey,
        mimeType: parsed.mimeType,
        status: "delivered",
      });

      await tx.insert(messages).values({
        id: messageId,
        coupleId: couple.id,
        senderId: user.id,
        type: "ephemeral_image",
        ephemeralMediaId: mediaId,
      });
    });

    cleanupKey = undefined;
    return ok({ mediaId, messageId });
  } catch (e) {
    if (cleanupKey) {
      try {
        await removeStorageObject(cleanupKey);
      } catch {
        // best-effort orphan cleanup
      }
    }
    return fail(e);
  }
}

export async function viewEphemeralMediaAction(
  input: unknown,
): Promise<ActionResult<{ viewed: true }>> {
  try {
    const parsed = viewEphemeralSchema.parse(input);
    const { couple } = await requireActiveCouple();

    const lockKey = `delete-lock:${parsed.mediaId}`;
    const locked = await redis.set(lockKey, "1", { nx: true, ex: 30 });
    if (!locked) {
      throw new AppError(
        "RATE_LIMITED",
        "Media is already being processed.",
        429,
      );
    }

    try {
      const media = await db.query.ephemeralMedia.findFirst({
        where: and(
          eq(ephemeralMedia.id, parsed.mediaId),
          eq(ephemeralMedia.coupleId, couple.id),
        ),
      });

      if (!media) {
        throw new AppError("NOT_FOUND", "Ephemeral media not found.", 404);
      }

      if (media.status === "deleted" || !media.storageKey) {
        return ok({ viewed: true });
      }

      await db
        .update(ephemeralMedia)
        .set({ status: "viewed", viewedAt: new Date() })
        .where(eq(ephemeralMedia.id, media.id));

      await removeStorageObject(media.storageKey);

      await db
        .update(ephemeralMedia)
        .set({
          status: "deleted",
          deletedAt: new Date(),
          storageKey: null,
        })
        .where(eq(ephemeralMedia.id, media.id));

      return ok({ viewed: true });
    } finally {
      await redis.del(lockKey);
    }
  } catch (e) {
    return fail(e);
  }
}

export async function getEphemeralSignedUrlAction(
  mediaId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const cleanMediaId = z.string().min(1).max(128).parse(mediaId);
    const { user, couple } = await requireActiveCouple();

    const lockKey = `lock:ephemeral:${cleanMediaId}`;
    const acquired = await redis.set(lockKey, "1", { nx: true, ex: 10 });
    if (!acquired) {
      throw new AppError("CONFLICT", "Media is currently being opened.", 409);
    }

    try {
      const media = await db.query.ephemeralMedia.findFirst({
        where: and(
          eq(ephemeralMedia.id, cleanMediaId),
          eq(ephemeralMedia.coupleId, couple.id),
        ),
      });

      if (!media?.storageKey || media.status === "deleted") {
        throw new AppError("NOT_FOUND", "Media no longer available.", 404);
      }

      // View-once media is strictly recipient-only. Senders cannot re-open.
      if (media.senderId === user.id) {
        throw new AppError("FORBIDDEN", "View-once media can only be opened by the recipient.", 403);
      }

      if (media.status !== "delivered") {
        throw new AppError("FORBIDDEN", "Media has already been viewed or has expired.", 403);
      }

      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(media.storageKey, 30);

      if (error || !data) {
        throw new AppError("INTERNAL_ERROR", "Could not sign media URL.", 500);
      }

      // Mark as viewed atomically to prevent repeated opens
      await db
        .update(ephemeralMedia)
        .set({ status: "viewed", viewedAt: new Date() })
        .where(
          and(
            eq(ephemeralMedia.id, media.id),
            eq(ephemeralMedia.status, "delivered"),
          ),
        );

      return ok({ url: data.signedUrl });
    } finally {
      await redis.del(lockKey);
    }
  } catch (e) {
    return fail(e);
  }
}


export async function confirmMemoryUploadAction(
  input: unknown,
): Promise<ActionResult<{ memoryId: string }>> {
  let cleanupKey: string | undefined;
  try {
    const parsed = memoryMetaSchema.parse(input);
    const { user, couple } = await requireActiveCouple();

    assertCoupleStorageKey(parsed.storageKey, "memories", couple.id);
    cleanupKey = parsed.storageKey;

    await rateLimitOrThrow({
      key: `rl:memory-confirm:${user.id}`,
      limit: 30,
      windowSeconds: 60 * 15,
      message: "Too many memory upload confirmations. Try again later.",
    });

    const bytes = await downloadStorageObject(parsed.storageKey);
    const moderation = await getModerationProvider().checkImage(
      bytes,
      parsed.mimeType,
    );

    if (!moderation.safe) {
      await removeStorageObject(parsed.storageKey);
      cleanupKey = undefined;
      throw new AppError(
        "MODERATION_REJECTED",
        "Image rejected by content moderation.",
        422,
        { reasonCode: moderation.reasonCode ?? "UNSAFE_CONTENT" },
      );
    }

    const memoryId = createId();
    await db.insert(memories).values({
      id: memoryId,
      coupleId: couple.id,
      uploaderId: user.id,
      storageKey: parsed.storageKey,
      caption: parsed.caption,
      takenAt: new Date(parsed.takenAt),
      eventLabel: parsed.eventLabel,
    });

    cleanupKey = undefined;
    await appendRelationshipEvent({
      coupleId: couple.id,
      actorUserId: user.id,
      eventType: "memory_added",
      payload: { memoryId },
    });
    return ok({ memoryId });
  } catch (e) {
    if (cleanupKey) {
      try {
        await removeStorageObject(cleanupKey);
      } catch {
        // best-effort orphan cleanup
      }
    }
    return fail(e);
  }
}

export async function listMemoriesAction(): Promise<
  ActionResult<{
    memories: Array<{
      id: string;
      caption: string | null;
      takenAt: string;
      eventLabel: string | null;
      url: string | null;
    }>;
  }>
> {
  try {
    const { couple } = await requireActiveCouple();
    const rows = await db.query.memories.findMany({
      where: eq(memories.coupleId, couple.id),
      orderBy: [asc(memories.takenAt)],
      limit: 100,
    });

    const admin = createAdminClient();
    const mapped = await Promise.all(
      rows.map(async (m) => {
        const { data } = await admin.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(m.storageKey, 3600);
        return {
          id: m.id,
          caption: m.caption,
          takenAt: m.takenAt.toISOString(),
          eventLabel: m.eventLabel,
          url: data?.signedUrl ?? null,
        };
      }),
    );

    return ok({ memories: mapped });
  } catch (e) {
    return fail(e);
  }
}

export type TimelineKind =
  | "photo"
  | "movie"
  | "mood"
  | "quiz"
  | "call"
  | "watch"
  | "challenge"
  | "achievement"
  | "memory";

const EVENT_LABELS: Record<
  string,
  { kind: TimelineKind; title: (payload: Record<string, unknown>) => string }
> = {
  mood_logged: {
    kind: "mood",
    title: (p) => `Vibe check · ${String(p.mood ?? "logged")}`,
  },
  quiz_completed: {
    kind: "quiz",
    title: (p) =>
      `Daily quiz · ${Number(p.score ?? 0)}/${Number(p.maxScore ?? 0)}`,
  },
  call_started: { kind: "call", title: () => "Call started" },
  call_ended: { kind: "call", title: () => "Call together" },
  watch_started: { kind: "watch", title: () => "Together night started" },
  watch_ended: {
    kind: "watch",
    title: (p) =>
      p.watchDuration
        ? `Together night · ${Number(p.watchDuration)} min`
        : "Together night finished",
  },
  challenge_completed: {
    kind: "challenge",
    title: (p) => `Quest complete · ${String(p.code ?? "challenge")}`,
  },
  achievement_unlocked: {
    kind: "achievement",
    title: (p) => `Trophy · ${String(p.code ?? "unlocked")}`,
  },
  memory_added: {
    kind: "memory",
    title: () => "Memory added to the vault",
  },
};

/** Relationship acts only — never message ciphertext. */
const TIMELINE_EVENT_TYPES = new Set(Object.keys(EVENT_LABELS));

export async function listTimelineAction(): Promise<
  ActionResult<{
    items: Array<{
      id: string;
      kind: TimelineKind;
      title: string;
      at: string;
      subtitle: string | null;
      url: string | null;
    }>;
  }>
> {
  try {
    const { couple } = await requireActiveCouple();
    const [photos, movies, events] = await Promise.all([
      db.query.memories.findMany({
        where: eq(memories.coupleId, couple.id),
        orderBy: [desc(memories.takenAt)],
        limit: 100,
      }),
      db.query.movieMemories.findMany({
        where: eq(movieMemories.coupleId, couple.id),
        orderBy: [desc(movieMemories.date)],
        limit: 50,
      }),
      db.query.relationshipEvents.findMany({
        where: eq(relationshipEvents.coupleId, couple.id),
        orderBy: [desc(relationshipEvents.createdAt)],
        limit: 80,
      }),
    ]);

    const admin = createAdminClient();
    const photoItems = await Promise.all(
      photos.map(async (m) => {
        const { data } = await admin.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(m.storageKey, 3600);
        return {
          id: m.id,
          kind: "photo" as const,
          title: m.eventLabel || m.caption || "Photo memory",
          at: m.takenAt.toISOString(),
          subtitle: m.caption,
          url: data?.signedUrl ?? null,
        };
      }),
    );

    const movieItems = movies.map((m) => ({
      id: m.id,
      kind: "movie" as const,
      title: m.title,
      at: m.date.toISOString(),
      subtitle: `${m.watchDuration} min Together night`,
      url: m.posterUrl,
    }));

    const mediaCoveredWatch = movieItems.length > 0;
    const mediaCoveredMemory = photoItems.length > 0;
    const eventItems = events
      .filter((e) => TIMELINE_EVENT_TYPES.has(e.eventType))
      .filter((e) => {
        if (
          mediaCoveredWatch &&
          (e.eventType === "watch_ended" || e.eventType === "watch_started")
        ) {
          return false;
        }
        if (mediaCoveredMemory && e.eventType === "memory_added") return false;
        return true;
      })
      .map((e) => {
        const label = EVENT_LABELS[e.eventType]!;
        const payload = (e.payload ?? {}) as Record<string, unknown>;
        return {
          id: e.id,
          kind: label.kind,
          title: label.title(payload),
          at: e.createdAt.toISOString(),
          subtitle: null as string | null,
          url: null as string | null,
        };
      });

    const items = [...photoItems, ...movieItems, ...eventItems].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}
