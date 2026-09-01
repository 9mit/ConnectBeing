import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils";

import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { createId } from "@/lib/ids";

export const runtime = "nodejs";

type SubEntity = {
  id: string;
  plan_id: string;
  status: string;
  current_start?: number;
  current_end?: number;
  notes?: Record<string, string>;
};

type RazorpayWebhook = {
  event: string;
  payload: {
    subscription?: { entity: SubEntity };
    payment?: {
      entity: { id: string; status: string; notes?: Record<string, string> };
    };
  };
};

async function upsertPremium(sub: SubEntity, userId: string) {
  const periodStart = sub.current_start
    ? new Date(sub.current_start * 1000)
    : new Date();
  const periodEnd = sub.current_end
    ? new Date(sub.current_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const active =
    sub.status === "active" ||
    sub.status === "authenticated" ||
    sub.status === "charged";

  await db
    .insert(subscriptions)
    .values({
      id: createId(),
      userId,
      razorpaySubscriptionId: sub.id,
      razorpayPlanId: sub.plan_id,
      tier: active ? "premium" : "free",
      status: sub.status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        razorpaySubscriptionId: sub.id,
        razorpayPlanId: sub.plan_id,
        tier: active ? "premium" : "free",
        status: sub.status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        updatedAt: new Date(),
      },
    });

  await db
    .update(users)
    .set({
      subscriptionTier: active ? "premium" : "free",
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    validateWebhookSignature(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const body = JSON.parse(rawBody) as RazorpayWebhook;
  const sub = body.payload.subscription?.entity;
  const userId =
    sub?.notes?.userId ?? body.payload.payment?.entity.notes?.userId;

  if (!sub || !userId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const existingSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.razorpaySubscriptionId, sub.id),
  });
  if (existingSub && existingSub.userId !== userId) {
    return NextResponse.json({ error: "Subscription user mismatch" }, { status: 400 });
  }

  switch (body.event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.pending":
      await upsertPremium(sub, userId);
      break;
    case "subscription.cancelled":
    case "payment.failed":
      await db
        .update(subscriptions)
        .set({
          tier: "free",
          status: sub.status,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.razorpaySubscriptionId, sub.id));
      await db
        .update(users)
        .set({ subscriptionTier: "free", updatedAt: new Date() })
        .where(eq(users.id, userId));
      break;
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
