import { eq } from "drizzle-orm";

import { redeemInviteToken } from "@/actions/invite";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createId } from "@/lib/ids";
import { redis } from "@/lib/redis";
import { safeInternalPath } from "@/lib/security";

export type AppUserRow = typeof users.$inferSelect;

/**
 * Ensure a MadLove users row exists for a Supabase auth user.
 * Returns null if DB is unreachable or insert fails to materialize.
 */
export async function syncAppUserFromSupabase(input: {
  supabaseAuthId: string;
  email: string;
}): Promise<AppUserRow | null> {
  let appUser = await db.query.users.findFirst({
    where: eq(users.supabaseAuthId, input.supabaseAuthId),
  });

  if (!appUser) {
    const userId = createId();
    try {
      await db.insert(users).values({
        id: userId,
        supabaseAuthId: input.supabaseAuthId,
        email: input.email,
      });
    } catch {
      // Concurrent insert — re-read below
    }
    appUser = await db.query.users.findFirst({
      where: eq(users.supabaseAuthId, input.supabaseAuthId),
    });
  }

  return appUser ?? null;
}

/** Redeem pending invite tokens after successful auth (best-effort). */
export async function redeemPendingInvites(
  appUser: AppUserRow,
  email: string,
): Promise<AppUserRow> {
  const pendingByUser = await redis.get<string>(`pending-invite:${appUser.id}`);
  const pendingByEmail = await redis.get<string>(
    `pending-invite-email:${email}`,
  );
  const inviteToken = pendingByUser ?? pendingByEmail;

  if (!inviteToken || appUser.coupleId) {
    if (pendingByEmail && !pendingByUser && !appUser.isOnboarded) {
      await redis.set(`pending-invite:${appUser.id}`, pendingByEmail, {
        ex: 60 * 60 * 24 * 3,
      });
    }
    return appUser;
  }

  try {
    const redeemed = await redeemInviteToken(inviteToken);
    if (redeemed.ok) {
      await redis.del(`pending-invite:${appUser.id}`);
      await redis.del(`pending-invite-email:${email}`);
      const refreshed = await db.query.users.findFirst({
        where: eq(users.id, appUser.id),
      });
      if (refreshed) return refreshed;
    }
  } catch {
    /* invite redeem can wait */
  }

  return appUser;
}

/** Post-login destination: onboarding → invite → dashboard (honors safe next). */
export function resolvePostLoginDestination(
  appUser: Pick<AppUserRow, "isOnboarded" | "coupleId">,
  next?: string | null,
): string {
  const safeNext = next ? safeInternalPath(next, "") || null : null;

  if (!appUser.isOnboarded) {
    if (safeNext && safeNext.startsWith("/onboarding")) return safeNext;
    return "/onboarding";
  }
  if (!appUser.coupleId) return "/invite";
  return safeNext || "/dashboard";
}

export function isNonProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production"
  );
}
