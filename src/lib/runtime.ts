/**
 * Shared runtime environment helpers.
 * Compatible with Node.js and Edge runtimes (no Node-only imports).
 */

export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function isNonProductionRuntime(): boolean {
  return !isProductionRuntime();
}
