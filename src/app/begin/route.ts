import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { syncAppUserFromSupabase } from "@/lib/auth-login";
import { applyCookies } from "@/lib/response-cookies";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Server-authoritative route handler for "Begin Our Story".
 *
 * Routing Matrix:
 * 1. Anonymous / Expired / Invalid / Logged Out:
 *    -> Redirect to /register (clear any stale cookie)
 * 2. Authenticated + No Profile / Incomplete Onboarding:
 *    -> Redirect to /onboarding (Name / Details page)
 * 3. Authenticated + Completed Onboarding:
 *    -> If couple exists: Redirect to /dashboard (Main application)
 *    -> If no couple: Redirect to /onboarding/decision (Pairing / Matchmaking step)
 */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  function unauthenticatedResponse(): NextResponse {
    const redirectUrl = new URL("/register", request.url);
    const response = NextResponse.redirect(redirectUrl, 307);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    // Purge stale or invalid session cookie if present
    if (request.cookies.has(AUTH_COOKIE_NAME)) {
      response.cookies.set(AUTH_COOKIE_NAME, "", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
      });
    }
    return response;
  }

  // 1. Verify custom JWT session token
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;

  // 2. Check Supabase SSR session
  let supabaseAuthId = session?.supabaseAuthId || null;
  let userEmail = session?.email || null;
  const pendingCookies: Parameters<typeof applyCookies>[1] = [];

  if (url && anonKey) {
    try {
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

      const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser();
      if (!sbError && sbUser) {
        supabaseAuthId = sbUser.id;
        userEmail = sbUser.email || userEmail;
      } else if (!session) {
        // Neither Supabase nor JWT session is valid
        return unauthenticatedResponse();
      }
    } catch {
      if (!session) {
        return unauthenticatedResponse();
      }
    }
  }

  // If no authenticated identity could be resolved
  if (!supabaseAuthId) {
    return unauthenticatedResponse();
  }

  // 3. Query the user's persisted database profile & onboarding state
  try {
    let dbUser = await db.query.users.findFirst({
      where: eq(users.supabaseAuthId, supabaseAuthId),
      with: {
        couple: true,
        onboardingProfile: true,
      },
    });

    if (!dbUser && session?.userId) {
      dbUser = await db.query.users.findFirst({
        where: eq(users.id, session.userId),
        with: {
          couple: true,
          onboardingProfile: true,
        },
      });
    }

    // Auto-sync user if record doesn't exist yet in users table
    if (!dbUser && userEmail) {
      const synced = await syncAppUserFromSupabase({
        supabaseAuthId,
        email: userEmail,
      });
      if (synced) {
        dbUser = await db.query.users.findFirst({
          where: eq(users.id, synced.id),
          with: {
            couple: true,
            onboardingProfile: true,
          },
        });
      }
    }

    if (!dbUser) {
      // User is authenticated in auth provider but has no DB record yet
      // Route to onboarding to initialize profile
      const response = NextResponse.redirect(new URL("/onboarding", request.url), 307);
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      applyCookies(response, pendingCookies);
      return response;
    }

    const hasProfile = Boolean(dbUser.onboardingProfile);
    const isOnboarded = Boolean(dbUser.isOnboarded && hasProfile);

    // STATE B: Authenticated account exists, but profile/onboarding is incomplete
    if (!isOnboarded) {
      const response = NextResponse.redirect(new URL("/onboarding", request.url), 307);
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      applyCookies(response, pendingCookies);
      return response;
    }

    // STATE C: Authenticated account + completed profile & onboarding
    // If active couple is already formed, go straight to main application
    if (dbUser.coupleId) {
      const response = NextResponse.redirect(new URL("/dashboard", request.url), 307);
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      applyCookies(response, pendingCookies);
      return response;
    }

    // Onboarded but unpaired: go to decision / invite
    const response = NextResponse.redirect(new URL("/onboarding/decision", request.url), 307);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    applyCookies(response, pendingCookies);
    return response;
  } catch (dbError) {
    console.error("[begin route] Database check error:", dbError);
    // On unexpected error, do not expose internal error or fake registered state
    return unauthenticatedResponse();
  }
}
