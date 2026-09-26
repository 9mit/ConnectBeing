"use server";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  coupleVerifications,
  couples,
  verificationAttemptLogs,
} from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import {
  codesMatch,
  generateVerificationCode,
  hashVerificationCode,
  isCoupleVerified,
  issueVerificationPeriod,
  notifyCoupleVerification,
  verificationDueSoon,
  verificationExpired,
  verificationPlaintextRedisKey,
} from "@/lib/couple-verification";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { redis } from "@/lib/redis";
import { rateLimitOrThrow } from "@/lib/security";
import { submitVerificationCodeSchema } from "@/lib/validations";

export async function getVerificationStatusAction(): Promise<
  ActionResult<{
    role: "revealer" | "submitter";
    verifiedUntil: string | null;
    isVerified: boolean;
    dueSoon: boolean;
    expired: boolean;
    hoursRemaining: number | null;
  }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    const role =
      couple.userAId === user.id ? "revealer" : ("submitter" as const);
    const verifiedUntil = couple.verifiedUntil?.toISOString() ?? null;
    const hoursRemaining = couple.verifiedUntil
      ? Math.max(
          0,
          (couple.verifiedUntil.getTime() - Date.now()) / (60 * 60 * 1000),
        )
      : null;

    return ok({
      role,
      verifiedUntil,
      isVerified: isCoupleVerified(couple),
      dueSoon: verificationDueSoon(couple, 48),
      expired: verificationExpired(couple),
      hoursRemaining,
    });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Partner A only — returns plaintext from Redis (hash-only in Postgres).
 * If cache missed, rotates the active row hash once and re-caches.
 */
export async function revealVerificationCodeAction(): Promise<
  ActionResult<{
    code: string;
    periodEnd: string;
  }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    if (couple.userAId !== user.id) {
      throw new AppError(
        "FORBIDDEN",
        "Only your partner who created the invite can reveal this week’s code.",
        403,
      );
    }

    await rateLimitOrThrow({
      key: `verify:reveal:${user.id}`,
      limit: 10,
      windowSeconds: 15 * 60,
      message: "Too many reveal attempts. Try again later.",
    });

    const now = new Date();
    const row = await db.query.coupleVerifications.findFirst({
      where: and(
        eq(coupleVerifications.coupleId, couple.id),
        eq(coupleVerifications.revealedToUserId, couple.userAId),
        isNull(coupleVerifications.consumedAt),
        gt(coupleVerifications.periodEnd, now),
      ),
    });

    if (!row) {
      const issued = await issueVerificationPeriod({
        coupleId: couple.id,
        revealedToUserId: couple.userAId,
        syncVerifiedUntil: !couple.verifiedUntil || verificationExpired(couple),
      });
      return ok({
        code: issued.code,
        periodEnd: issued.periodEnd.toISOString(),
      });
    }

    const cached = await redis.get(verificationPlaintextRedisKey(couple.id));
    if (typeof cached === "string" && cached.length === 8) {
      return ok({
        code: cached.toUpperCase(),
        periodEnd: row.periodEnd.toISOString(),
      });
    }

    // Cache miss: rotate hash for this period and re-cache (Partner B must use new code)
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(
      code,
      couple.id,
      row.periodStart.toISOString(),
    );
    await db
      .update(coupleVerifications)
      .set({ codeHash })
      .where(eq(coupleVerifications.id, row.id));

    const ttlSeconds = Math.max(
      60,
      Math.ceil((row.periodEnd.getTime() - Date.now()) / 1000),
    );
    await redis.set(verificationPlaintextRedisKey(couple.id), code, {
      ex: ttlSeconds,
    });

    return ok({
      code,
      periodEnd: row.periodEnd.toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function submitVerificationCodeAction(
  input: unknown,
): Promise<ActionResult<{ verifiedUntil: string }>> {
  try {
    const parsed = submitVerificationCodeSchema.parse(input);
    const { user, couple } = await requireActiveCouple();

    if (couple.userAId === user.id) {
      throw new AppError(
        "FORBIDDEN",
        "Ask your partner to enter the code — you are the code holder.",
        403,
      );
    }

    await rateLimitOrThrow({
      key: `verify:submit:${user.id}`,
      limit: 5,
      windowSeconds: 15 * 60,
      message: "Too many attempts. Try again later.",
    });

    const now = new Date();
    const row = await db.query.coupleVerifications.findFirst({
      where: and(
        eq(coupleVerifications.coupleId, couple.id),
        isNull(coupleVerifications.consumedAt),
        gt(coupleVerifications.periodEnd, now),
      ),
    });

    const logAttempt = async (success: boolean, reason: string) => {
      await db.insert(verificationAttemptLogs).values({
        id: createId(),
        coupleId: couple.id,
        actorUserId: user.id,
        success,
        reason,
      });
    };

    if (!row) {
      await logAttempt(false, "no_active_code");
      throw new AppError("FORBIDDEN", "Invalid or expired code.", 403);
    }

    const attemptHash = hashVerificationCode(
      parsed.code,
      couple.id,
      row.periodStart.toISOString(),
    );

    if (!codesMatch(attemptHash, row.codeHash)) {
      await logAttempt(false, "mismatch");
      throw new AppError("FORBIDDEN", "Invalid or expired code.", 403);
    }

    const newUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(coupleVerifications)
        .set({ consumedAt: now })
        .where(
          and(
            eq(coupleVerifications.id, row.id),
            isNull(coupleVerifications.consumedAt),
          ),
        )
        .returning({ id: coupleVerifications.id });

      if (updated.length === 0) {
        throw new AppError("FORBIDDEN", "Verification code has already been consumed.", 403);
      }

      await tx
        .update(couples)
        .set({ verifiedUntil: newUntil })
        .where(eq(couples.id, couple.id));
    });

    await logAttempt(true, "ok");

    try {
      await redis.del(verificationPlaintextRedisKey(couple.id));
    } catch {
      /* ignore */
    }

    // Next week’s code for Partner A (does not shrink verifiedUntil)
    await issueVerificationPeriod({
      coupleId: couple.id,
      revealedToUserId: couple.userAId,
      periodStart: now,
      syncVerifiedUntil: false,
    });


    await notifyCoupleVerification({
      coupleId: couple.id,
      kind: "consumed",
    });

    return ok({ verifiedUntil: newUntil.toISOString() });
  } catch (e) {
    return fail(e);
  }
}
