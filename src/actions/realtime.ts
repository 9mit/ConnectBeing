"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { requireCoupleVerified } from "@/lib/couple-verification";
import { incrementEngagement } from "@/lib/engagement";
import { appendRelationshipEvent } from "@/lib/events";
import { z } from "zod";

const audioSchema = z.object({
  minutes: z.number().int().min(1).max(120),
});

const locationSchema = z.object({
  minutes: z.number().int().min(1).max(60),
});

export async function recordAudioMinutesAction(
  input: unknown,
): Promise<ActionResult<{ score: number }>> {
  try {
    const parsed = audioSchema.parse(input);
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);
    const score = await incrementEngagement(
      couple.id,
      "audio_minute",
      parsed.minutes,
    );
    return ok({ score });
  } catch (e) {
    return fail(e);
  }
}

export async function recordLocationMinutesAction(
  input: unknown,
): Promise<ActionResult<{ score: number }>> {
  try {
    const parsed = locationSchema.parse(input);
    const { couple } = await requireActiveCouple();
    const score = await incrementEngagement(
      couple.id,
      "location_minute",
      parsed.minutes,
    );
    return ok({ score });
  } catch (e) {
    return fail(e);
  }
}

const callEventSchema = z.object({
  kind: z.enum(["started", "ended"]),
});

export async function recordCallEventAction(
  input: unknown,
): Promise<ActionResult<{ recorded: boolean }>> {
  try {
    const parsed = callEventSchema.parse(input);
    const { user, couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);
    await appendRelationshipEvent({
      coupleId: couple.id,
      actorUserId: user.id,
      eventType: parsed.kind === "started" ? "call_started" : "call_ended",
    });
    return ok({ recorded: true });
  } catch (e) {
    return fail(e);
  }
}

export async function getRealtimeContextAction(): Promise<
  ActionResult<{
    coupleId: string;
    userId: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
  }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase public env missing");
    }
    return ok({
      coupleId: couple.id,
      userId: user.id,
      supabaseUrl,
      supabaseAnonKey,
    });
  } catch (e) {
    return fail(e);
  }
}
