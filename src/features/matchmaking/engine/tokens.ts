import { createHmac, timingSafeEqual } from "crypto";
import { AppError } from "@/lib/errors";
import { isProductionRuntime } from "@/lib/runtime";

function getTokenSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (isProductionRuntime() || process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new AppError(
      "INTERNAL_ERROR",
      "SESSION_SECRET is misconfigured in deployed environment.",
      500,
    );
  }
  return "madlove-matchmaking-secret-key-32b!";
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate an opaque, tamper-proof candidate token.
 * Hides raw user IDs from the browser and binds the candidate to the viewer.
 */
export function generateCandidateToken(targetUserId: string, viewerUserId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({ u: targetUserId, v: viewerUserId, exp: expiresAt }),
  ).toString("base64url");
  const sig = createHmac("sha256", getTokenSecret())
    .update(`${payload}:${viewerUserId}`)
    .digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Validates and resolves candidate token to the underlying user ID.
 * Throws 403 if forged, expired, or used by a different user.
 */
export function resolveCandidateId(tokenOrId: string, viewerUserId: string): string {
  if (!tokenOrId.includes(".")) {
    if (isProductionRuntime() || process.env.NODE_ENV === "production" || process.env.VERCEL) {
      throw new AppError("FORBIDDEN", "Direct candidate IDs are not accepted in production.", 403);
    }
    // Direct ID fallback (for local development or automated test fixtures only)
    return tokenOrId;
  }

  const parts = tokenOrId.split(".");
  if (parts.length !== 2) {
    throw new AppError("VALIDATION_ERROR", "Invalid candidate token format.", 400);
  }

  const [payloadB64, sig] = parts;
  const expectedSig = createHmac("sha256", getTokenSecret())
    .update(`${payloadB64}:${viewerUserId}`)
    .digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("FORBIDDEN", "Invalid or forged candidate token.", 403);
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (parsed.v !== viewerUserId) {
      throw new AppError("FORBIDDEN", "Candidate token was not issued for this user.", 403);
    }
    if (Date.now() > parsed.exp) {
      throw new AppError("FORBIDDEN", "Candidate profile has expired. Please refresh.", 403);
    }
    return parsed.u as string;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("VALIDATION_ERROR", "Malformed candidate token.", 400);
  }
}
