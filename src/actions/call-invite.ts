"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireVerifiedCouple } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { redis } from "@/lib/redis";
import { z } from "zod";

const CALL_TTL = 60;

function callKey(coupleId: string) {
  return `call:invite:${coupleId}`;
}

export async function ringPartnerAction(
  input: unknown,
): Promise<ActionResult<{ callId: string }>> {
  try {
    const parsed = z.object({ callId: z.string().trim().min(1).max(128) }).parse(input);
    const { user, couple } = await requireVerifiedCouple();
    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:ring:${user.id}`,
      limit: 10,
      windowSeconds: 60,
      message: "Too many call attempts. Please wait a moment.",
    });
    await redis.set(
      callKey(couple.id),
      JSON.stringify({
        callId: parsed.callId,
        fromUserId: user.id,
        at: Date.now(),
      }),
      { ex: CALL_TTL },
    );
    return ok({ callId: parsed.callId });
  } catch (e) {
    return fail(e);
  }
}

export async function getIncomingCallAction(): Promise<
  ActionResult<{
    callId: string;
    fromUserId: string;
    at: number;
  } | null>
> {
  try {
    const { user, couple } = await requireVerifiedCouple();
    const raw = await redis.get<string | Record<string, unknown>>(callKey(couple.id));
    if (!raw) return ok(null);
    const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
      callId: string;
      fromUserId: string;
      at: number;
    };
    if (parsed.fromUserId === user.id) return ok(null);
    return ok(parsed);
  } catch (e) {
    return fail(e);
  }
}

export async function clearCallInviteAction(): Promise<ActionResult<void>> {
  try {
    const { couple } = await requireVerifiedCouple();
    await redis.del(callKey(couple.id));
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function acceptCallInviteAction(
  callId: string,
): Promise<ActionResult<{ accepted: boolean }>> {
  try {
    const { user, couple } = await requireVerifiedCouple();
    const raw = await redis.get<string | Record<string, unknown>>(callKey(couple.id));
    if (!raw) {
      throw new AppError("NOT_FOUND", "Call invite expired.", 404);
    }
    const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
      callId: string;
      fromUserId?: string;
    };
    if (parsed.fromUserId && parsed.fromUserId === user.id) {
      throw new AppError("FORBIDDEN", "Cannot accept your own call invite.", 403);
    }
    if (parsed.callId !== callId) {
      throw new AppError("CONFLICT", "Stale call invite.", 409);
    }
    await redis.del(callKey(couple.id));
    return ok({ accepted: true });
  } catch (e) {
    return fail(e);
  }
}
