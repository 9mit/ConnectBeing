import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  redeemPendingInvites,
  resolvePostLoginDestination,
  syncAppUserFromSupabase,
} from "@/lib/auth-login";
import { applyCookies } from "@/lib/response-cookies";
import { safeInternalPath } from "@/lib/security";
import {
  AUTH_COOKIE_NAME,
  createAuthToken,
  SessionSecretError,
} from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"), "/dashboard");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const isLocalEnv = process.env.NODE_ENV === "development";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  let allowedHost: string | null = null;
  try {
    allowedHost = appUrl ? new URL(appUrl).host : null;
  } catch {
    allowedHost = null;
  }

  function absoluteRedirect(path: string): string {
    if (
      !isLocalEnv &&
      forwardedHost &&
      allowedHost &&
      forwardedHost === allowedHost
    ) {
      return `https://${forwardedHost}${path}`;
    }
    return `${origin}${path}`;
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const email = (data.user.email ?? "").toLowerCase();
  if (!email) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  try {
    let appUser = await syncAppUserFromSupabase({
      supabaseAuthId: data.user.id,
      email,
    });
    if (!appUser) {
      return NextResponse.redirect(
        `${origin}/login?error=auth_callback_failed`,
      );
    }

    appUser = await redeemPendingInvites(appUser, email);

    const destination =
      next === "/update-password"
        ? "/update-password"
        : resolvePostLoginDestination(appUser, next);

    const response = NextResponse.redirect(absoluteRedirect(destination));
    applyCookies(response, pendingCookies);

    const token = await createAuthToken({
      userId: appUser.id,
      supabaseAuthId: data.user.id,
      email,
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    if (err instanceof SessionSecretError) {
      console.error("[auth/callback]", err.message);
    } else {
      console.error("[auth/callback] profile/session failed:", err);
    }
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
}
