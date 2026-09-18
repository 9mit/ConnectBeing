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

  const meta = ((await redis.hgetall(metaKey)) ?? {}) as Record<string, unknown>;
  const messages = Number(meta.messages ?? 0);
  const quiz = Number(meta.quiz ?? 0);
  const mood = Number(meta.mood ?? 0);
  const watch = Number(meta.watch ?? 0);
  const audio = Number(meta.audio ?? 0);
  const location = Number(meta.location ?? 0);

  let delta = 0;
  const next = { messages, quiz, mood, watch, audio, location };

  switch (event) {
    case "message": {
      if (messages < 5) {
        delta = 5;
        next.messages = messages + 1;
      }
      break;
    }
    case "quiz": {
      if (quiz === 0) {
        delta = 25;
        next.quiz = 1;
      }
      break;
    }
    case "mood": {
      if (mood === 0) {
        delta = 20;
        next.mood = 1;
      }
      break;
    }
    case "watch": {
      if (watch === 0) {
        delta = 15;
        next.watch = 1;
      }
      break;
    }
    case "audio_minute": {
      const add = Math.min(amount, Math.max(0, 20 - audio));
      delta = add;
      next.audio = audio + add;
      break;
    }
    case "location_minute": {
      const add = Math.min(amount, Math.max(0, 10 - location));
      delta = add;
      next.location = location + add;
      break;
    }
  }

  if (delta > 0) {
    await redis.hset(metaKey, {
      messages: String(next.messages),
      quiz: String(next.quiz),
      mood: String(next.mood),
      watch: String(next.watch),
      audio: String(next.audio),
      location: String(next.location),
    });
    await redis.expire(metaKey, 60 * 60 * 48);
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
