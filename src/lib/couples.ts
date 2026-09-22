import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import {
  couples,
  coupleMembers,
  inviteTokens,
  users,
  onboardingProfiles,
  inAppNotifications,
  type Couple,
} from "@/db/schema";
import { issueVerificationPeriod } from "@/lib/couple-verification";
import { hashInviteToken, inviteRedisKey } from "@/lib/crypto/invite-token";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";
import { redis } from "@/lib/redis";

export type ActiveCouple = Omit<Couple, "userBId" | "status"> & {
  userBId: string;
  status: "active";
};

/**
 * Ensures Partner A has a valid pending couple record.
 * Idempotent: repeated calls or page refreshes will reuse the existing pending couple.
 */
export async function getOrCreatePendingCoupleForUser(userId: string): Promise<string> {
  // Check if user is already in an active couple
  const activeMembership = await db.query.coupleMembers.findFirst({
    where: and(
      eq(coupleMembers.userId, userId),
      eq(coupleMembers.status, "active"),
    ),
    with: { couple: true },
  });

  if (activeMembership?.couple && activeMembership.couple.status === "active") {
    throw new AppError(
      "FORBIDDEN",
      "You already belong to an active relationship.",
      403,
    );
  }

  // Check if user already created a pending couple
  const existingPending = await db.query.couples.findFirst({
    where: and(
      eq(couples.userAId, userId),
      eq(couples.status, "pending"),
    ),
  });

  if (existingPending) {
    // Ensure couple_members row exists for creator
    const creatorMember = await db.query.coupleMembers.findFirst({
      where: and(
        eq(coupleMembers.coupleId, existingPending.id),
        eq(coupleMembers.userId, userId),
      ),
    });

    if (!creatorMember) {
      await db.insert(coupleMembers).values({
        id: createId(),
        coupleId: existingPending.id,
        userId,
        role: "creator",
        status: "active",
      });
    }

    return existingPending.id;
  }

  const coupleId = createId();

  await db.transaction(async (tx) => {
    await tx.insert(couples).values({
      id: coupleId,
      userAId: userId,
      userBId: null,
      status: "pending",
    });

    await tx.insert(coupleMembers).values({
      id: createId(),
      coupleId,
      userId,
      role: "creator",
      status: "active",
    });

    await tx
      .update(users)
      .set({ coupleId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  });

  return coupleId;
}

/**
 * Atomically accepts an invitation and binds Partner B to Partner A's couple.
 * Enforces:
 * 1. Authenticated user ID is identity anchor.
 * 2. Strict transactional claim of invite token.
 * 3. Cannot accept if already in another active couple.
 * 4. Cannot accept own invite.
 * 5. Expired/revoked/used invites are rejected.
 * 6. One active couple per user strictly enforced at DB level.
 */
export async function acceptInviteAndJoinCouple(input: {
  rawToken: string;
  acceptingUserId: string;
}): Promise<{ coupleId: string; partnerName: string }> {
  const { rawToken, acceptingUserId } = input;

  if (!/^[a-f0-9]{64}$/i.test(rawToken)) {
    throw new AppError(
      "INVITE_TOKEN_INVALID",
      "Invite token format is invalid.",
      400,
    );
  }

  const tokenHash = hashInviteToken(rawToken);

  // Check if accepting user already has an active couple
  const existingActiveMembership = await db.query.coupleMembers.findFirst({
    where: and(
      eq(coupleMembers.userId, acceptingUserId),
      eq(coupleMembers.status, "active"),
    ),
    with: { couple: true },
  });

  if (
    existingActiveMembership?.couple &&
    existingActiveMembership.couple.status === "active"
  ) {
    throw new AppError(
      "ALREADY_IN_COUPLE",
      "You are already connected to another relationship.",
      409,
    );
  }

  let coupleId = "";
  let partnerId = "";
  let partnerName = "Your partner";

  await db.transaction(async (tx) => {
    // Atomically claim the token: update status = 'accepted', used = true
    const claimed = await tx
      .update(inviteTokens)
      .set({
        status: "accepted",
        used: true,
        usedById: acceptingUserId,
        acceptedAt: new Date(),
      })
      .where(
        and(
          eq(inviteTokens.tokenHash, tokenHash),
          eq(inviteTokens.status, "pending"),
          eq(inviteTokens.used, false),
          gt(inviteTokens.expiresAt, new Date()),
        ),
      )
      .returning();

    if (claimed.length === 0) {
      // Investigate why claim failed to produce precise error
      const existingToken = await tx.query.inviteTokens.findFirst({
        where: eq(inviteTokens.tokenHash, tokenHash),
      });

      if (!existingToken) {
        throw new AppError("INVITE_TOKEN_INVALID", "Invite link not found.", 404);
      }
      if (existingToken.status === "accepted" || existingToken.used) {
        throw new AppError(
          "INVITE_TOKEN_USED",
          "This invite link has already been used.",
          410,
        );
      }
      if (existingToken.status === "revoked") {
        throw new AppError(
          "INVITE_TOKEN_REVOKED",
          "This invite link was cancelled by your partner.",
          410,
        );
      }
      if (existingToken.expiresAt.getTime() <= Date.now()) {
        throw new AppError(
          "INVITE_TOKEN_EXPIRED",
          "This invite link has expired.",
          410,
        );
      }

      throw new AppError(
        "INVITE_TOKEN_CLAIM_FAILED",
        "Could not claim invite link. Please try again.",
        400,
      );
    }

    const tokenRow = claimed[0];

    if (tokenRow.inviterId === acceptingUserId) {
      throw new AppError(
        "INVITE_TOKEN_SELF",
        "You cannot accept your own invite link.",
        400,
      );
    }

    partnerId = tokenRow.inviterId;

    // Resolve target couple
    let targetCoupleId = tokenRow.coupleId;

    if (!targetCoupleId) {
      // Fallback: check inviter's pending couple
      const inviterPendingCouple = await tx.query.couples.findFirst({
        where: and(
          eq(couples.userAId, tokenRow.inviterId),
          eq(couples.status, "pending"),
        ),
      });
      if (inviterPendingCouple) {
        targetCoupleId = inviterPendingCouple.id;
      }
    }

    if (!targetCoupleId) {
      // Fallback: check inviter's current couple
      const inviterUser = await tx.query.users.findFirst({
        where: eq(users.id, tokenRow.inviterId),
      });
      targetCoupleId = inviterUser?.coupleId ?? null;
    }

    if (!targetCoupleId) {
      // Create pending couple for inviter if missing
      targetCoupleId = createId();
      await tx.insert(couples).values({
        id: targetCoupleId,
        userAId: tokenRow.inviterId,
        userBId: null,
        status: "pending",
      });
      await tx.insert(coupleMembers).values({
        id: createId(),
        coupleId: targetCoupleId,
        userId: tokenRow.inviterId,
        role: "creator",
        status: "active",
      });
    }

    coupleId = targetCoupleId;

    // Lock and check the target couple
    const targetCouple = await tx.query.couples.findFirst({
      where: eq(couples.id, coupleId),
    });

    if (!targetCouple) {
      throw new AppError("COUPLE_NOT_FOUND", "Target relationship space not found.", 404);
    }

    if (targetCouple.status === "active" && targetCouple.userBId && targetCouple.userBId !== acceptingUserId) {
      throw new AppError(
        "COUPLE_ALREADY_FILLED",
        "This relationship space is already complete with two partners.",
        409,
      );
    }

    const verifiedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Update couple to active status with Partner B
    await tx
      .update(couples)
      .set({
        userBId: acceptingUserId,
        status: "active",
        anniversaryDate: targetCouple.anniversaryDate ?? new Date(),
        verifiedUntil,
      })
      .where(eq(couples.id, coupleId));

    // Ensure Partner A has member record
    const partnerAMember = await tx.query.coupleMembers.findFirst({
      where: and(
        eq(coupleMembers.coupleId, coupleId),
        eq(coupleMembers.userId, tokenRow.inviterId),
      ),
    });

    if (!partnerAMember) {
      await tx.insert(coupleMembers).values({
        id: createId(),
        coupleId,
        userId: tokenRow.inviterId,
        role: "creator",
        status: "active",
      });
    }

    // Insert Partner B member record
    const partnerBMember = await tx.query.coupleMembers.findFirst({
      where: and(
        eq(coupleMembers.coupleId, coupleId),
        eq(coupleMembers.userId, acceptingUserId),
      ),
    });

    if (!partnerBMember) {
      await tx.insert(coupleMembers).values({
        id: createId(),
        coupleId,
        userId: acceptingUserId,
        role: "partner",
        status: "active",
      });
    }

    // Update both users with active coupleId
    await tx
      .update(users)
      .set({ coupleId, updatedAt: new Date() })
      .where(eq(users.id, acceptingUserId));

    await tx
      .update(users)
      .set({ coupleId, updatedAt: new Date() })
      .where(eq(users.id, tokenRow.inviterId));

    // Revoke any other pending invites for this couple
    await tx
      .update(inviteTokens)
      .set({ status: "revoked", used: true })
      .where(
        and(
          eq(inviteTokens.coupleId, coupleId),
          eq(inviteTokens.status, "pending"),
        ),
      );
  });

  // Clean up Redis invite cache
  try {
    await Promise.all([
      redis.del(inviteRedisKey(tokenHash)),
      redis.del(`active-invite-url:${partnerId}`),
      redis.del(`invite-opened:${partnerId}`),
    ]);
  } catch {
    /* ignore redis cache error */
  }

  // Fetch partner name for response and notification
  const joinerProfile = await db.query.onboardingProfiles.findFirst({
    where: eq(onboardingProfiles.userId, acceptingUserId),
  });
  const joinerName = joinerProfile?.name?.trim() || "Your partner";

  const inviterProfile = await db.query.onboardingProfiles.findFirst({
    where: eq(onboardingProfiles.userId, partnerId),
  });
  partnerName = inviterProfile?.name?.trim() || "Your partner";

  // Notify Partner A
  try {
    await db.insert(inAppNotifications).values({
      id: createId(),
      coupleId,
      userId: partnerId,
      title: "🎉 Your Partner Is Here!",
      body: `${joinerName} has joined your sanctuary! Your private home is now live ❤️`,
      kind: "general",
      link: "/dashboard",
      read: false,
    });

    await redis.set(
      `partner-joined:${partnerId}`,
      JSON.stringify({ partnerName: joinerName, coupleId, timestamp: Date.now() }),
      { ex: 86400 },
    );
  } catch (notifErr) {
    console.error("[couple] Error sending join notification:", notifErr);
  }

  // Issue verification period
  try {
    await issueVerificationPeriod({
      coupleId,
      revealedToUserId: partnerId,
      syncVerifiedUntil: false,
    });
  } catch (err) {
    console.error("[couple] failed to issue first verification period", err);
  }

  return { coupleId, partnerName };
}

/**
 * Backward compatibility wrapper for existing tests or server actions.
 */
export async function createCoupleFromInvite(input: {
  userAId: string;
  userBId: string;
  tokenId: string;
  usedById: string;
}): Promise<string> {
  const tokenRow = await db.query.inviteTokens.findFirst({
    where: eq(inviteTokens.id, input.tokenId),
  });

  if (!tokenRow) {
    throw new AppError("INVITE_TOKEN_INVALID", "Invite token not found.", 404);
  }

  const coupleId = createId();

  await db.transaction(async (tx) => {
    await tx
      .update(inviteTokens)
      .set({
        status: "accepted",
        used: true,
        usedById: input.usedById,
        acceptedAt: new Date(),
      })
      .where(eq(inviteTokens.id, input.tokenId));

    const verifiedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await tx.insert(couples).values({
      id: coupleId,
      userAId: input.userAId,
      userBId: input.userBId,
      status: "active",
      anniversaryDate: new Date(),
      verifiedUntil,
    });

    await tx.insert(coupleMembers).values([
      {
        id: createId(),
        coupleId,
        userId: input.userAId,
        role: "creator",
        status: "active",
      },
      {
        id: createId(),
        coupleId,
        userId: input.userBId,
        role: "partner",
        status: "active",
      },
    ]);

    await tx
      .update(users)
      .set({ coupleId, updatedAt: new Date() })
      .where(eq(users.id, input.userAId));

    await tx
      .update(users)
      .set({ coupleId, updatedAt: new Date() })
      .where(eq(users.id, input.userBId));
  });

  return coupleId;
}
