import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/session";

const PUBLIC_PATHS = new Set([
  "/",
  "/begin",
  "/login",
  "/register",
  "/invite",
  "/forgot-password",
  "/update-password",
  "/privacy",
  "/security",
  "/robots.txt",
  "/sitemap.xml",
  "/sw.js",
  "/manifest.webmanifest",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/invite/")) return true;
  if (pathname.startsWith("/auth/callback")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|mp4|webm|ogg|mp3|wav)$/i.test(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  let response = NextResponse.next({ request });

  // 1. Supabase SSR session refresh & cookie synchronization
  // PERFORMANCE CRITICAL: Never block internal RSC navigations or prefetch requests on remote Supabase auth HTTP calls.
  const isRscRequest = request.headers.get("RSC") === "1" || searchParams.has("_rsc");
  const isPrefetch =
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("x-purpose") === "prefetch" ||
    request.headers.get("next-router-prefetch") === "1";
  const hasSupabaseCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey && hasSupabaseCookie && !isRscRequest && !isPrefetch) {
    try {
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => {
              const safeOptions = { ...options };
              if (!safeOptions.domain) delete safeOptions.domain;
              response.cookies.set(name, value, safeOptions);
            });
          },
        },
      });

      // Refreshes session tokens if expired/near expiry on full document requests
      await supabase.auth.getUser();
    } catch {
      // Ignore network errors during background refresh
    }
  }

  // 2. Validate custom HMAC JWT session token
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;

  // Stale or invalid session token detected: purge cookie
  if (token && !session) {
    response.cookies.set(AUTH_COOKIE_NAME, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
  }

  // 3. Authenticated user visiting /login or /register (unless explicitly logging out or overriding)
  const isAuthOverride = searchParams.has("logout") || searchParams.has("force");
  if (session && (pathname === "/login" || pathname === "/register") && !isAuthOverride) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/begin";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  // 4. Unauthenticated user accessing protected route
  if (!session && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(redirect);
    if (token && !session) {
      redirectResponse.cookies.set(AUTH_COOKIE_NAME, "", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
      });
    }
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|mp4|webm|ogg|mp3|wav)$).*)",
  ],
};
