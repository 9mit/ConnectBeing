"use server";

import { and, eq, gt, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { couples, inAppNotifications, inviteTokens, onboardingProfiles, users } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireAppUser, requireOnboardedUser } from "@/lib/auth";
import {
  generateInviteToken,
  hashInviteToken,
  inviteRedisKey,
  INVITE_TOKEN_TTL_SECONDS,
} from "@/lib/crypto/invite-token";
import { AppError } from "@/lib/errors";
import { getAppUrl } from "@/lib/app-url";
import { createId } from "@/lib/ids";
import {
  acceptInviteAndJoinCouple,
  getOrCreatePendingCoupleForUser,
} from "@/lib/couples";
import { clearPendingInviteCookie } from "@/lib/invite-cookie";
import { redis } from "@/lib/redis";
import { rateLimitOrThrow } from "@/lib/security";
import { BRAND } from "@/lib/brand";

export async function generateInviteLinkAction(): Promise<
  ActionResult<{ url: string; expiresAt: string }>
> {
  try {
    const user = await requireOnboardedUser();
    await rateLimitOrThrow({
      key: `rl:invite:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 60,
    });

    if (user.coupleId && user.couple?.status === "active") {
      throw new AppError(
        "FORBIDDEN",
        "You are already linked with a partner.",
        403,
      );
    }

    // Ensure user has an initialized pending couple record
    const coupleId = await getOrCreatePendingCoupleForUser(user.id);

    // Revoke any previous active/pending tokens for this user/couple
    const active = await db.query.inviteTokens.findMany({
      where: and(
        eq(inviteTokens.inviterId, user.id),
        eq(inviteTokens.status, "pending"),
      ),
    });

    if (active.length > 0) {
      const activeIds = active.map((t) => t.id);
      await db
        .update(inviteTokens)
        .set({ status: "revoked", used: true })
        .where(inArray(inviteTokens.id, activeIds));
      await Promise.all(
        active.map((t) => redis.del(inviteRedisKey(t.tokenHash))),
      );
      await redis.del(`active-invite-url:${user.id}`);
      await redis.del(`invite-opened:${user.id}`);
    }

    const raw = generateInviteToken();
    const tokenHash = hashInviteToken(raw);
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_SECONDS * 1000);

    await db.insert(inviteTokens).values({
      id: createId(),
      tokenHash,
      coupleId,
      inviterId: user.id,
      status: "pending",
      expiresAt,
    });

    await redis.set(inviteRedisKey(tokenHash), user.id, {
      nx: true,
      ex: INVITE_TOKEN_TTL_SECONDS,
    });

    const base = getAppUrl();
    const url = `${base}/invite/${raw}`;

    // Cache active invite URL so it survives page reloads
    await redis.set(`active-invite-url:${user.id}`, url, {
      ex: INVITE_TOKEN_TTL_SECONDS,
    });

    return ok({
      url,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function getActiveInviteAction(): Promise<
  ActionResult<{ url: string | null; hasOpened?: boolean }>
> {
  try {
    const user = await requireOnboardedUser();

    // If user is already connected in an active couple, no pending invite needed
    if (user.couple && user.couple.status === "active") {
      return ok({ url: null, hasOpened: false });
    }

    // Check if an active, non-expired pending invite exists in DB
    const activeToken = await db.query.inviteTokens.findFirst({
      where: and(
        eq(inviteTokens.inviterId, user.id),
        eq(inviteTokens.status, "pending"),
        gt(inviteTokens.expiresAt, new Date()),
      ),
    });

    if (!activeToken) {
      await redis.del(`active-invite-url:${user.id}`);
      await redis.del(`invite-opened:${user.id}`);
      return ok({ url: null, hasOpened: false });
    }

    const cachedUrl = await redis.get<string>(`active-invite-url:${user.id}`);
    const hasOpened = !!(await redis.get<string>(`invite-opened:${user.id}`));

    return ok({
      url: cachedUrl || null,
      hasOpened,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function acceptCoupleInviteAction(
  rawToken: string,
): Promise<
  ActionResult<{
    redirectTo: string;
    coupleId: string;
    partnerName: string;
  }>
> {
  try {
    const user = await requireAppUser();
    await rateLimitOrThrow({
      key: `rl:accept-invite:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 15,
      message: "Too many invite attempts. Try again later.",
    });

    if (!user.isOnboarded || !user.onboardingProfile) {
      throw new AppError(
        "FORBIDDEN",
        "Please complete your profile before accepting the invitation.",
        403,
      );
    }

    const { coupleId, partnerName } = await acceptInviteAndJoinCouple({
      rawToken,
      acceptingUserId: user.id,
    });

    clearPendingInviteCookie();

    return ok({
      redirectTo: "/dashboard",
      coupleId,
      partnerName,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function redeemInviteToken(
  rawToken: string,
): Promise<ActionResult<{ coupleId: string }>> {
  try {
    const user = await requireAppUser();
    await rateLimitOrThrow({
      key: `rl:redeem-invite:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 15,
      message: "Too many invite redemption attempts. Try again later.",
    });
    const result = await acceptInviteAndJoinCouple({
      rawToken,
      acceptingUserId: user.id,
    });
    return ok({ coupleId: result.coupleId });
  } catch (e) {
    return fail(e);
  }
}

export async function checkPartnerJoinedAction(): Promise<
  ActionResult<{
    hasJoined: boolean;
    hasOpened?: boolean;
    partnerName?: string;
    coupleId?: string;
  }>
> {
  try {
    const user = await requireAppUser();

    // 1. Authoritative check: Is the couple status active and userBId populated?
    if (user.coupleId) {
      const couple = await db.query.couples.findFirst({
        where: and(
          eq(couples.id, user.coupleId),
          eq(couples.status, "active"),
        ),
      });

      if (couple && couple.userBId) {
        const partnerId =
          couple.userAId === user.id ? couple.userBId : couple.userAId;
        const partner = await db.query.users.findFirst({
          where: eq(users.id, partnerId),
          with: { onboardingProfile: true },
        });
        const partnerName =
          partner?.onboardingProfile?.name?.trim() || "Your partner";

        return ok({
          hasJoined: true,
          hasOpened: true,
          partnerName,
          coupleId: couple.id,
        });
      }
    }

    // 2. Check Redis signal for partner join event (verified against DB)
    const raw = await redis.get<string>(`partner-joined:${user.id}`);
    if (raw) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed.coupleId) {
          const couple = await db.query.couples.findFirst({
            where: and(
              eq(couples.id, parsed.coupleId),
              eq(couples.status, "active"),
            ),
          });
          if (couple && couple.userBId) {
            return ok({
              hasJoined: true,
              hasOpened: true,
              partnerName: parsed.partnerName || "Your partner",
              coupleId: parsed.coupleId,
            });
          }
        }
      } catch {
        /* ignore parsing error */
      }
    }

    // 3. Check if partner opened the link
    const hasOpened = !!(await redis.get<string>(`invite-opened:${user.id}`));

    return ok({ hasJoined: false, hasOpened });
  } catch (e) {
    return fail(e);
  }
}

export async function redeemInviteAction(
  rawToken: string,
): Promise<ActionResult<{ redirectTo: string }>> {
  const result = await acceptCoupleInviteAction(rawToken);
  if (!result.ok) return result;
  return ok({ redirectTo: "/dashboard" });
}

/**
 * Public-safe invite preview — never returns email, IDs, or private profile fields.
 */
export async function getInvitePreviewAction(
  rawToken: string,
): Promise<
  ActionResult<{
    displayName: string;
    avatarUrl: string | null;
    brandMessage: string;
  }>
> {
  try {
    const tokenKey = rawToken.slice(0, 16);
    await rateLimitOrThrow({
      key: `rl:invite-preview:${tokenKey}`,
      limit: 30,
      windowSeconds: 60 * 15,
      message: "Too many invite lookups. Try again later.",
    });

    if (!/^[a-f0-9]{64}$/i.test(rawToken)) {
      throw new AppError("INVITE_TOKEN_INVALID", "This invite link is invalid.", 400);
    }

    const tokenHash = hashInviteToken(rawToken);
    const tokenRow = await db.query.inviteTokens.findFirst({
      where: eq(inviteTokens.tokenHash, tokenHash),
    });

    if (!tokenRow || tokenRow.used || tokenRow.expiresAt.getTime() < Date.now()) {
      throw new AppError(
        "INVITE_TOKEN_INVALID",
        "This invite link is invalid or has expired.",
        404,
      );
    }

    const profile = await db.query.onboardingProfiles.findFirst({
      where: eq(onboardingProfiles.userId, tokenRow.inviterId),
    });

    const displayName = profile?.name?.trim() || "Your partner";
    // Never expose long-lived signed avatar URLs on anonymous preview
    return ok({
      displayName,
      avatarUrl: null,
      brandMessage: `You have been invited by ${displayName} to join ${BRAND.name}.`,
    });
  } catch (e) {
    return fail(e);
  }
}
