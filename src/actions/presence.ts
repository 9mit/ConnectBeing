"use server";

import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { redis } from "@/lib/redis";

const statusSchema = z.enum(["online", "offline", "away"]);

export type PartnerPresenceDTO = {
  partnerOnline: boolean;
  partnerStatus: "online" | "away" | "offline";
  lastSeenAt: number | null;
  myStatus: "online" | "offline";
};

/**
 * Record user presence heartbeat in Redis with a 45-second TTL.
 */
export async function recordHeartbeatAction(
  status: "online" | "offline" = "online",
): Promise<ActionResult<{ recorded: true }>> {
  try {
    const { user, couple } = await requireActiveCouple();
    const parsed = statusSchema.parse(status);

    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:heartbeat:${user.id}`,
      limit: 60,
      windowSeconds: 60,
      message: "Too many heartbeats.",
    });

    const key = `presence:user:${user.id}`;
    const coupleKey = `presence:couple:${couple.id}:${user.id}`;

    if (parsed === "offline") {
      await redis.del(key);
      await redis.set(coupleKey, JSON.stringify({ status: "offline", at: Date.now() }), {
        ex: 300,
      });
    } else {
      const data = JSON.stringify({ status: parsed, at: Date.now() });
      await redis.set(key, data, { ex: 50 });
      await redis.set(coupleKey, data, { ex: 300 });
    }

    return ok({ recorded: true });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Query partner's live presence state (Redis fallback for rock-solid accuracy).
 */
export async function getPartnerPresenceAction(): Promise<
  ActionResult<PartnerPresenceDTO>
> {
  try {
    const { user, couple } = await requireActiveCouple();

    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    // Check my current set status
    const myRaw = await redis.get<string>(`presence:couple:${couple.id}:${user.id}`);
    let myStatus: "online" | "offline" = "online";
    if (myRaw) {
      try {
        const parsedMy = typeof myRaw === "string" ? JSON.parse(myRaw) : myRaw;
        if (parsedMy?.status === "offline") myStatus = "offline";
      } catch {
        /* ignore */
      }
    }

    // Check partner live heartbeat
    const partnerLive = await redis.get<string>(`presence:user:${partnerId}`);
    const partnerCouple = await redis.get<string>(
      `presence:couple:${couple.id}:${partnerId}`,
    );

    let partnerOnline = false;
    let partnerStatus: "online" | "away" | "offline" = "offline";
    let lastSeenAt: number | null = null;

    if (partnerLive) {
      try {
        const parsed = typeof partnerLive === "string" ? JSON.parse(partnerLive) : partnerLive;
        if (parsed?.status === "online") {
          partnerOnline = true;
          partnerStatus = "online";
          lastSeenAt = parsed.at || Date.now();
        }
      } catch {
        partnerOnline = true;
        partnerStatus = "online";
      }
    } else if (partnerCouple) {
      try {
        const parsed = typeof partnerCouple === "string" ? JSON.parse(partnerCouple) : partnerCouple;
        partnerStatus = parsed?.status === "online" ? "away" : "offline";
        lastSeenAt = parsed?.at || null;
      } catch {
        partnerStatus = "offline";
      }
    }

    return ok({
      partnerOnline,
      partnerStatus,
      lastSeenAt,
      myStatus,
    });
  } catch (e) {
    return fail(e);
  }
}
