import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { coupleStats, relationshipEvents } from "@/db/schema";
import { LocalProvider } from "@/lib/rie/providers";
import type { RelationshipInsight } from "@/lib/rie/types";

/** @deprecated Prefer runRelationshipIntelligence — single live RIE spine. */
export async function analyzeCoupleFromEvents(
  coupleId: string,
): Promise<RelationshipInsight> {
  const events = await db.query.relationshipEvents.findMany({
    where: eq(relationshipEvents.coupleId, coupleId),
    orderBy: [desc(relationshipEvents.createdAt)],
    limit: 200,
  });

  const stats = await db.query.coupleStats.findMany({
    where: eq(coupleStats.coupleId, coupleId),
    orderBy: [desc(coupleStats.date)],
    limit: 14,
  });

  const messageEvents = events.filter((e) => e.eventType === "message_sent").length;
  const moodEvents = events.filter((e) => e.eventType === "mood_logged").length;
  const quizEvents = events.filter((e) => e.eventType === "quiz_completed").length;
  const watchEvents = events.filter((e) => e.eventType === "watch_ended").length;
  const callEvents = events.filter((e) => e.eventType === "call_ended").length;

  const days = Math.max(stats.length, 1);
  const avgMessages =
    stats.reduce((s, r) => s + r.messageCount, 0) / days || messageEvents / 7;
  const avgAudio =
    stats.reduce((s, r) => s + r.audioMinutes, 0) / days || callEvents * 5;
  const quizRate = quizEvents / Math.max(days, 7);

  return LocalProvider.generateInsight({
    avg_daily_messages: avgMessages,
    avg_audio_minutes: avgAudio,
    avg_quiz_score: quizRate * 3,
    quiz_completion_rate: quizRate,
    mood_logs: moodEvents,
    watch_nights: watchEvents,
  });
}
