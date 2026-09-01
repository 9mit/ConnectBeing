"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireOnboardedUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { getRazorpay, getRazorpayPlanId, isPremiumTier } from "@/lib/razorpay";

export async function getBillingStatusAction(): Promise<
  ActionResult<{
    tier: "free" | "premium";
    status: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  }>
> {
  try {
    const user = await requireOnboardedUser();
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });

    return ok({
      tier: user.subscriptionTier,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function createPremiumSubscriptionAction(): Promise<
  ActionResult<{
    subscriptionId: string;
    keyId: string;
    planId: string;
    customerId?: string;
    email: string;
    name: string;
  }>
> {
  try {
    const user = await requireOnboardedUser();
    if (isPremiumTier(user.subscriptionTier)) {
      throw new AppError("FORBIDDEN", "You already have Premium.", 400);
    }

    const razorpay = getRazorpay();
    const planId = getRazorpayPlanId();
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId) {
      throw new AppError(
        "INTERNAL_ERROR",
        "NEXT_PUBLIC_RAZORPAY_KEY_ID is not configured.",
        500,
      );
    }

    let customerId = user.razorpayCustomerId;
    if (!customerId) {
      const customer = await razorpay.customers.create({
        email: user.email,
        notes: { userId: user.id },
      });
      customerId = customer.id;
      await db
        .update(users)
        .set({ razorpayCustomerId: customerId, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12,
      notes: { userId: user.id },
    });

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db
      .insert(subscriptions)
      .values({
        id: createId(),
        userId: user.id,
        razorpaySubscriptionId: subscription.id,
        razorpayPlanId: planId,
        tier: "free",
        status: subscription.status ?? "created",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          razorpaySubscriptionId: subscription.id,
          razorpayPlanId: planId,
          status: subscription.status ?? "created",
          updatedAt: new Date(),
        },
      });

    return ok({
      subscriptionId: subscription.id,
      keyId,
      planId,
      customerId,
      email: user.email,
      name: user.email.split("@")[0] ?? "MadLove",
    });
  } catch (e) {
    return fail(e);
  }
}

export async function cancelPremiumSubscriptionAction(): Promise<
  ActionResult<{ cancelled: boolean }>
> {
  try {
    const user = await requireOnboardedUser();
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });
    if (!sub) {
      throw new AppError("NOT_FOUND", "No subscription found.", 404);
    }

    const razorpay = getRazorpay();
    await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, true);

    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    return ok({ cancelled: true });
  } catch (e) {
    return fail(e);
  }
}
