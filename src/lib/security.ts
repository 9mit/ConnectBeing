import { timingSafeEqual } from "crypto";

import { redis } from "@/lib/redis";
import { AppError } from "@/lib/errors";

/** Constant-time string compare for secrets. */
export function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Sliding-window style rate limit using Redis INCR + EXPIRE.
 * Throws RATE_LIMITED when limit exceeded.
 */
export async function rateLimitOrThrow(params: {
  key: string;
  limit: number;
  windowSeconds: number;
  message?: string;
}): Promise<void> {
  const count = await redis.incr(params.key);
  if (count === 1) {
    await redis.expire(params.key, params.windowSeconds);
  }
  if (count > params.limit) {
    throw new AppError(
      "RATE_LIMITED",
      params.message ?? "Too many requests. Try again later.",
      429,
    );
  }
}

export const E2EE_PREFIX = "e2ee:v1:";

export function isE2eePayload(content: string): boolean {
  return content.startsWith(E2EE_PREFIX);
}

/** Strict couple-scoped storage object path. */
export function isValidCoupleStorageKey(
  storageKey: string,
  kind: "ephemeral" | "memories",
  coupleId: string,
): boolean {
  if (!/^[a-zA-Z0-9_-]+$/.test(coupleId)) return false;
  const pattern = new RegExp(
    `^${kind}/${coupleId}/[a-zA-Z0-9_-]+\\.(jpe?g|png|webp)$`,
    "i",
  );
  return pattern.test(storageKey);
}

/**
 * Allow only same-origin relative paths (blocks open redirects / protocol-relative URLs).
 */
export function safeInternalPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("://") || next.includes("\\") || next.includes("@")) {
    return fallback;
  }
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(next)) return fallback;
  return next;
}
