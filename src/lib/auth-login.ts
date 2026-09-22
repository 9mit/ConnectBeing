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
  const normalizedEmail = (input.email || "").trim().toLowerCase();
  if (!normalizedEmail && !input.supabaseAuthId) return null;

  // 1. Try to find by supabaseAuthId first
  let appUser = await db.query.users.findFirst({
    where: eq(users.supabaseAuthId, input.supabaseAuthId),
  });

  if (appUser) {
    if (normalizedEmail && appUser.email !== normalizedEmail) {
      try {
        await db
          .update(users)
          .set({ email: normalizedEmail, updatedAt: new Date() })
          .where(eq(users.id, appUser.id));
        appUser.email = normalizedEmail;
      } catch (err) {
        console.warn("[syncAppUserFromSupabase] Email update warning:", err);
      }
    }
    return appUser;
  }

  // 2. Not found by supabaseAuthId — check if user row already exists by email
  // (e.g., account re-registered in auth provider, or auth ID refreshed)
  if (normalizedEmail) {
    const existingByEmail = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (existingByEmail) {
      try {
        await db
          .update(users)
          .set({
            supabaseAuthId: input.supabaseAuthId,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail.id));

        const updated = await db.query.users.findFirst({
          where: eq(users.id, existingByEmail.id),
        });
        if (updated) return updated;
      } catch (updateErr) {
        console.error(
          "[syncAppUserFromSupabase] Failed to update supabaseAuthId on existing email:",
          updateErr,
        );
      }
    }
  }

  // 3. User does not exist by supabaseAuthId or email — insert new user
  const userId = createId();
  try {
    await db.insert(users).values({
      id: userId,
      supabaseAuthId: input.supabaseAuthId,
      email: normalizedEmail,
    });
  } catch (insertErr) {
    console.warn("[syncAppUserFromSupabase] Insert collision or constraint warning:", insertErr);
    // On collision, attempt re-linking by email or re-fetching
    if (normalizedEmail) {
      const retryByEmail = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
      });
      if (retryByEmail) {
        if (retryByEmail.supabaseAuthId !== input.supabaseAuthId) {
          try {
            await db
              .update(users)
              .set({
                supabaseAuthId: input.supabaseAuthId,
                updatedAt: new Date(),
              })
              .where(eq(users.id, retryByEmail.id));
          } catch {}
        }
        return retryByEmail;
      }
    }
  }

  // 4. Final resolution by supabaseAuthId
  appUser = await db.query.users.findFirst({
    where: eq(users.supabaseAuthId, input.supabaseAuthId),
  });

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
