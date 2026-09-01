import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isNonProductionRuntime } from "@/lib/auth-login";
import { redis } from "@/lib/redis";
import { applyCookies } from "@/lib/response-cookies";
import { registerSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

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

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const issue =
      parsed.error.issues[0]?.message || "Invalid registration fields.";
    return NextResponse.json(
      { ok: false, error: { message: issue } },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();

  try {
    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:register:${email}`,
      limit: 5,
      windowSeconds: 60 * 15,
      message: "Too many registration attempts. Try again later.",
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

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

    let createdViaAdmin = false;

    // Pre-confirm via admin only outside production.
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && isNonProductionRuntime()) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const { error: adminErr } = await admin.auth.admin.createUser({
          email,
          password: parsed.data.password,
          email_confirm: true,
          user_metadata: parsed.data.inviteToken
            ? { pending_invite: parsed.data.inviteToken }
            : undefined,
        });
        if (!adminErr) {
          createdViaAdmin = true;
        } else {
          console.error("[register API] admin createUser:", adminErr.message);
        }
      } catch (e) {
        console.error("[register API] admin signup fallback error:", e);
      }
    }

    if (!createdViaAdmin) {
      const { error } = await supabase.auth.signUp({
        email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding`,
          data: parsed.data.inviteToken
            ? { pending_invite: parsed.data.inviteToken }
            : undefined,
        },
      });

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              message:
                error.message || "Unable to create account. Please try again.",
            },
          },
          { status: 400 },
        );
      }
    }

    if (parsed.data.inviteToken) {
      await redis.set(`pending-invite-email:${email}`, parsed.data.inviteToken, {
        ex: 60 * 60 * 24 * 3,
      });
    }

    const response = NextResponse.json(
      { ok: true, redirectTo: "/login?registered=1" },
      { status: 200 },
    );
    applyCookies(response, pendingCookies);
    return response;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error.";
    console.error("[register API] unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: { message } },
      { status: 500 },
    );
  }
}
