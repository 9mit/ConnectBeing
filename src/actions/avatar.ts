"use server";

import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { db } from "@/db";
import { onboardingProfiles } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireOnboardedUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getModerationProvider } from "@/lib/moderation/provider";
import { z } from "zod";

const AVATAR_BUCKET = "couple-media";

const avatarSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

function isValidAvatarKey(key: string, userId: string): boolean {
  return new RegExp(
    `^avatars/${userId}/[a-zA-Z0-9_-]+\\.(jpe?g|png|webp)$`,
    "i",
  ).test(key);
}

export async function createAvatarUploadAction(
  input: unknown,
): Promise<ActionResult<{ storageKey: string; uploadUrl: string }>> {
  try {
    const parsed = avatarSchema.parse(input);
    const user = await requireOnboardedUser();
    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:avatar:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 60,
    });

    const ext =
      parsed.mimeType === "image/png"
        ? "png"
        : parsed.mimeType === "image/webp"
          ? "webp"
          : "jpg";
    const storageKey = `avatars/${user.id}/${randomUUID()}.${ext}`;

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(AVATAR_BUCKET)
      .createSignedUploadUrl(storageKey, { upsert: false });

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to create upload URL.",
        500,
      );
    }

    return ok({ storageKey, uploadUrl: data.signedUrl });
  } catch (e) {
    return fail(e);
  }
}

export async function confirmAvatarUploadAction(
  input: unknown,
): Promise<ActionResult<{ avatarUrl: string | null }>> {
  try {
    const parsed = z
      .object({
        storageKey: z.string().min(1).max(500),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
      })
      .parse(input);
    const user = await requireOnboardedUser();

    if (!isValidAvatarKey(parsed.storageKey, user.id)) {
      throw new AppError("FORBIDDEN", "Invalid avatar storage key.", 403);
    }

    const admin = createAdminClient();
    const { data: file, error: dlErr } = await admin.storage
      .from(AVATAR_BUCKET)
      .download(parsed.storageKey);
    if (dlErr || !file) {
      throw new AppError("NOT_FOUND", "Avatar upload not found.", 404);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = parsed.mimeType ?? "image/jpeg";
    const moderation = await getModerationProvider().checkImage(bytes, mime);
    if (!moderation.safe) {
      await admin.storage.from(AVATAR_BUCKET).remove([parsed.storageKey]);
      throw new AppError(
        "MODERATION_REJECTED",
        "Image rejected by content moderation.",
        422,
      );
    }

    // Persist storage key only — resolve short-lived signed URLs on read
    await db
      .update(onboardingProfiles)
      .set({ avatarUrl: parsed.storageKey, updatedAt: new Date() })
      .where(eq(onboardingProfiles.userId, user.id));

    const { data: signed } = await admin.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(parsed.storageKey, 60 * 15);

    return ok({ avatarUrl: signed?.signedUrl ?? null });
  } catch (e) {
    return fail(e);
  }
}

/** Short-lived signed URL for an avatar storage key owned by a couple member. */
export async function resolveAvatarUrlAction(
  storageKey: string | null | undefined,
): Promise<ActionResult<{ url: string | null }>> {
  try {
    await requireOnboardedUser();
    if (!storageKey || !storageKey.startsWith("avatars/")) {
      return ok({ url: null });
    }
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(storageKey, 60 * 15);
    return ok({ url: signed?.signedUrl ?? null });
  } catch (e) {
    return fail(e);
  }
}
