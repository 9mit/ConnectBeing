"use server";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { requireCoupleVerified } from "@/lib/couple-verification";
import { createId } from "@/lib/ids";
import { AppError } from "@/lib/errors";

const createCalendarEventSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().max(500).optional(),
  eventDate: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), {
      message: "Please provide a valid date.",
    }),
  category: z.enum(["date_night", "anniversary", "ritual", "custom"]).default("date_night"),
  reminderHours: z.number().int().min(0).max(168).default(24),
});

export type CalendarEventDTO = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  category: string;
  reminderHours: number;
  completed: boolean;
  createdById: string;
  createdAt: string;
};

export async function listCalendarEventsAction(): Promise<
  ActionResult<{ events: CalendarEventDTO[] }>
> {
  try {
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    const rows = await db.query.calendarEvents.findMany({
      where: eq(calendarEvents.coupleId, couple.id),
      orderBy: [asc(calendarEvents.eventDate)],
    });

    return ok({
      events: rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        eventDate: r.eventDate.toISOString(),
        category: r.category,
        reminderHours: r.reminderHours,
        completed: r.completed,
        createdById: r.createdById,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function createCalendarEventAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createCalendarEventSchema.parse(input);
    const { user, couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:calendar:${user.id}`,
      limit: 20,
      windowSeconds: 60,
      message: "Too many calendar requests. Please slow down.",
    });

    const id = createId();
    await db.insert(calendarEvents).values({
      id,
      coupleId: couple.id,
      createdById: user.id,
      title: parsed.title,
      description: parsed.description ?? null,
      eventDate: new Date(parsed.eventDate),
      category: parsed.category,
      reminderHours: parsed.reminderHours,
      completed: false,
    });

    const { appendRelationshipEvent } = await import("@/lib/events");
    await appendRelationshipEvent({
      coupleId: couple.id,
      actorUserId: user.id,
      eventType: "memory_added",
      payload: { eventTitle: parsed.title, eventCategory: parsed.category },
    });

    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCalendarEventAction(
  eventId: string,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    const deleted = await db
      .delete(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, eventId),
          eq(calendarEvents.coupleId, couple.id),
        ),
      )
      .returning({ id: calendarEvents.id });

    if (!deleted.length) {
      throw new AppError("NOT_FOUND", "Calendar event not found.", 404);
    }

    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}

export async function toggleCalendarEventAction(
  eventId: string,
): Promise<ActionResult<{ completed: boolean }>> {
  try {
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);

    const existing = await db.query.calendarEvents.findFirst({
      where: and(
        eq(calendarEvents.id, eventId),
        eq(calendarEvents.coupleId, couple.id),
      ),
    });

    if (!existing) {
      throw new AppError("NOT_FOUND", "Calendar event not found.", 404);
    }

    const nextCompleted = !existing.completed;
    await db
      .update(calendarEvents)
      .set({ completed: nextCompleted })
      .where(eq(calendarEvents.id, eventId));

    return ok({ completed: nextCompleted });
  } catch (e) {
    return fail(e);
  }
}
