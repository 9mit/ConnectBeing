"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { inAppNotifications } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/security";
import { createPartnerNotification } from "@/lib/notifications";

import { redis } from "@/lib/redis";

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

export async function getUnreadNotificationsCountAction(): Promise<
  ActionResult<{ unreadCount: number }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    const rows = await db.query.inAppNotifications.findMany({
      where: and(
        eq(inAppNotifications.coupleId, couple.id),
        eq(inAppNotifications.userId, user.id),
        eq(inAppNotifications.read, false),
      ),
      columns: { id: true },
    });
    return ok({ unreadCount: rows.length });
  } catch (e) {
    return fail(e);
  }
}

export async function pollPendingNotificationsAction(): Promise<
  ActionResult<{
    notifications: Array<{
      id: string;
      title: string;
      body: string;
      kind?: string;
      link?: string | null;
      timestamp: string;
    }>;
  }>
> {
  try {
    const { user } = await requireActiveCouple();
    const key = `pending-notifs:${user.id}`;
    const raw = await redis.lrange(key, 0, -1);
    if (raw && raw.length > 0) {
      await redis.del(key);
      const parsed = raw
        .map((item) => {
          try {
            return typeof item === "string" ? JSON.parse(item) : item;
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      return ok({ notifications: parsed });
    }
    return ok({ notifications: [] });
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

    await rateLimitOrThrow({
      key: `rl:notify:${user.id}`,
      limit: 20,
      windowSeconds: 60,
      message: "Slow down — too many notifications sent.",
    });

    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    const id = await createPartnerNotification({
      coupleId: couple.id,
      senderUserId: user.id,
      partnerUserId: partnerId,
      title: parsed.title,
      body: parsed.body,
      kind: parsed.kind,
      link: parsed.link ?? null,
    });

    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
