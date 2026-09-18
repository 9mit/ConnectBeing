"use server";

import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireAppUser } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

const updatePasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export type SecurityStatusDTO = {
  email: string;
  createdAt: string;
  failedLoginAttempts: number;
  isLocked: boolean;
  lockedUntil: string | null;
};

export async function getSecurityStatusAction(): Promise<
  ActionResult<SecurityStatusDTO>
> {
  try {
    const user = await requireAppUser();

    const isLocked = !!(user.lockedUntil && user.lockedUntil.getTime() > Date.now());

    return ok({
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      failedLoginAttempts: user.failedLoginAttempts,
      isLocked,
      lockedUntil: user.lockedUntil?.toISOString() ?? null,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function updatePasswordAction(
  input: unknown,
): Promise<ActionResult<{ updated: true }>> {
  try {
    const parsed = updatePasswordSchema.parse(input);
    const user = await requireAppUser();

    await rateLimitOrThrow({
      key: `rl:security:pwd:${user.id}`,
      limit: 5,
      windowSeconds: 60 * 15,
      message: "Too many password change attempts. Try again later.",
    });

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(
      user.supabaseAuthId,
      { password: parsed.password },
    );

    if (error) {
      return fail(error);
    }

    return ok({ updated: true });
  } catch (e) {
    return fail(e);
  }
}
