"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { onboardingProfiles, users } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { redis } from "@/lib/redis";
import { onboardingSchema } from "@/lib/validations";
import { getPendingInviteCookie } from "@/lib/invite-cookie";

export async function completeOnboardingAction(
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const parsed = onboardingSchema.parse(input);
    const user = await requireAppUser();

    if (user.isOnboarded) {
      throw new AppError("FORBIDDEN", "Onboarding already completed.", 400);
    }

    const existing = await db.query.onboardingProfiles.findFirst({
      where: eq(onboardingProfiles.userId, user.id),
    });

    if (existing) {
      throw new AppError("FORBIDDEN", "Onboarding profile already exists.", 400);
    }


    await db.transaction(async (tx) => {
      await tx.insert(onboardingProfiles).values({
        id: createId(),
        userId: user.id,
        name: parsed.name,
        age: parsed.age,
        gender: parsed.gender,
        countryCode: parsed.countryCode,
        hobbies: parsed.hobbies,
        selfDescription: parsed.selfDescription,
        partnerExpectation: parsed.partnerExpectation,
        loveLanguages: parsed.loveLanguages,
      });

      await tx
        .update(users)
        .set({ isOnboarded: true, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    });

    // Check for pending invite context
    const cookieInvite = getPendingInviteCookie();
    const redisByUser = await redis.get<string>(`pending-invite:${user.id}`);
    const pendingToken = cookieInvite || redisByUser;

    if (pendingToken && !user.coupleId) {
      return ok({ redirectTo: `/invite/${encodeURIComponent(pendingToken)}` });
    }

    const refreshedUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (refreshedUser?.coupleId || user.coupleId) {
      return ok({ redirectTo: "/dashboard" });
    }

    return ok({ redirectTo: "/onboarding/decision" });
  } catch (e) {
    return fail(e);
  }
}
