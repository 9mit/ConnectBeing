"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { couples } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { petStateFromScore } from "@/lib/date-ist";
import { getEngagementScore } from "@/lib/engagement";
import { renamePetSchema } from "@/lib/validations";

function moodNoteForState(state: string, score: number): string {
  switch (state) {
    case "thriving":
      return "Basking in your rhythm together";
    case "happy":
      return "Wagging for another shared moment";
    case "neutral":
      return "Waiting for a check-in or quiz";
    case "sad":
      return "Misses your voices — try a call";
    case "neglected":
      return "Needs attention today";
    default:
      return `Score ${score}`;
  }
}

export async function getPetStateAction(): Promise<
  ActionResult<{
    petName: string;
    petState: string;
    score: number;
    moodNote: string;
  }>
> {
  try {
    const { couple } = await requireActiveCouple();
    const score = await getEngagementScore(couple.id);
    const liveState = petStateFromScore(score);

    if (couple.petState !== liveState) {
      await db
        .update(couples)
        .set({ petState: liveState })
        .where(eq(couples.id, couple.id));
    }

    return ok({
      petName: couple.petName,
      petState: liveState,
      score,
      moodNote: moodNoteForState(liveState, score),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function renamePetAction(
  input: unknown,
): Promise<ActionResult<{ petName: string }>> {
  try {
    const parsed = renamePetSchema.parse(input);
    const { couple } = await requireActiveCouple();

    await db
      .update(couples)
      .set({ petName: parsed.petName })
      .where(eq(couples.id, couple.id));

    return ok({ petName: parsed.petName });
  } catch (e) {
    return fail(e);
  }
}
