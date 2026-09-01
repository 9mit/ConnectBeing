import Razorpay from "razorpay";

import { AppError } from "@/lib/errors";

export function getRazorpay(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Razorpay keys are not configured.",
      500,
    );
  }
  return new Razorpay({ key_id, key_secret });
}

export function getRazorpayPlanId(): string {
  const planId = process.env.RAZORPAY_PREMIUM_PLAN_ID;
  if (!planId) {
    throw new AppError(
      "INTERNAL_ERROR",
      "RAZORPAY_PREMIUM_PLAN_ID is not configured.",
      500,
    );
  }
  return planId;
}

export function isPremiumTier(
  tier: "free" | "premium" | null | undefined,
): boolean {
  return tier === "premium";
}
