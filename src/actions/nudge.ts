"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { onboardingProfiles } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/security";

export async function sendNudgeNotificationAction(): Promise<
  ActionResult<{ senderName: string; timestamp: string }>
> {
  try {
    const { user } = await requireActiveCouple();

    await rateLimitOrThrow({
      key: `rl:nudge:${user.id}`,
      limit: 3,
      windowSeconds: 300,
      message: "You can nudge your partner up to 3 times every 5 minutes.",
    });

    const profile = await db.query.onboardingProfiles.findFirst({
      where: eq(onboardingProfiles.userId, user.id),
    });

    const senderName = profile?.name?.trim() || "Your partner";
    const timestamp = new Date().toISOString();

    return ok({ senderName, timestamp });
  } catch (e) {
    return fail(e);
  }
}
