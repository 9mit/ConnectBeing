import { NextResponse } from "next/server";

import { runNightlyCalibrationJob } from "@/lib/cron/nightly";
import { safeEqualString } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 401 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!safeEqualString(auth, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runNightlyCalibrationJob();
  return NextResponse.json({ ok: true, ...result });
}
