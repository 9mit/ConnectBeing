// Import only the JWT sign/verify subpaths — the full "jose" index pulls in
// JWE decryption (CompressionStream), which is unsupported in the Edge
// runtime and emits build warnings even though only HS256 JWS is used.
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export const AUTH_COOKIE_NAME = "madlove_auth_session";

export class SessionSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionSecretError";
  }
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

/** Presence-only check for health — never returns the secret. */
export function hasSessionSecretConfigured(): boolean {
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  return secret.length >= 32;
}

/**
 * Single HMAC key for Edge middleware + Node login API.
 * Never falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY (public) or mismatched hardcodes.
 */
function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET?.trim() ?? "";

  if (secret.length >= 32) {
    return new TextEncoder().encode(secret);
  }

  if (isProductionRuntime()) {
    throw new SessionSecretError(
      "SESSION_SECRET is missing or too short (need ≥32 characters). Set it in Vercel Environment Variables for Production/Preview so Edge middleware and the login API share the same key.",
    );
  }

  // Local/dev only — keep stable so middleware + API agree without .env.
  return new TextEncoder().encode(
    "madlove-dev-only-jwt-secret-key-32b!",
  );
}

export type AuthPayload = {
  userId: string;
  supabaseAuthId: string;
  email: string;
  exp?: number;
};

export async function createAuthToken(
  payload: Omit<AuthPayload, "exp">,
): Promise<string> {
  return await new SignJWT({
    userId: payload.userId,
    supabaseAuthId: payload.supabaseAuthId,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifyAuthToken(
  token: string,
): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      userId: String(payload.userId),
      supabaseAuthId: String(payload.supabaseAuthId),
      email: String(payload.email),
      exp: payload.exp,
    };
  } catch (error) {
    if (error instanceof SessionSecretError) {
      console.error("[session]", error.message);
    }
    return null;
  }
}
