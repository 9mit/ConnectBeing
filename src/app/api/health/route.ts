import { NextResponse } from "next/server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { isUsingMockRedis, redis } from "@/lib/redis";
import { hasSessionSecretConfigured } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  const checks: Record<string, "ok" | "error"> = {
    db: "error",
    redis: "error",
    sessionSecret: hasSessionSecretConfigured() ? "ok" : "error",
  };

  try {
    await db.select({ id: users.id }).from(users).limit(1);
    checks.db = "ok";
  } catch {
    checks.db = "error";
  }

  try {
    if (isProd && isUsingMockRedis()) {
      checks.redis = "error";
    } else {
      const key = `health:${Date.now()}`;
      await redis.set(key, "1", { ex: 5 });
      await redis.del(key);
      checks.redis = "ok";
    }
  } catch {
    checks.redis = "error";
  }

  const healthy =
    checks.db === "ok" &&
    checks.redis === "ok" &&
    (!isProd || checks.sessionSecret === "ok");

  return NextResponse.json(
    { ok: healthy, checks, ts: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
