import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

function clearAppSession(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

async function clearSupabaseSession(
  request: NextRequest,
  response: NextResponse,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[logout] supabase signOut failed:", err);
  }
}

/** Form posts from AppShell — redirect to login after clearing sessions. */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  clearAppSession(response);
  await clearSupabaseSession(request, response);
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  clearAppSession(response);
  await clearSupabaseSession(request, response);
  return response;
}
