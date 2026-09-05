import { cache } from "react";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { couples, users, type Couple, type User } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/session";

export type SessionUser = User & {
  couple: Couple | null;
};

export const getAuthUser = cache(async function getAuthUser() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = await verifyAuthToken(token);
    if (!session) return null;

    return {
      id: session.supabaseAuthId,
      email: session.email,
      userId: session.userId,
    };
  } catch {
    return null;
  }
});

export const requireAuthUser = cache(async function requireAuthUser() {
  const authUser = await getAuthUser();
  if (!authUser) {
    throw new AppError("UNAUTHORIZED", "You must be signed in.", 401);
  }
  return authUser;
});

export const getAppUser = cache(async function getAppUser(): Promise<SessionUser | null> {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const targetUserId = authUser.userId;

  try {
    let row = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
      with: {
        couple: true,
      },
    });

    if (!row) {
      row = await db.query.users.findFirst({
        where: eq(users.supabaseAuthId, authUser.id),
        with: {
          couple: true,
        },
      });
    }

    if (!row) {
      const userId = createId();
      try {
        await db.insert(users).values({
          id: userId,
          supabaseAuthId: authUser.id,
          email: authUser.email ?? "",
        });
        row = await db.query.users.findFirst({
          where: eq(users.supabaseAuthId, authUser.id),
          with: { couple: true },
        });
      } catch (insertErr) {
        console.error("[getAppUser] Insert profile fallback error:", insertErr);
      }
    }

    if (!row) return null;

    return {
      ...row,
      couple: row.couple ?? null,
    };
  } catch (err) {
    console.error("[getAppUser] DB error:", err);
    return null;
  }
});

export const requireAppUser = cache(async function requireAppUser(): Promise<SessionUser> {
  const authUser = await requireAuthUser();
  const targetUserId = authUser.userId;

  let row;
  try {
    row = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
      with: { couple: true },
    });
    if (!row) {
      row = await db.query.users.findFirst({
        where: eq(users.supabaseAuthId, authUser.id),
        with: { couple: true },
      });
    }
  } catch (err) {
    console.error("[requireAppUser] DB error:", err);
    throw new AppError("INTERNAL_ERROR", "Database connection issue. Please try again.", 500);
  }

  if (!row) {
    const userId = createId();
    try {
      await db.insert(users).values({
        id: userId,
        supabaseAuthId: authUser.id,
        email: authUser.email ?? "",
      });
      row = await db.query.users.findFirst({
        where: eq(users.supabaseAuthId, authUser.id),
        with: { couple: true },
      });
    } catch (insertErr) {
      console.error("[requireAppUser] Insert profile fallback error:", insertErr);
    }
  }

  if (!row) {
    throw new AppError(
      "UNAUTHORIZED",
      "App user profile missing. Complete registration again.",
      401,
    );
  }

  return { ...row, couple: row.couple ?? null };
});

export const requireOnboardedUser = cache(async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireAppUser();
  if (!user.isOnboarded) {
    throw new AppError(
      "FORBIDDEN",
      "Complete onboarding before accessing this feature.",
      403,
    );
  }
  return user;
});

export const requireActiveCouple = cache(async function requireActiveCouple(): Promise<{
  user: SessionUser;
  couple: Couple;
}> {
  const user = await requireOnboardedUser();

  if (!user.coupleId) {
    throw new AppError(
      "FORBIDDEN",
      "You must be linked with a partner to use this feature.",
      403,
    );
  }

  const couple =
    user.couple ??
    (await db.query.couples.findFirst({
      where: eq(couples.id, user.coupleId),
    }));

  if (!couple || couple.status !== "active") {
    throw new AppError(
      "FORBIDDEN",
      "Your couple is not active.",
      403,
    );
  }

  if (couple.userAId !== user.id && couple.userBId !== user.id) {
    throw new AppError("FORBIDDEN", "Couple membership mismatch.", 403);
  }

  return { user, couple };
});

export function isCoupleMember(couple: Couple, userId: string): boolean {
  return couple.userAId === userId || couple.userBId === userId;
}

export function redirectPathForAuthError(error: unknown): string {
  if (error instanceof AppError) {
    if (error.code === "UNAUTHORIZED") return "/login";
    if (error.code === "VERIFICATION_REQUIRED") return "/verify";
    if (
      error.code === "FORBIDDEN" &&
      error.message.toLowerCase().includes("verification")
    ) {
      return "/verify";
    }
    if (
      error.code === "FORBIDDEN" &&
      error.message.toLowerCase().includes("onboarding")
    ) {
      return "/onboarding";
    }
    if (error.code === "FORBIDDEN") return "/invite";
  }
  return "/login";
}

export async function requireActiveCoupleOrRedirect(): Promise<{
  user: SessionUser;
  couple: Couple;
}> {
  try {
    return await requireActiveCouple();
  } catch (error) {
    const { redirect } = await import("next/navigation");
    redirect(redirectPathForAuthError(error));
    throw error;
  }
}

export const requireVerifiedCouple = cache(async function requireVerifiedCouple(): Promise<{
  user: SessionUser;
  couple: Couple;
}> {
  const ctx = await requireActiveCouple();
  const { requireCoupleVerified } = await import("@/lib/couple-verification");
  await requireCoupleVerified(ctx.couple);
  return ctx;
});

export async function requireVerifiedCoupleOrRedirect(): Promise<{
  user: SessionUser;
  couple: Couple;
}> {
  const { redirect } = await import("next/navigation");
  try {
    return await requireVerifiedCouple();
  } catch (error) {
    redirect(redirectPathForAuthError(error));
    throw error;
  }
}
