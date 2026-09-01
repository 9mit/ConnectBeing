import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Prefer Supabase **pooler** URL (port 6543, `*.pooler.supabase.com`).
 * Direct `db.*.supabase.co:5432` often fails DNS/egress from Vercel serverless.
 */
function assertDatabaseUrl(connectionString: string): void {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }

  const host = parsed.hostname.toLowerCase();
  const port = parsed.port || (parsed.protocol === "postgresql:" ? "5432" : "");
  const looksDirect =
    host.startsWith("db.") &&
    host.endsWith(".supabase.co") &&
    (port === "5432" || port === "");

  if (looksDirect && process.env.NODE_ENV === "production") {
    // Prefer pooler on serverless; do not hard-crash — connection may still work
    // from some hosts, and a throw takes down every DB-backed route.
    console.warn(
      "[db] DATABASE_URL looks like a direct Supabase host (db.*.supabase.co:5432). Prefer the pooler URL on port 6543 (*.pooler.supabase.com) for production.",
    );
  }
}

/**
 * Supabase pooler connection (port 6543).
 * Prefer DATABASE_URL with ?pgbouncer=true for transaction pooling.
 * prepare: false is required with PgBouncer transaction mode.
 */
function createDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Use the Supabase pooler URL on port 6543.",
    );
  }

  assertDatabaseUrl(connectionString);

  const client = postgres(connectionString, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as {
  madloveDb: Database | undefined;
};

export function getDb(): Database {
  if (!globalForDb.madloveDb) {
    globalForDb.madloveDb = createDb();
  }
  return globalForDb.madloveDb;
}

/** Lazy proxy so importing this module does not require DATABASE_URL at build time. */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
