"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { inAppNotifications } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { createId } from "@/lib/ids";

const createNotificationSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(300),
  kind: z
    .enum(["nudge", "quiz", "watch", "achievement", "verification", "general"])
    .default("general"),
  link: z.string().max(200).optional(),
});

export type InAppNotificationDTO = {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export async function listNotificationsAction(): Promise<
  ActionResult<{ notifications: InAppNotificationDTO[]; unreadCount: number }>
> {
  try {
    const { user, couple } = await requireActiveCouple();

    const rows = await db.query.inAppNotifications.findMany({
      where: and(
        eq(inAppNotifications.coupleId, couple.id),
        eq(inAppNotifications.userId, user.id),
      ),
      orderBy: [desc(inAppNotifications.createdAt)],
      limit: 30,
    });

    const unreadCount = rows.filter((r) => !r.read).length;

    return ok({
      notifications: rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        kind: r.kind,
        link: r.link,
        read: r.read,
        createdAt: r.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function markNotificationReadAction(
  notificationId?: string,
): Promise<ActionResult<{ success: true }>> {
  try {
    const { user, couple } = await requireActiveCouple();

    if (notificationId) {
      await db
        .update(inAppNotifications)
        .set({ read: true })
        .where(
          and(
            eq(inAppNotifications.id, notificationId),
            eq(inAppNotifications.userId, user.id),
            eq(inAppNotifications.coupleId, couple.id),
          ),
        );
    } else {
      // Mark all as read
      await db
        .update(inAppNotifications)
        .set({ read: true })
        .where(
          and(
            eq(inAppNotifications.userId, user.id),
            eq(inAppNotifications.coupleId, couple.id),
            eq(inAppNotifications.read, false),
          ),
        );
    }

    return ok({ success: true });
  } catch (e) {
    return fail(e);
  }
}

export async function sendNotificationToPartnerAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createNotificationSchema.parse(input);
    const { user, couple } = await requireActiveCouple();

    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:notify:${user.id}`,
      limit: 20,
      windowSeconds: 60,
      message: "Slow down — too many notifications sent.",
    });

    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    const id = createId();
    await db.insert(inAppNotifications).values({
      id,
      coupleId: couple.id,
      userId: partnerId,
      title: parsed.title,
      body: parsed.body,
      kind: parsed.kind,
      link: parsed.link ?? null,
      read: false,
    });

    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
