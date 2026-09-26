import { db } from "@/db";
import { inAppNotifications } from "@/db/schema";
import { createId } from "@/lib/ids";
import { redis } from "@/lib/redis";

/**
 * Universal server helper to create a partner notification, persist in DB,
 * queue in Redis for polling, and broadcast in real-time over Supabase channel.
 *
 * NOTE: This is a server library function (NOT a 'use server' action).
 * It cannot be invoked directly by external clients via Next.js RPC.
 */
export async function createPartnerNotification({
  coupleId,
  senderUserId,
  partnerUserId,
  title,
  body,
  kind = "general",
  link,
}: {
  coupleId: string;
  senderUserId: string;
  partnerUserId: string;
  title: string;
  body: string;
  kind?: string;
  link?: string | null;
}): Promise<string> {
  const id = createId();

  // 1. Insert into database
  await db.insert(inAppNotifications).values({
    id,
    coupleId,
    userId: partnerUserId,
    title,
    body,
    kind,
    link: link ?? null,
    read: false,
  });

  const payload = {
    id,
    recipientId: partnerUserId,
    senderId: senderUserId,
    title,
    body,
    kind,
    link: link ?? null,
    timestamp: new Date().toISOString(),
  };

  // 2. Queue in Redis for immediate polling fallback
  try {
    await redis.lpush(`pending-notifs:${partnerUserId}`, JSON.stringify(payload));
    await redis.expire(`pending-notifs:${partnerUserId}`, 3600);
  } catch {
    /* Redis fallback error ignored */
  }

  // 3. Send Supabase Realtime HTTP broadcast
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceRoleKey) {
      void fetch(`${url}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              topic: `couple:${coupleId}:presence`,
              event: "notification",
              payload,
            },
          ],
        }),
      }).catch(() => {});
    }
  } catch {
    /* Non-blocking broadcast error */
  }

  return id;
}
