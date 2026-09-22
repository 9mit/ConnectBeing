import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { coupleMembers, couples, users } from "@/db/schema";
import { syncAppUserFromSupabase } from "@/lib/auth-login";
import { INVITE_COOKIE_NAME } from "@/lib/invite-cookie";
import { applyCookies } from "@/lib/response-cookies";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Server-authoritative route handler for "Begin Our Story".
 *
 * Deterministic Routing State Machine:
 * 1. Anonymous / Expired / Invalid / Logged Out:
 *    -> Redirect to /register (clear any stale cookie)
 * 2. Authenticated + No Profile / Incomplete Onboarding:
 *    -> Redirect to /onboarding (Name / Details page)
 * 3. Authenticated + Completed Onboarding:
 *    -> If active couple membership exists: Redirect to /dashboard
 *    -> If pending invite cookie exists: Redirect to /invite/[token]
 *    -> If no couple & no invite: Redirect to /onboarding/decision
 */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  function unauthenticatedResponse(): NextResponse {
    const redirectUrl = new URL("/register", request.url);
    const response = NextResponse.redirect(redirectUrl, 307);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
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
        return unauthenticatedResponse();
      }
    } catch {
      if (!session) {
        return unauthenticatedResponse();
      }
    }
  }

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
    // Authoritatively check active couple membership in couple_members
    const activeMembership = await db.query.coupleMembers.findFirst({
      where: and(
        eq(coupleMembers.userId, dbUser.id),
        eq(coupleMembers.status, "active"),
      ),
      with: { couple: true },
    });

    if (activeMembership?.couple && activeMembership.couple.status === "active" && activeMembership.couple.userBId) {
      const response = NextResponse.redirect(new URL("/dashboard", request.url), 307);
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      applyCookies(response, pendingCookies);
      return response;
    }

    // Check if user has a pending invite cookie to accept
    const pendingInviteToken = request.cookies.get(INVITE_COOKIE_NAME)?.value;
    if (pendingInviteToken && /^[a-f0-9]{64}$/i.test(pendingInviteToken)) {
      const response = NextResponse.redirect(
        new URL(`/invite/${encodeURIComponent(pendingInviteToken)}`, request.url),
        307,
      );
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
    return unauthenticatedResponse();
  }
}
