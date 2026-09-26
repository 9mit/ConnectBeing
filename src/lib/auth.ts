import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";

import {
  couples,
  coupleMembers,
  users,
  onboardingProfiles,
  type Couple,
  type CoupleMember,
  type User,
  type OnboardingProfile,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/session";

const safeCache = typeof cache === "function" ? cache : <T extends (...args: any[]) => any>(fn: T): T => fn;

export type ActiveCouple = Omit<Couple, "userBId" | "status"> & {
  userBId: string;
  status: "active";
};

export type SessionUser = User & {
  couple: ActiveCouple | null;
  onboardingProfile?: OnboardingProfile | null;
  coupleMemberships?: Array<CoupleMember & { couple?: Couple | null }>;
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
        coupleMemberships: {
          where: eq(coupleMembers.status, "active"),
          with: { couple: true },
        },
      },
    });

    if (!row) {
      row = await db.query.users.findFirst({
        where: eq(users.supabaseAuthId, authUser.id),
        with: {
          couple: true,
          onboardingProfile: true,
          coupleMemberships: {
            where: eq(coupleMembers.status, "active"),
            with: { couple: true },
          },
        },
      });
    }

    if (!row && authUser.email) {
      const normalizedEmail = authUser.email.trim().toLowerCase();
      const existingByEmail = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
        with: {
          couple: true,
          onboardingProfile: true,
          coupleMemberships: {
            where: eq(coupleMembers.status, "active"),
            with: { couple: true },
          },
        },
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
          with: {
            couple: true,
            onboardingProfile: true,
            coupleMemberships: {
              where: eq(coupleMembers.status, "active"),
              with: { couple: true },
            },
          },
        });
      } catch (insertErr) {
        console.warn("[getAppUser] Insert fallback collision:", insertErr);
        if (normalizedEmail) {
          row = await db.query.users.findFirst({
            where: eq(users.email, normalizedEmail),
            with: {
              couple: true,
              onboardingProfile: true,
              coupleMemberships: {
                where: eq(coupleMembers.status, "active"),
                with: { couple: true },
              },
            },
          });
        }
      }
    }

    if (!row) return null;

    let activeCouple: ActiveCouple | null = null;
    const candidateCouple =
      row.coupleMemberships?.[0]?.couple ?? row.couple ?? null;

    if (candidateCouple && candidateCouple.status === "active" && candidateCouple.userBId) {
      activeCouple = candidateCouple as ActiveCouple;
    }

    return {
      ...row,
      couple: activeCouple,
      onboardingProfile: row.onboardingProfile ?? null,
    };
  } catch (err) {
    console.error("[getAppUser] DB error:", err);
    return null;
  }
});

export const requireAppUser = safeCache(async function requireAppUser(): Promise<SessionUser> {
  const user = await getAppUser();
  if (!user) {
    throw new AppError(
      "UNAUTHORIZED",
      "App user profile missing. Complete registration again.",
      401,
    );
  }
  return user;
});

export type OnboardingStatus =
  | "unauthenticated"
  | "needs_profile"
  | "unpaired"
  | "paired";

export interface AuthenticatedUserContext {
  user: SessionUser | null;
  profile: OnboardingProfile | null;
  activeCouple: ActiveCouple | null;
  membership: CoupleMember | null;
  partner: {
    id: string;
    profile: OnboardingProfile | null;
  } | null;
  onboardingStatus: OnboardingStatus;
}

/**
 * Authoritative single server-side couple resolver.
 * Adheres strictly to the identity invariant:
 * AUTH USER ID -> COUPLE MEMBERSHIP -> COUPLE -> PARTNER
 * Optimized for request-scoped single-pass resolution.
 */
