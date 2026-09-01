"use server";

import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const publicKeySchema = z.object({
  publicKey: z.string().min(32).max(2048),
});

export async function publishE2eePublicKeyAction(
  input: unknown,
): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const parsed = publicKeySchema.parse(input);
    const { user } = await requireActiveCouple();
    await db
      .update(users)
      .set({ e2eePublicKey: parsed.publicKey, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return ok({ saved: true });
  } catch (e) {
    return fail(e);
  }
}

export async function getPartnerE2eePublicKeyAction(): Promise<
  ActionResult<{ publicKey: string | null; partnerId: string | null }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;
    const partner = await db.query.users.findFirst({
      where: and(eq(users.id, partnerId), ne(users.id, user.id)),
    });
    if (!partner) {
      throw new AppError("NOT_FOUND", "Partner not found.", 404);
    }
    return ok({
      publicKey: partner.e2eePublicKey ?? null,
      partnerId: partner.id,
    });
  } catch (e) {
    return fail(e);
  }
}
