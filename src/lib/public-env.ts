import { redirect } from "next/navigation";

import { AppError } from "@/lib/errors";

/** Resolve public Supabase env or redirect away from broken session pages. */
export function requirePublicSupabaseOrRedirect(): {
  url: string;
  anonKey: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    redirect("/login?error=config");
  }
  return { url, anonKey };
}

export function getPublicSupabaseOrThrow(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Supabase public environment is not configured.",
      503,
    );
  }
  return { url, anonKey };
}
