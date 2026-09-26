import { redis } from "@/lib/redis";
import { engagementScoreKey, getIstDateString } from "@/lib/date-ist";

export type EngagementEvent =
  | "message"
  | "quiz"
  | "mood"
  | "watch"
  | "audio_minute"
  | "location_minute";

/**
 * Engagement score caps (flush clamps to 100):
 * - messages: 5 pts each, max 5 counted = 25
 * - quiz completed: 25
 * - mood logged: 20
 * - watch (Together night): 15 once/day
 * - audio: 1 pt/min, max 20
 * - location: 1 pt/min, max 10
 */
export async function incrementEngagement(
  coupleId: string,
  event: EngagementEvent,
  amount = 1,
): Promise<number> {
  const date = getIstDateString();
  const scoreKey = engagementScoreKey(coupleId, date);
  const metaKey = `couple:${coupleId}:score-meta:${date}`;

  let delta = 0;

  switch (event) {
    case "message": {
      const cur = await redis.hincrby(metaKey, "messages", 1);
      await redis.expire(metaKey, 60 * 60 * 48);
      if (cur <= 5) delta = 5;
      break;
    }
    case "quiz": {
      const cur = await redis.hincrby(metaKey, "quiz", 1);
      await redis.expire(metaKey, 60 * 60 * 48);
      if (cur === 1) delta = 25;
      break;
    }
    case "mood": {
      const cur = await redis.hincrby(metaKey, "mood", 1);
      await redis.expire(metaKey, 60 * 60 * 48);
      if (cur === 1) delta = 20;
      break;
    }
    case "watch": {
      const cur = await redis.hincrby(metaKey, "watch", 1);
      await redis.expire(metaKey, 60 * 60 * 48);
      if (cur === 1) delta = 15;
      break;
    }
    case "audio_minute": {
      const inc = Math.max(1, Math.floor(amount));
      const cur = await redis.hincrby(metaKey, "audio", inc);
      await redis.expire(metaKey, 60 * 60 * 48);
      const prevAudio = cur - inc;
      if (prevAudio < 20) delta = Math.min(inc, 20 - prevAudio);
      break;
    }
    case "location_minute": {
      const inc = Math.max(1, Math.floor(amount));
      const cur = await redis.hincrby(metaKey, "location", inc);
      await redis.expire(metaKey, 60 * 60 * 48);
      const prevLoc = cur - inc;
      if (prevLoc < 10) delta = Math.min(inc, 10 - prevLoc);
      break;
    }
  }

  if (delta > 0) {
    const score = await redis.incrby(scoreKey, delta);
    await redis.expire(scoreKey, 60 * 60 * 48);
    return Number(score);
  }

  const current = await redis.get(scoreKey);
  return Number(current ?? 0);
}

export async function getEngagementScore(
  coupleId: string,
  date = getIstDateString(),
): Promise<number> {
  const score = await redis.get(engagementScoreKey(coupleId, date));
  return Number(score ?? 0);
}

export async function getEngagementMeta(
  coupleId: string,
  date = getIstDateString(),
) {
  const meta = ((await redis.hgetall(`couple:${coupleId}:score-meta:${date}`)) ??
    {}) as Record<string, unknown>;
  return {
    messages: Number(meta.messages ?? 0),
    quiz: Number(meta.quiz ?? 0),
    mood: Number(meta.mood ?? 0),
    watch: Number(meta.watch ?? 0),
    audio: Number(meta.audio ?? 0),
    location: Number(meta.location ?? 0),
  };
}
