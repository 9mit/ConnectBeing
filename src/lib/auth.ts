import { cache } from "react";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { couples, users, onboardingProfiles, type Couple, type User, type OnboardingProfile } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/session";

const safeCache = typeof cache === "function" ? cache : <T extends (...args: any[]) => any>(fn: T): T => fn;

export type SessionUser = User & {
  couple: Couple | null;
  onboardingProfile?: OnboardingProfile | null;
};

export const getAuthUser = safeCache(async function getAuthUser() {
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

export const requireAuthUser = safeCache(async function requireAuthUser() {
  const authUser = await getAuthUser();
  if (!authUser) {
    throw new AppError("UNAUTHORIZED", "You must be signed in.", 401);
  }
  return authUser;
});

export const getAppUser = safeCache(async function getAppUser(): Promise<SessionUser | null> {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const targetUserId = authUser.userId;

  try {
    let row = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
      with: {
        couple: true,
        onboardingProfile: true,
      },
    });

    if (!row) {
      row = await db.query.users.findFirst({
        where: eq(users.supabaseAuthId, authUser.id),
        with: {
          couple: true,
          onboardingProfile: true,
        },
      });
    }

    if (!row && authUser.email) {
      const normalizedEmail = authUser.email.trim().toLowerCase();
      const existingByEmail = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
        with: { couple: true, onboardingProfile: true },
      });
      if (existingByEmail) {
        if (existingByEmail.supabaseAuthId !== authUser.id) {
          try {
            await db
              .update(users)
              .set({ supabaseAuthId: authUser.id, updatedAt: new Date() })
              .where(eq(users.id, existingByEmail.id));
            existingByEmail.supabaseAuthId = authUser.id;
          } catch (e) {
            console.warn("[getAppUser] Link supabaseAuthId warning:", e);
          }
        }
        row = existingByEmail;
      }
    }

    if (!row) {
      const userId = createId();
      const normalizedEmail = authUser.email ? authUser.email.trim().toLowerCase() : "";
      try {
        await db.insert(users).values({
          id: userId,
          supabaseAuthId: authUser.id,
          email: normalizedEmail,
        });
        row = await db.query.users.findFirst({
          where: eq(users.supabaseAuthId, authUser.id),
          with: { couple: true, onboardingProfile: true },
        });
      } catch (insertErr) {
        console.warn("[getAppUser] Insert fallback collision:", insertErr);
        if (normalizedEmail) {
          row = await db.query.users.findFirst({
            where: eq(users.email, normalizedEmail),
            with: { couple: true, onboardingProfile: true },
          });
        }
      }
    }

    if (!row) return null;

    return {
      ...row,
      couple: row.couple ?? null,
      onboardingProfile: row.onboardingProfile ?? null,
    };
  } catch (err) {
    console.error("[getAppUser] DB error:", err);
    return null;
  }
});

export const requireAppUser = safeCache(async function requireAppUser(): Promise<SessionUser> {
  const authUser = await requireAuthUser();
  const targetUserId = authUser.userId;

  let row;
  try {
    row = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
      with: { couple: true, onboardingProfile: true },
    });
    if (!row) {
      row = await db.query.users.findFirst({
        where: eq(users.supabaseAuthId, authUser.id),
        with: { couple: true, onboardingProfile: true },
      });
    }
    if (!row && authUser.email) {
      const normalizedEmail = authUser.email.trim().toLowerCase();
      const existingByEmail = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
        with: { couple: true, onboardingProfile: true },
      });
      if (existingByEmail) {
        if (existingByEmail.supabaseAuthId !== authUser.id) {
          try {
            await db
              .update(users)
              .set({ supabaseAuthId: authUser.id, updatedAt: new Date() })
              .where(eq(users.id, existingByEmail.id));
            existingByEmail.supabaseAuthId = authUser.id;
          } catch (e) {
            console.warn("[requireAppUser] Link supabaseAuthId warning:", e);
          }
        }
        row = existingByEmail;
      }
    }
  } catch (err) {
    console.error("[requireAppUser] DB error:", err);
    throw new AppError("INTERNAL_ERROR", "Database connection issue. Please try again.", 500);
  }

  if (!row) {
    const userId = createId();
    const normalizedEmail = authUser.email ? authUser.email.trim().toLowerCase() : "";
    try {
      await db.insert(users).values({
        id: userId,
        supabaseAuthId: authUser.id,
        email: normalizedEmail,
      });
      row = await db.query.users.findFirst({
        where: eq(users.supabaseAuthId, authUser.id),
        with: { couple: true, onboardingProfile: true },
      });
    } catch (insertErr) {
      console.warn("[requireAppUser] Insert profile fallback collision:", insertErr);
      if (normalizedEmail) {
        row = await db.query.users.findFirst({
          where: eq(users.email, normalizedEmail),
          with: { couple: true, onboardingProfile: true },
        });
      }
    }
  }

  if (!row) {
    throw new AppError(
      "UNAUTHORIZED",
      "App user profile missing. Complete registration again.",
      401,
    );
  }

  return { ...row, couple: row.couple ?? null, onboardingProfile: row.onboardingProfile ?? null };
});

export const requireOnboardedUser = safeCache(async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireAppUser();
  if (!user.isOnboarded || !user.onboardingProfile) {
    throw new AppError(
      "FORBIDDEN",
      "Complete onboarding before accessing this feature.",
      403,
    );
  }
  return user;
});

export const requireActiveCouple = safeCache(async function requireActiveCouple(): Promise<{
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

export const requireVerifiedCouple = safeCache(async function requireVerifiedCouple(): Promise<{
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
