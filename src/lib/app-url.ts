/**
 * Canonical Application URL Resolver
 * 
 * Automatically resolves the live URL across:
 * 1. NEXT_PUBLIC_APP_URL
 * 2. APP_URL (Vercel standard without public prefix)
 * 3. Vercel system-provided VERCEL_URL (e.g. connectbeing.vercel.app)
 * 4. Fallback to production https://connectbeing.vercel.app or local http://localhost:3000
 */
export function getAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return "https://connectbeing.vercel.app";
}
