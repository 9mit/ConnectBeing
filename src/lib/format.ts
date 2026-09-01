/** Pure display helpers — no business logic. */

export function daysBetween(from: Date, to: Date = new Date()): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function formatDaysTogether(days: number): string {
  if (days <= 0) return "Day one";
  if (days === 1) return "1 day together";
  return `${days} days together`;
}

export function capitalizeMood(mood: string | null | undefined): string {
  if (!mood) return "—";
  return mood.charAt(0).toUpperCase() + mood.slice(1);
}
