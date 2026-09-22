"use server";

import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { messages, onboardingProfiles } from "@/db/schema";
import { createPartnerNotification } from "@/actions/notifications";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { requireCoupleVerified } from "@/lib/couple-verification";
import { appendRelationshipEvent } from "@/lib/events";
import { incrementEngagement } from "@/lib/engagement";
import { createId } from "@/lib/ids";
import { tryUnlockAchievement } from "@/lib/achievements";
import { rateLimitOrThrow } from "@/lib/security";
import { sendMessageSchema } from "@/lib/validations";
import { z } from "zod";

const getMessagesSchema = z.object({
  cursor: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(new Date(v).getTime()), {
      message: "Invalid cursor date.",
    }),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const syncSinceSchema = z.object({
  since: z
    .string()
    .refine((v) => !isNaN(new Date(v).getTime()), {
      message: "Invalid since date.",
    }),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ChatMessageDTO = {
  id: string;
  senderId: string;
  content: string | null;
  type: string;
  ephemeralMediaId: string | null;
  createdAt: string;
  read: boolean;
  deliveredAt: string | null;
  deliveryStatus: string;
  clientMsgId: string | null;
};

function toDto(m: typeof messages.$inferSelect): ChatMessageDTO {
  return {
    id: m.id,
    senderId: m.senderId,
    content: m.content,
    type: m.type,
    ephemeralMediaId: m.ephemeralMediaId,
    createdAt: m.createdAt.toISOString(),
    read: m.read,
    deliveredAt: m.deliveredAt?.toISOString() ?? null,
    deliveryStatus: m.deliveryStatus,
    clientMsgId: m.clientMsgId ?? null,
  };
}

export async function sendMessageAction(
  input: unknown,
): Promise<ActionResult<{ id: string; clientMsgId: string | null }>> {
  try {
    const parsed = sendMessageSchema.parse(input);
    const { user, couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);
    await rateLimitOrThrow({
      key: `rl:chat:${user.id}`,
      limit: 60,
      windowSeconds: 60,
      message: "Slow down — too many messages.",
    });

    if (parsed.clientMsgId) {
      const existing = await db.query.messages.findFirst({
        where: and(
          eq(messages.coupleId, couple.id),
          eq(messages.clientMsgId, parsed.clientMsgId),
        ),
      });
      if (existing) {
        return ok({ id: existing.id, clientMsgId: existing.clientMsgId });
      }
    }

    const id = createId();
    await db.insert(messages).values({
      id,
      coupleId: couple.id,
      senderId: user.id,
      type: "text",
      content: parsed.content,
      clientMsgId: parsed.clientMsgId ?? null,
      deliveryStatus: "sent",
    });

    await incrementEngagement(couple.id, "message");
    await appendRelationshipEvent({
      coupleId: couple.id,
      actorUserId: user.id,
      eventType: "message_sent",
      payload: { messageId: id },
    });
    await tryUnlockAchievement(couple.id, user.id, "first_message");

    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    const profile = await db.query.onboardingProfiles.findFirst({
      where: eq(onboardingProfiles.userId, user.id),
    });
    const senderName = profile?.name?.trim() || "Your partner";
    const preview = parsed.content
      ? parsed.content.length > 50
        ? parsed.content.slice(0, 47) + "..."
        : parsed.content
      : "Sent a message";

    if (partnerId) {
      await createPartnerNotification({
        coupleId: couple.id,
        senderUserId: user.id,
        partnerUserId: partnerId,
        title: "💬 New Message",
        body: `${senderName}: "${preview}"`,
        kind: "general",
        link: "/chat",
      }).catch(() => {});
    }

    return ok({ id, clientMsgId: parsed.clientMsgId ?? null });
  } catch (e) {
    return fail(e);
  }
}

export async function getMessagesAction(input?: {
  cursor?: string;
  limit?: number;
}): Promise<
  ActionResult<{
    messages: ChatMessageDTO[];
    nextCursor: string | null;
  }>
> {
  try {
    const parsed = getMessagesSchema.parse(input ?? {});
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);
    const limit = parsed.limit ?? 50;

    const rows = await db.query.messages.findMany({
      where: parsed.cursor
        ? and(
            eq(messages.coupleId, couple.id),
            lt(messages.createdAt, new Date(parsed.cursor)),
          )
        : eq(messages.coupleId, couple.id),
      orderBy: [desc(messages.createdAt)],
      limit: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? page[page.length - 1]?.createdAt.toISOString() ?? null
      : null;

    return ok({
      messages: page.map(toDto),
      nextCursor,
    });
  } catch (e) {
    return fail(e);
  }
}

/** Gap-fill after reconnect — paginate until empty; never drop bursts. */
export async function syncMessagesSinceAction(
  input: unknown,
): Promise<
  ActionResult<{
    messages: ChatMessageDTO[];
    nextSince: string | null;
    nextAfterId: string | null;
    hasMore: boolean;
  }>
> {
  try {
    const parsed = syncSinceSchema.parse(input);
    const { couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);
    const limit = parsed.limit ?? 100;
    const sinceDate = new Date(parsed.since);

    const rows = await db.query.messages.findMany({
      where: and(
        eq(messages.coupleId, couple.id),
        gt(messages.createdAt, sinceDate),
      ),
      orderBy: [asc(messages.createdAt), asc(messages.id)],
      limit: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return ok({
      messages: page.map(toDto),
      nextSince: last?.createdAt.toISOString() ?? null,
      nextAfterId: last?.id ?? null,
      hasMore,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function ackDeliveredAction(
  messageIds: string[],
): Promise<ActionResult<{ count: number }>> {
  try {
    const { user, couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);
    if (!messageIds.length) return ok({ count: 0 });

    const ids = messageIds.slice(0, 50);
    const now = new Date();
    const updated = await db
      .update(messages)
      .set({
        deliveryStatus: "delivered",
        deliveredAt: now,
      })
      .where(
        and(
          eq(messages.coupleId, couple.id),
          ne(messages.senderId, user.id),
          inArray(messages.id, ids),
          or(
            eq(messages.deliveryStatus, "sent"),
            isNull(messages.deliveredAt),
          ),
        ),
      )
      .returning({ id: messages.id });

    return ok({ count: updated.length });
  } catch (e) {
    return fail(e);
  }
}

export async function markMessagesReadAction(): Promise<
  ActionResult<{ count: number }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    await requireCoupleVerified(couple);
    const now = new Date();

    const updated = await db
      .update(messages)
      .set({
        read: true,
        readAt: now,
        deliveryStatus: "read",
        deliveredAt: now,
      })
      .where(
        and(
          eq(messages.coupleId, couple.id),
          eq(messages.read, false),
          ne(messages.senderId, user.id),
        ),
      )
      .returning({ id: messages.id });

    return ok({ count: updated.length });
  } catch (e) {
    return fail(e);
  }
}
