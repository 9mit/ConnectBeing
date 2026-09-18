"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { requireCoupleVerified } from "@/lib/couple-verification";
import { AppError } from "@/lib/errors";
import { createHmac, randomBytes } from "crypto";

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/**
 * Issue short-lived TURN credentials for WebRTC.
 * Prefer TURN_SECRET (time-limited HMAC) when set; otherwise mint a one-hour
 * session token derived from server TURN_* secrets (never NEXT_PUBLIC_*).
 */
export async function getTurnCredentialsAction(): Promise<
  ActionResult<{ iceServers: IceServer[]; expiresAt: number }>
> {
  try {
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    const iceServers: IceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
    ];

    const turnUrls = [
      "turn:a.relay.metered.ca:80",
      "turn:a.relay.metered.ca:443",
      "turn:a.relay.metered.ca:443?transport=tcp",
    ];

    const turnSecret = process.env.TURN_SECRET;
    const turnUsername = process.env.TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL;

    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;

    if (turnSecret) {
      const username = `${expiresAt}:${randomBytes(4).toString("hex")}`;
      const credential = createHmac("sha1", turnSecret)
        .update(username)
        .digest("base64");
      iceServers.push({
        urls: turnUrls,
        username,
        credential,
      });
    } else if (turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrls,
        username: turnUsername,
        credential: turnCredential,
      });
    } else if (process.env.NODE_ENV === "production") {
      throw new AppError(
        "INTERNAL_ERROR",
        "TURN credentials (TURN_SECRET or TURN_USERNAME/TURN_CREDENTIAL) are required in production for reliable calls.",
        503,
      );
    }

    return ok({ iceServers, expiresAt: expiresAt * 1000 });
  } catch (e) {
    return fail(e);
  }
}

export async function requirePublicSupabaseEnv(): Promise<{
  url: string;
  anonKey: string;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Supabase public environment is not configured.",
      503,
    );
  }
  return { url, anonKey };
}
