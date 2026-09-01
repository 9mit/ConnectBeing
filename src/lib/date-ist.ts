/** Calendar date helpers in IST (UTC+5:30) for quizzes, engagement, cron. */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getIstNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** YYYY-MM-DD in IST */
export function getIstDateString(date = new Date()): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function engagementScoreKey(coupleId: string, date = getIstDateString()): string {
  return `couple:${coupleId}:score:${date}`;
}

export function quizCacheKey(coupleId: string, date = getIstDateString()): string {
  return `quiz:${coupleId}:${date}`;
}

export function petStateFromScore(score: number):
  | "thriving"
  | "happy"
  | "neutral"
  | "sad"
  | "neglected" {
  if (score >= 80) return "thriving";
  if (score >= 60) return "happy";
  if (score >= 40) return "neutral";
  if (score >= 20) return "sad";
  return "neglected";
}
