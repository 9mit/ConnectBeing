"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { challenges } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import {
  bumpChallengeProgress,
  ensureDefaultChallenges,
} from "@/lib/challenges";

export async function ensureDefaultChallengesAction(): Promise<
  ActionResult<{ ensured: boolean }>
> {
  try {
    const { couple } = await requireActiveCouple();
    await ensureDefaultChallenges(couple.id);
    return ok({ ensured: true });
  } catch (e) {
    return fail(e);
  }
}

export async function listChallengesAction(): Promise<
  ActionResult<{
    challenges: Array<{
      id: string;
      code: string;
      title: string;
      description: string;
      status: string;
      progress: number;
      goal: number;
    }>;
  }>
> {
  try {
    const { couple } = await requireActiveCouple();
    await ensureDefaultChallenges(couple.id);
    const rows = await db.query.challenges.findMany({
      where: eq(challenges.coupleId, couple.id),
    });
    return ok({
      challenges: rows.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        description: c.description,
        status: c.status,
        progress: c.progress,
        goal: c.goal,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

/** Manual bump kept for edge cases; rituals auto-bump via lib/challenges. */
export async function bumpChallengeProgressAction(
  code: string,
  amount = 1,
): Promise<ActionResult<{ completed: boolean }>> {
  try {
    const { user, couple } = await requireActiveCouple();
    const result = await bumpChallengeProgress({
      coupleId: couple.id,
      actorUserId: user.id,
      code,
      amount,
    });
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
