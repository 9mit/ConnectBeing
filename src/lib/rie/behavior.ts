import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { coupleStats, messages, watchSessions } from "@/db/schema";

export interface BehavioralMetrics {
  avgMessagesPerDay: number;
  avgResponseTimeSeconds: number;
  interactionConsistency: number; // 0 to 1
  conversationBalance: number; // 0 to 1 (0.5 is perfect balance)
  movieFrequencyPerWeek: number;
  avgVoiceCallMinutes: number;
  weekendActivityRatio: number;
  nightActivityRatio: number;
  morningActivityRatio: number;
}

export async function calculateBehavioralMetrics(coupleId: string): Promise<BehavioralMetrics> {
  const stats = await db.query.coupleStats.findMany({
    where: eq(coupleStats.coupleId, coupleId),
  });

  const allMsgs = await db.query.messages.findMany({
    where: eq(messages.coupleId, coupleId),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });

  const movies = await db.query.watchSessions.findMany({
    where: and(eq(watchSessions.coupleId, coupleId), eq(watchSessions.status, "completed")),
  });

  // 1. Avg messages per day
  const totalDays = Math.max(stats.length, 1);
  const totalMessages = stats.reduce((sum, s) => sum + s.messageCount, 0);
  const avgMessagesPerDay = totalMessages / totalDays;

  // 2. Average response time in seconds
  let totalResponseTime = 0;
  let responseCount = 0;
  for (let i = 1; i < allMsgs.length; i++) {
    const current = allMsgs[i];
    const prev = allMsgs[i - 1];
    if (current && prev && current.senderId !== prev.senderId) {
      const diff = (current.createdAt.getTime() - prev.createdAt.getTime()) / 1000;
      // Filter out giant gaps (e.g. overnight sleep, gaps > 6 hours) to represent active conversation responses
      if (diff > 0 && diff < 21600) {
        totalResponseTime += diff;
        responseCount++;
      }
    }
  }
  const avgResponseTimeSeconds = responseCount > 0 ? totalResponseTime / responseCount : 60; // default 60s

  // 3. Daily interaction consistency
  const activeDays = stats.filter((s) => s.messageCount > 0 || s.quizCompleted || s.moodLogged).length;
  const interactionConsistency = activeDays / totalDays;

  // 4. Conversation balance
  let userAMessages = 0;
  let userBMessages = 0;
  if (allMsgs.length > 0) {
    const senderIds = Array.from(new Set(allMsgs.map((m) => m.senderId)));
    const userAId = senderIds[0];
    for (const m of allMsgs) {
      if (m.senderId === userAId) userAMessages++;
      else userBMessages++;
    }
  }
  const totalBalanceMsgs = userAMessages + userBMessages;
  const conversationBalance = totalBalanceMsgs > 0 ? Math.min(userAMessages, userBMessages) / totalBalanceMsgs : 0.5;

  // 5. Movie frequency per week
  const movieFrequencyPerWeek = movies.length > 0 ? (movies.length / totalDays) * 7 : 0;

  // 6. Voice call duration
  const totalVoiceMinutes = stats.reduce((sum, s) => sum + s.audioMinutes, 0);
  const avgVoiceCallMinutes = totalVoiceMinutes / totalDays;

  // 7. Time of day ratios
  let morning = 0;
  let night = 0;
  let weekend = 0;
  for (const m of allMsgs) {
    const date = new Date(m.createdAt);
    const hour = date.getHours();
    const day = date.getDay();

    if (hour >= 6 && hour < 12) morning++;
    if (hour >= 22 || hour < 5) night++;
    if (day === 0 || day === 6) weekend++; // Sat/Sun
  }

  const totalTimeRatios = allMsgs.length || 1;
  const morningActivityRatio = morning / totalTimeRatios;
  const nightActivityRatio = night / totalTimeRatios;
  const weekendActivityRatio = weekend / totalTimeRatios;

  return {
    avgMessagesPerDay,
    avgResponseTimeSeconds,
    interactionConsistency,
    conversationBalance,
    movieFrequencyPerWeek,
    avgVoiceCallMinutes,
    weekendActivityRatio,
    nightActivityRatio,
    morningActivityRatio,
  };
}
