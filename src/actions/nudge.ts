"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { inAppNotifications, onboardingProfiles } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { createId } from "@/lib/ids";
import { redis } from "@/lib/redis";
import { rateLimitOrThrow } from "@/lib/security";

export async function sendNudgeNotificationAction(): Promise<
  ActionResult<{ senderName: string; timestamp: string; partnerId: string }>
> {
  try {
    const { user, couple } = await requireActiveCouple();

    await rateLimitOrThrow({
      key: `rl:nudge:${user.id}`,
      limit: 5,
      windowSeconds: 300,
      message: "You can ping your partner up to 5 times every 5 minutes.",
    });

    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    const profile = await db.query.onboardingProfiles.findFirst({
      where: eq(onboardingProfiles.userId, user.id),
    });

    const senderName = profile?.name?.trim() || "Your partner";
    const timestamp = new Date().toISOString();

    // 1. Insert In-App Notification in database so it shows on /notifications and in the bell hub
    await db.insert(inAppNotifications).values({
      id: createId(),
      coupleId: couple.id,
      userId: partnerId,
      title: "🔔 Partner Nudge",
      body: `${senderName} pinged you to connect! Thinking of you ❤️`,
      kind: "nudge",
      link: "/dashboard",
      read: false,
    });

    // 2. Set Redis key for immediate reactive polling fallback
    await redis.set(
      `partner-nudge:${partnerId}`,
      JSON.stringify({ senderName, timestamp, senderId: user.id }),
      { ex: 300 },
    );

    return ok({ senderName, timestamp, partnerId });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Check if the current user has received a pending nudge
 */
export async function checkPendingNudgeAction(): Promise<
  ActionResult<{ hasNudge: boolean; senderName?: string; timestamp?: string }>
> {
  try {
    const { user } = await requireActiveCouple();
    const raw = await redis.get<string>(`partner-nudge:${user.id}`);
    if (!raw) {
      return ok({ hasNudge: false });
    }

    // Clear after reading
    await redis.del(`partner-nudge:${user.id}`);

    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return ok({
        hasNudge: true,
        senderName: parsed.senderName || "Your partner",
        timestamp: parsed.timestamp || new Date().toISOString(),
      });
    } catch {
      return ok({ hasNudge: true, senderName: "Your partner" });
    }
  } catch (e) {
    return fail(e);
  }
}
