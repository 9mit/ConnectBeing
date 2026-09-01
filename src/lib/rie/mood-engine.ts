import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { moods } from "@/db/schema";

export interface MoodTrend {
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  dominant: string | null;
  happyStreakDays: number;
  lowPeriod: boolean;
  stressHint: boolean;
}

const HAPPY = new Set(["happy", "cuddles", "excited"]);
const LOW = new Set(["low", "space"]);

export async function analyzeMoodTrends(coupleId: string): Promise<MoodTrend> {
  const rows = await db.query.moods.findMany({
    where: eq(moods.coupleId, coupleId),
    orderBy: [desc(moods.createdAt)],
    limit: 200,
  });

  const weekly: Record<string, number> = {};
  const monthly: Record<string, number> = {};
  const now = Date.now();
  const weekMs = 7 * 86400000;
  const monthMs = 30 * 86400000;

  for (const r of rows) {
    const age = now - r.createdAt.getTime();
    weekly[r.mood] = (weekly[r.mood] ?? 0) + (age <= weekMs ? 1 : 0);
    monthly[r.mood] = (monthly[r.mood] ?? 0) + (age <= monthMs ? 1 : 0);
  }

  let dominant: string | null = null;
  let max = 0;
  for (const [k, v] of Object.entries(monthly)) {
    if (v > max) {
      max = v;
      dominant = k;
    }
  }

  // Happy streak: consecutive calendar days with a happy-ish mood
  const byDay = new Map<string, string[]>();
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(r.mood);
    byDay.set(key, list);
  }
  const days = Array.from(byDay.keys()).sort().reverse();
  let happyStreakDays = 0;
  for (const day of days) {
    const moodsForDay = byDay.get(day) ?? [];
    if (moodsForDay.some((m) => HAPPY.has(m))) happyStreakDays += 1;
    else break;
  }

  const recent = rows.slice(0, 10);
  const lowCount = recent.filter((r) => LOW.has(r.mood)).length;
  const spaceCount = recent.filter((r) => r.mood === "space").length;

  return {
    weekly,
    monthly,
    dominant,
    happyStreakDays,
    lowPeriod: lowCount >= 4,
    stressHint: spaceCount >= 3 || lowCount >= 5,
  };
}
