import { createHash, randomBytes } from "crypto";

/**
 * Invite token contract (Phase 2+):
 * 1. generateInviteToken() → raw 32-byte hex for the shareable URL only
 * 2. hashInviteToken(raw) → SHA-256 hex stored in Postgres + Redis
 * 3. Redis key: invite:{hash} → userId, NX EX 259200 (72h)
 * 4. Never persist the raw token
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== "string") {
    throw new Error("INVITE_TOKEN_INVALID: raw token must be a non-empty string");
  }

  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function inviteRedisKey(tokenHash: string): string {
  return `invite:${tokenHash}`;
}

/** 72 hours in seconds — Redis TTL and DB expiry should match. */
export const INVITE_TOKEN_TTL_SECONDS = 72 * 60 * 60;
