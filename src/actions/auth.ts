"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  updatePasswordSchema,
} from "@/lib/validations";

/**
 * Password reset + update remain Server Actions (forms call them directly).
 * Login/register/logout live under /api/auth/* so JWT cookies are set on HTTP responses.
 */

export async function forgotPasswordAction(
  input: unknown,
): Promise<ActionResult<{ message: string }>> {
  try {
    const parsed = forgotPasswordSchema.parse(input);
    const email = parsed.email.toLowerCase();

    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:forgot:${email}`,
      limit: 5,
      windowSeconds: 60 * 15,
      message: "Too many reset requests. Try again later.",
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl.replace(/\/$/, "")}/auth/callback?next=/update-password`,
    });

    if (error) {
      console.error("[forgot-password] request failed");
    }

    return ok({
      message:
        "If an account exists for that email, a reset link has been sent.",
    });
  } catch (e) {
    return fail(e);
  }
}

export async function updatePasswordAction(
  input: unknown,
): Promise<ActionResult<{ message: string; redirectTo: string }>> {
  try {
    const parsed = updatePasswordSchema.parse(input);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.password,
    });
    if (error) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Unable to update password. Try again.",
        400,
      );
    }
    return ok({ message: "Password updated.", redirectTo: "/dashboard" });
  } catch (e) {
    return fail(e);
  }
}
