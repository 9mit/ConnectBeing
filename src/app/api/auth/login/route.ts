import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  isNonProductionRuntime,
  redeemPendingInvites,
  resolvePostLoginDestination,
  syncAppUserFromSupabase,
} from "@/lib/auth-login";
import { applyCookies } from "@/lib/response-cookies";
import {
  AUTH_COOKIE_NAME,
  createAuthToken,
  SessionSecretError,
} from "@/lib/session";
import { loginSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const LOGIN_ATTEMPT_LIMIT = 5;
const LOCK_MINUTES = 15;

const loginBodySchema = loginSchema.extend({
  next: z
    .string()
    .max(200)
    .regex(/^\/[a-zA-Z0-9/_-]*$/)
    .optional(),
});

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: { message: "Authentication is not configured." } },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "Invalid request payload." } },
      { status: 400 },
    );
  }

  const parsed = loginBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue =
      parsed.error.issues[0]?.message || "Invalid email or password.";
    return NextResponse.json(
      { ok: false, error: { message: issue } },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const nextRaw = parsed.data.next;

  try {
    let existing = null;
    try {
      existing = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
    } catch (e) {
      console.warn("[login API] Pre-lookup user db query warning:", e);
    }

    const locked = existing?.lockedUntil && existing.lockedUntil > new Date();

    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `auth:login:${email}`,
      limit: 20,
      windowSeconds: 60 * 15,
      message: "Too many login attempts.",
    });

    if (locked) {
      return NextResponse.json(
        { ok: false, error: { message: "Invalid email or password." } },
        { status: 401 },
      );
    }

    const pendingCookies: Parameters<typeof applyCookies>[1] = [];

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });

    if (
      (error || !data.user) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      isNonProductionRuntime()
    ) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const { data: listed } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        const targetUser = listed?.users?.find(
          (u) => u.email?.toLowerCase() === email,
        );

        if (targetUser && !targetUser.email_confirmed_at) {
          await admin.auth.admin.updateUserById(targetUser.id, {
            email_confirm: true,
          });

          const retry = await supabase.auth.signInWithPassword({
            email,
            password: parsed.data.password,
          });
          data = retry.data;
          error = retry.error;
        }
      } catch (adminErr) {
        console.error("[login API] Auto-confirm retry failed:", adminErr);
      }
    }

    if (error || !data.user) {
      if (existing) {
        const failed = (existing.failedLoginAttempts ?? 0) + 1;
        const patch: Partial<typeof users.$inferInsert> = {
          failedLoginAttempts: failed,
          updatedAt: new Date(),
        };
        if (failed >= LOGIN_ATTEMPT_LIMIT) {
          patch.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
          patch.failedLoginAttempts = 0;
        }
        await db.update(users).set(patch).where(eq(users.id, existing.id));
      }
      return NextResponse.json(
        { ok: false, error: { message: "Invalid email or password." } },
        { status: 401 },
      );
    }

    let appUser;
    try {
      appUser = await syncAppUserFromSupabase({
        supabaseAuthId: data.user.id,
        email,
      });
    } catch (dbErr) {
      console.error("[login API] DB profile sync error:", dbErr);
      return NextResponse.json(
        {
          ok: false,
          error: {
            message:
              "Database connection failed. Please check DATABASE_URL in Vercel settings.",
          },
        },
        { status: 500 },
      );
    }

    if (!appUser) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: "Profile sync failed. Please try again." },
        },
        { status: 500 },
      );
    }

    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, appUser.id));

    appUser = await redeemPendingInvites(appUser, email);
    const destination = resolvePostLoginDestination(appUser, nextRaw);

    let token: string;
    try {
      token = await createAuthToken({
        userId: appUser.id,
        supabaseAuthId: data.user.id,
        email,
      });
    } catch (tokenErr) {
      if (tokenErr instanceof SessionSecretError) {
        console.error("[login API]", tokenErr.message);
        return NextResponse.json(
          { ok: false, error: { message: tokenErr.message } },
          { status: 500 },
        );
      }
      throw tokenErr;
    }

    const response = NextResponse.json(
      { ok: true, redirectTo: destination },
      { status: 200 },
    );

    applyCookies(response, pendingCookies);

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof SessionSecretError) {
      return NextResponse.json(
        { ok: false, error: { message: err.message } },
        { status: 500 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Internal server error.";
    console.error("[login API] unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: { message } },
      { status: 500 },
    );
  }
}
