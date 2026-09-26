import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import {
  coupleVerifications,
  couples,
  type Couple,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { redis } from "@/lib/redis";

/**
 * Grace period after verifiedUntil before features are gated.
 * Intentionally zero — no forgiveness window. Change to e.g. 24*60*60*1000
 * if a grace period is desired in the future.
 */
const GRACE_MS = 0;
const PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** Crockford Base32 alphabet (no I, L, O, U) — 8 chars ≈ 40 bits. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateVerificationCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CROCKFORD[bytes[i]! % 32]!;
  }
  return out;
}

export function hashVerificationCode(
  code: string,
  coupleId: string,
  periodStartIso: string,
): string {
  const normalized = code.trim().toUpperCase();
  return createHash("sha256")
    .update(`${normalized}:${coupleId}:${periodStartIso}`, "utf8")
    .digest("hex");
}

export function codesMatch(aHash: string, bHash: string): boolean {
  const a = Buffer.from(aHash, "utf8");
  const b = Buffer.from(bHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Soft-gate shared couple features when weekly verification lapsed. */
export async function requireCoupleVerified(couple: Couple): Promise<void> {
  if (!isCoupleVerified(couple)) {
    throw new AppError(
      "VERIFICATION_REQUIRED",
      "Weekly couple verification required. Visit /verify to continue.",
      403,
    );
  }
}

export function isCoupleVerified(couple: Couple): boolean {
  if (!couple.verifiedUntil) return false;
  return couple.verifiedUntil.getTime() + GRACE_MS >= Date.now();
}

export function verificationDueSoon(
  couple: Couple,
  withinHours = 48,
): boolean {
  if (!couple.verifiedUntil) return false;
  const msLeft = couple.verifiedUntil.getTime() - Date.now();
  return msLeft > 0 && msLeft <= withinHours * 60 * 60 * 1000;
}

export function verificationExpired(couple: Couple): boolean {
  if (!couple.verifiedUntil) return false;
  return couple.verifiedUntil.getTime() < Date.now();
}

/**
 * Future push/email hook — in-app only for this program.
 * Call sites may invoke; no-op by default.
 */
export async function notifyCoupleVerification(input: {
  coupleId: string;
  kind: "issued" | "due_soon" | "expired" | "consumed";
}): Promise<void> {
  void input;
  // Reserved for push/email later.
}

export function verificationPlaintextRedisKey(coupleId: string): string {
  return `verify:code:${coupleId}`;
}

/**
 * Issue a new hashed verification period for Partner A.
 * Plaintext is kept only in Redis until period end (never in Postgres/logs).
 */
export async function issueVerificationPeriod(input: {
  coupleId: string;
  revealedToUserId: string;
  periodStart?: Date;
  /** When false, only mint the next code row (e.g. after successful submit). */
  syncVerifiedUntil?: boolean;
}): Promise<{ code: string; periodEnd: Date; verificationId: string }> {
  const periodStart = input.periodStart ?? new Date();
  const periodEnd = new Date(periodStart.getTime() + PERIOD_MS);
  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(
    code,
    input.coupleId,
    periodStart.toISOString(),
  );
  const verificationId = createId();

  await db.insert(coupleVerifications).values({
    id: verificationId,
    coupleId: input.coupleId,
    codeHash,
    periodStart,
    periodEnd,
    revealedToUserId: input.revealedToUserId,
  });

  if (input.syncVerifiedUntil !== false) {
    await db
      .update(couples)
      .set({ verifiedUntil: periodEnd })
      .where(eq(couples.id, input.coupleId));
  }

  const ttlSeconds = Math.max(
    60,
    Math.ceil((periodEnd.getTime() - Date.now()) / 1000),
  );
  try {
    await redis.set(verificationPlaintextRedisKey(input.coupleId), code, {
      ex: ttlSeconds,
    });
  } catch (err) {
    console.error("[verify] failed to cache plaintext for reveal", err);
  }

  await notifyCoupleVerification({
    coupleId: input.coupleId,
    kind: "issued",
  });

  return { code, periodEnd, verificationId };
}

/** Ensure an unconsumed, unexpired row exists for Partner A. */
export async function ensureActiveVerificationCode(
  couple: Couple,
): Promise<void> {
  const now = new Date();
  const existing = await db.query.coupleVerifications.findFirst({
    where: and(
      eq(coupleVerifications.coupleId, couple.id),
      isNull(coupleVerifications.consumedAt),
      gt(coupleVerifications.periodEnd, now),
    ),
  });
  if (existing) return;

  await issueVerificationPeriod({
    coupleId: couple.id,
    revealedToUserId: couple.userAId,
    periodStart: now,
  });
}

/** Cron helper: expire stale rows and mint next codes for active couples. */
export async function rotateCoupleVerifications(): Promise<{
  ensured: number;
  dueSoonNotified: number;
}> {
  const now = new Date();
  let ensured = 0;
  let dueSoonNotified = 0;

  const active = await db.query.couples.findMany({
    where: eq(couples.status, "active"),
    limit: 1000,
  });

  for (const couple of active) {
    try {
      if (!couple.verifiedUntil) {
        await issueVerificationPeriod({
          coupleId: couple.id,
          revealedToUserId: couple.userAId,
        });
        ensured += 1;
        continue;
      }

      if (couple.verifiedUntil.getTime() < now.getTime()) {
        await notifyCoupleVerification({
          coupleId: couple.id,
          kind: "expired",
        });
      } else if (verificationDueSoon(couple, 48)) {
        await notifyCoupleVerification({
          coupleId: couple.id,
          kind: "due_soon",
        });
        dueSoonNotified += 1;
      }

      // Drop expired unconsumed rows (keep consumed for audit)
      await db
        .delete(coupleVerifications)
        .where(
          and(
            eq(coupleVerifications.coupleId, couple.id),
            isNull(coupleVerifications.consumedAt),
            lt(coupleVerifications.periodEnd, now),
          ),
        );

      await ensureActiveVerificationCode(couple);
      ensured += 1;
    } catch (err) {
      console.error("[verify] rotate failed", couple.id, err);
    }
  }

  return { ensured, dueSoonNotified };
}

export { PERIOD_MS };
