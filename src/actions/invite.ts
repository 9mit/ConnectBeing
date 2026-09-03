"use server";

import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { inAppNotifications, inviteTokens, onboardingProfiles, users } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireAppUser, requireOnboardedUser } from "@/lib/auth";
import {
  generateInviteToken,
  hashInviteToken,
  inviteRedisKey,
  INVITE_TOKEN_TTL_SECONDS,
} from "@/lib/crypto/invite-token";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { redis } from "@/lib/redis";
import { createCoupleFromInvite } from "@/lib/couples";

export async function generateInviteLinkAction(): Promise<
  ActionResult<{ url: string; expiresAt: string }>
> {
  try {
    const user = await requireOnboardedUser();
    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:invite:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 60,
    });

    if (user.coupleId) {
      throw new AppError(
        "FORBIDDEN",
        "You are already linked with a partner.",
        403,
      );
    }

    const active = await db.query.inviteTokens.findMany({
      where: and(
        eq(inviteTokens.inviterId, user.id),
        eq(inviteTokens.used, false),
      ),
    });

    for (const token of active) {
      await db
        .update(inviteTokens)
        .set({ used: true })
        .where(eq(inviteTokens.id, token.id));
      await redis.del(inviteRedisKey(token.tokenHash));
    }

    const raw = generateInviteToken();
    const tokenHash = hashInviteToken(raw);
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_SECONDS * 1000);

    await db.insert(inviteTokens).values({
      id: createId(),
      tokenHash,
      inviterId: user.id,
      expiresAt,
    });

    await redis.set(inviteRedisKey(tokenHash), user.id, {
      nx: true,
      ex: INVITE_TOKEN_TTL_SECONDS,
    });

    const { getAppUrl } = await import("@/lib/app-url");
    const base = getAppUrl();

    return ok({
      url: `${base}/invite/${raw}`,
      expiresAt: expiresAt.toISOString(),
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
    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:redeem:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 15,
      message: "Too many invite attempts. Try again later.",
    });

    if (user.coupleId) {
      throw new AppError("FORBIDDEN", "Already in a couple.", 403);
    }

    if (!/^[a-f0-9]{64}$/i.test(rawToken)) {
      throw new AppError("INVITE_TOKEN_INVALID", "Invite token format is invalid.", 400);
    }

    const tokenHash = hashInviteToken(rawToken);
    const redisKey = inviteRedisKey(tokenHash);

    let inviterId = await redis.get<string>(redisKey);

    const tokenRow = await db.query.inviteTokens.findFirst({
      where: eq(inviteTokens.tokenHash, tokenHash),
    });

    if (!tokenRow) {
      throw new AppError("INVITE_TOKEN_INVALID", "Invite token not found.", 404);
    }

    if (tokenRow.used) {
      throw new AppError("INVITE_TOKEN_USED", "Invite token already used.", 410);
    }

    if (tokenRow.expiresAt.getTime() < Date.now()) {
      throw new AppError("INVITE_TOKEN_EXPIRED", "Invite token has expired.", 410);
    }

    if (tokenRow.inviterId === user.id) {
      throw new AppError(
        "INVITE_TOKEN_SELF",
        "You cannot use your own invite link.",
        400,
      );
    }

    inviterId = inviterId ?? tokenRow.inviterId;

    const inviter = await db.query.users.findFirst({
      where: eq(users.id, inviterId),
    });

    if (!inviter || inviter.coupleId) {
      throw new AppError(
        "INVITE_TOKEN_INVALID",
        "Inviter is not available to form a couple.",
        400,
      );
    }

    const coupleId = await createCoupleFromInvite({
      userAId: inviter.id,
      userBId: user.id,
      tokenId: tokenRow.id,
      usedById: user.id,
    });

    await redis.del(redisKey);

    // Notify inviter that their partner has entered using the invite link
    const joinerProfile = await db.query.onboardingProfiles.findFirst({
      where: eq(onboardingProfiles.userId, user.id),
    });
    const partnerName = joinerProfile?.name?.trim() || "Your partner";

    await db.insert(inAppNotifications).values({
      id: createId(),
      coupleId,
      userId: inviter.id,
      title: "🎉 Your Partner Is Here!",
      body: `${partnerName} entered using your invite link! Your sanctuary is now live ❤️`,
      kind: "general",
      link: "/dashboard",
      read: false,
    });

    await redis.set(
      `partner-joined:${inviter.id}`,
      JSON.stringify({ partnerName, coupleId, timestamp: Date.now() }),
      { ex: 86400 },
    );

    return ok({ coupleId });
  } catch (e) {
    return fail(e);
  }
}

export async function checkPartnerJoinedAction(): Promise<
  ActionResult<{
    hasJoined: boolean;
    partnerName?: string;
    coupleId?: string;
  }>
> {
  try {
    const user = await requireAppUser();
    if (user.coupleId) {
      const partner = await db.query.users.findFirst({
        where: and(
          eq(users.coupleId, user.coupleId),
          ne(users.id, user.id),
        ),
        with: { onboardingProfile: true },
      });
      const partnerName = partner?.onboardingProfile?.name || "Your partner";
      return ok({
        hasJoined: true,
        partnerName,
        coupleId: user.coupleId,
      });
    }

    const raw = await redis.get<string>(`partner-joined:${user.id}`);
    if (raw) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return ok({
          hasJoined: true,
          partnerName: parsed.partnerName || "Your partner",
          coupleId: parsed.coupleId,
        });
      } catch {
        return ok({ hasJoined: true, partnerName: "Your partner" });
      }
    }

    return ok({ hasJoined: false });
  } catch (e) {
    return fail(e);
  }
}

export async function redeemInviteAction(
  rawToken: string,
): Promise<ActionResult<{ redirectTo: string }>> {
  const result = await redeemInviteToken(rawToken);
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
    const { rateLimitOrThrow } = await import("@/lib/security");
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
      brandMessage: `You have been invited by ${displayName} to join MadLove.`,
    });
  } catch (e) {
    return fail(e);
  }
}
