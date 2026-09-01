import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { couples, inviteTokens, users } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { createId } from "@/lib/ids";

/**
 * Internal helper — NOT a Server Action. Only callable from trusted server code
 * (e.g. invite redeem after session checks).
 *
 * Atomically claims the invite token (`used = false` → `used = true`) or aborts.
 */
export async function createCoupleFromInvite(input: {
  userAId: string;
  userBId: string;
  tokenId: string;
  usedById: string;
}): Promise<string> {
  const coupleId = createId();

  await db.transaction(async (tx) => {
    const claimed = await tx
      .update(inviteTokens)
      .set({
        used: true,
        usedById: input.usedById,
      })
      .where(
        and(eq(inviteTokens.id, input.tokenId), eq(inviteTokens.used, false)),
      )
      .returning({ id: inviteTokens.id });

    if (claimed.length === 0) {
      throw new AppError(
        "INVITE_TOKEN_USED",
        "Invite token already used or claim failed.",
        410,
      );
    }

    const verifiedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await tx.insert(couples).values({
      id: coupleId,
      userAId: input.userAId,
      userBId: input.userBId,
      status: "active",
      anniversaryDate: new Date(),
      verifiedUntil,
    });

    await tx
      .update(users)
      .set({ coupleId, updatedAt: new Date() })
      .where(eq(users.id, input.userAId));

    await tx
      .update(users)
      .set({ coupleId, updatedAt: new Date() })
      .where(eq(users.id, input.userBId));
  });

  // Mint first hashed weekly code for Partner A (plaintext in Redis only)
  try {
    const { issueVerificationPeriod } = await import(
      "@/lib/couple-verification"
    );
    await issueVerificationPeriod({
      coupleId,
      revealedToUserId: input.userAId,
      syncVerifiedUntil: false,
    });
  } catch (err) {
    console.error("[couple] failed to issue first verification period", err);
  }

  return coupleId;
}
