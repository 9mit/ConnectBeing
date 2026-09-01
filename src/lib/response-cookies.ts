import type { NextResponse } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/** Apply Set-Cookie entries onto the response that is actually returned. */
export function applyCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[],
): void {
  for (const { name, value, options } of cookiesToSet) {
    const safeOptions = { ...(options ?? {}) } as Record<string, unknown>;
    if (!safeOptions.domain) delete safeOptions.domain;
    response.cookies.set(
      name,
      value,
      safeOptions as Parameters<NextResponse["cookies"]["set"]>[2],
    );
  }
}
