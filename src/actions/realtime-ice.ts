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
  ActionResult<{
    iceServers: IceServer[];
    expiresAt: number;
    serverInfo?: { turnConfigured: boolean; turnUrlCount: number };
  }>
> {
  try {
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    const iceServers: IceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:global.stun.twilio.com:3478" },
    ];

    const turnUrls = [
      "turn:a.relay.metered.ca:3478",
      "turn:a.relay.metered.ca:3478?transport=tcp",
      "turn:a.relay.metered.ca:80",
      "turn:a.relay.metered.ca:443",
      "turn:a.relay.metered.ca:443?transport=tcp",
      "turns:a.relay.metered.ca:443",
      "turns:a.relay.metered.ca:5349",
      "turns:a.relay.metered.ca:443?transport=tcp",
    ];

    const openRelayUrls = [
      "turn:openrelay.metered.ca:3478",
      "turn:openrelay.metered.ca:3478?transport=tcp",
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
      "turns:openrelay.metered.ca:443",
      "turns:openrelay.metered.ca:5349",
      "turns:openrelay.metered.ca:443?transport=tcp",
    ];

    const turnSecret = process.env.TURN_SECRET;
    const turnUsername = process.env.TURN_USERNAME || process.env.NEXT_PUBLIC_TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL || process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    let turnConfigured = false;

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
      turnConfigured = true;
    } else if (turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrls,
        username: turnUsername,
        credential: turnCredential,
      });
      turnConfigured = true;
    }

    // Always supply reliable OpenRelay TURN servers with openrelayproject credentials
    // Guarantees mobile cellular (4G/5G Symmetric NAT / CGNAT) WebRTC peer traversal
    iceServers.push({
      urls: openRelayUrls,
      username: "openrelayproject",
      credential: "openrelayproject",
    });

    const turnUrlCount = iceServers.reduce((acc, s) => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return acc + urls.filter((u) => u.startsWith("turn:") || u.startsWith("turns:")).length;
    }, 0);

    return ok({
      iceServers,
      expiresAt: expiresAt * 1000,
      serverInfo: {
        turnConfigured,
        turnUrlCount,
      },
    });
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
