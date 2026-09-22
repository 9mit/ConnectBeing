import { cookies } from "next/headers";

export const INVITE_COOKIE_NAME = "madlove_pending_invite";

const COOKIE_MAX_AGE = 60 * 60 * 72; // 72 hours

export function getPendingInviteCookie(): string | null {
  try {
    const cookieStore = cookies();
    return cookieStore.get(INVITE_COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}

export function setPendingInviteCookie(token: string): void {
  try {
    const cookieStore = cookies();
    cookieStore.set(INVITE_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  } catch (err) {
    console.warn("[invite-cookie] Failed to set pending invite cookie:", err);
  }
}

export function clearPendingInviteCookie(): void {
  try {
    const cookieStore = cookies();
    cookieStore.set(INVITE_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  } catch (err) {
    console.warn("[invite-cookie] Failed to clear pending invite cookie:", err);
  }
}
