"use server";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { reminders } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { createId } from "@/lib/ids";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  dueAt: z.string().datetime(),
});

export async function listRemindersAction(): Promise<
  ActionResult<{
    reminders: Array<{
      id: string;
      title: string;
      dueAt: string;
      completed: boolean;
    }>;
  }>
> {
  try {
    const { couple } = await requireActiveCouple();
    const rows = await db.query.reminders.findMany({
      where: eq(reminders.coupleId, couple.id),
      orderBy: [asc(reminders.dueAt)],
      limit: 50,
    });
    return ok({
      reminders: rows.map((r) => ({
        id: r.id,
        title: r.title,
        dueAt: r.dueAt.toISOString(),
        completed: r.completed,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function createReminderAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createSchema.parse(input);
    const { user, couple } = await requireActiveCouple();
    const id = createId();
    await db.insert(reminders).values({
      id,
      coupleId: couple.id,
      createdById: user.id,
      title: parsed.title,
      dueAt: new Date(parsed.dueAt),
    });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function completeReminderAction(
  input: unknown,
): Promise<ActionResult<{ completed: boolean }>> {
  try {
    const parsed = z.object({ id: z.string().min(1) }).parse(input);
    const { couple } = await requireActiveCouple();
    await db
      .update(reminders)
      .set({ completed: true })
      .where(
        and(eq(reminders.id, parsed.id), eq(reminders.coupleId, couple.id)),
      );
    return ok({ completed: true });
  } catch (e) {
    return fail(e);
  }
}