export const getAuthenticatedUserContext = safeCache(
  async function getAuthenticatedUserContext(): Promise<AuthenticatedUserContext> {
    const authUser = await getAuthUser();
    if (!authUser) {
      return {
        user: null,
        profile: null,
        activeCouple: null,
        membership: null,
        partner: null,
        onboardingStatus: "unauthenticated",
      };
    }

    const appUser = await getAppUser();
    if (!appUser) {
      return {
        user: null,
        profile: null,
        activeCouple: null,
        membership: null,
        partner: null,
        onboardingStatus: "unauthenticated",
      };
    }

    const profile = appUser.onboardingProfile ?? null;
    const isProfileComplete = Boolean(appUser.isOnboarded && profile);

    if (!isProfileComplete) {
      return {
        user: appUser,
        profile,
        activeCouple: null,
        membership: null,
        partner: null,
        onboardingStatus: "needs_profile",
      };
    }

    // Fast-path: Check membership already populated from single-pass relational user query
    let membership: (CoupleMember & { couple?: Couple | null }) | null =
      appUser.coupleMemberships?.[0] ?? null;

    if (!membership) {
      // Query active couple membership if not already loaded
      membership = await db.query.coupleMembers.findFirst({
        where: and(
          eq(coupleMembers.userId, appUser.id),
          eq(coupleMembers.status, "active"),
        ),
        with: { couple: true },
      }) ?? null;
    }

    const coupleRow = membership?.couple ?? appUser.couple ?? null;

    if (coupleRow && coupleRow.status === "active" && coupleRow.userBId) {
      const activeCouple = coupleRow as ActiveCouple;
      const partnerId =
        coupleRow.userAId === appUser.id
          ? coupleRow.userBId
          : coupleRow.userAId;

      const partnerProfile = await db.query.onboardingProfiles.findFirst({
        where: eq(onboardingProfiles.userId, partnerId),
      });

      // Keep appUser.coupleId synchronized if mismatched
      if (appUser.coupleId !== coupleRow.id) {
        await db
          .update(users)
          .set({ coupleId: coupleRow.id, updatedAt: new Date() })
          .where(eq(users.id, appUser.id))
          .catch((e) => console.warn("[getAuthenticatedUserContext] Sync coupleId warning:", e));
        appUser.coupleId = coupleRow.id;
      }

      return {
        user: { ...appUser, couple: activeCouple },
        profile,
        activeCouple,
        membership,
        partner: {
          id: partnerId,
          profile: partnerProfile ?? null,
        },
        onboardingStatus: "paired",
      };
    }

    return {
      user: { ...appUser, couple: null },
      profile,
      activeCouple: null,
      membership: null,
      partner: null,
      onboardingStatus: "unpaired",
    };
  },
);

export const requireOnboardedUser = safeCache(async function requireOnboardedUser(): Promise<SessionUser> {
  const ctx = await getAuthenticatedUserContext();
  if (ctx.onboardingStatus === "unauthenticated" || !ctx.user) {
    throw new AppError("UNAUTHORIZED", "You must be signed in.", 401);
  }
  if (ctx.onboardingStatus === "needs_profile" || !ctx.user.isOnboarded || !ctx.profile) {
    throw new AppError(
      "FORBIDDEN",
      "Complete onboarding before accessing this feature.",
      403,
    );
  }
  return ctx.user;
});

export const requireActiveCouple = safeCache(async function requireActiveCouple(): Promise<{
  user: SessionUser;
  couple: ActiveCouple;
}> {
  const ctx = await getAuthenticatedUserContext();
  if (ctx.onboardingStatus === "unauthenticated" || !ctx.user) {
    throw new AppError("UNAUTHORIZED", "You must be signed in.", 401);
  }
  if (ctx.onboardingStatus === "needs_profile" || !ctx.user.isOnboarded) {
    throw new AppError(
      "FORBIDDEN",
      "Complete onboarding before accessing this feature.",
      403,
    );
  }
  if (ctx.onboardingStatus === "unpaired" || !ctx.activeCouple) {
    throw new AppError(
      "FORBIDDEN",
      "You must be linked with a partner to use this feature.",
      403,
    );
  }

  return { user: ctx.user, couple: ctx.activeCouple };
});

export function isCoupleMember(couple: Couple, userId: string): boolean {
  return couple.userAId === userId || (couple.userBId !== null && couple.userBId === userId);
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
  couple: ActiveCouple;
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
  couple: ActiveCouple;
}> {
  const ctx = await requireActiveCouple();
  const { requireCoupleVerified } = await import("@/lib/couple-verification");
  await requireCoupleVerified(ctx.couple);
  return ctx;
});

export async function requireVerifiedCoupleOrRedirect(): Promise<{
  user: SessionUser;
  couple: ActiveCouple;
}> {
  const { redirect } = await import("next/navigation");
  try {
    return await requireVerifiedCouple();
  } catch (error) {
    redirect(redirectPathForAuthError(error));
    throw error;
  }
}
