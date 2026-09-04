import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/session";

const PUBLIC_PATHS = new Set([
  "/",
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
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  const session = token ? await verifyAuthToken(token) : null;

  if (session && (pathname === "/login" || pathname === "/register")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    return NextResponse.redirect(redirect);
  }

  if (!session && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|mp4|webm|ogg|mp3|wav)$).*)",
  ],
};
