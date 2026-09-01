import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
  }

  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            const safeOptions = { ...options };
            if (!safeOptions.domain) delete safeOptions.domain;
            cookieStore.set(name, value, safeOptions);
          });
        } catch (error) {
          // Called from a Server Component — middleware will refresh sessions.
          console.error("Supabase cookie set failed:", error);
        }
      },
    },
  });
}
