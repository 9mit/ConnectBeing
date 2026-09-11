import { createHash } from "crypto";
import { and, asc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import {
  aiInsights,
  coupleStats,
  couples,
  moods,
  quizResponses,
  type Couple,
} from "@/db/schema";
import { petStateFromScore } from "@/lib/date-ist";
import { getEngagementMeta, getEngagementScore } from "@/lib/engagement";
import { getLocalAIProvider } from "@/lib/rie";
import { createId } from "@/lib/ids";

async function flushCoupleDay(coupleId: string, date: string) {
  const score = await getEngagementScore(coupleId, date);
  const meta = await getEngagementMeta(coupleId, date);

  const existing = await db.query.coupleStats.findFirst({
    where: and(eq(coupleStats.coupleId, coupleId), eq(coupleStats.date, date)),
  });

  if (existing) {
    await db
      .update(coupleStats)
      .set({
        messageCount: meta.messages,
        audioMinutes: meta.audio,
        locationUptimeMinutes: meta.location,
        quizCompleted: meta.quiz > 0,
        moodLogged: meta.mood > 0,
        engagementScore: Math.min(100, score),
        updatedAt: new Date(),
      })
      .where(eq(coupleStats.id, existing.id));
  } else {
    await db.insert(coupleStats).values({
      id: createId(),
      coupleId,
      date,
      messageCount: meta.messages,
      audioMinutes: meta.audio,
      locationUptimeMinutes: meta.location,
      quizCompleted: meta.quiz > 0,
      moodLogged: meta.mood > 0,
      engagementScore: Math.min(100, score),
    });
  }

  await db
    .update(couples)
    .set({ petState: petStateFromScore(score) })
    .where(eq(couples.id, coupleId));
}

async function generateDay16Persona(coupleId: string) {
  const stats = await db.query.coupleStats.findMany({
    where: eq(coupleStats.coupleId, coupleId),
  });

  const days = stats.slice(0, 15);
  const n = Math.max(days.length, 1);
  const avg = (pick: (s: (typeof days)[0]) => number) =>
    days.reduce((a, s) => a + pick(s), 0) / n;

  const moodRows = await db.query.moods.findMany({
    where: eq(moods.coupleId, coupleId),
  });
  const moodCounts = new Map<string, number>();
  for (const m of moodRows) {
    moodCounts.set(m.mood, (moodCounts.get(m.mood) ?? 0) + 1);
  }
  let dominant = "happy";
  let max = 0;
  for (const [k, v] of Array.from(moodCounts.entries())) {
    if (v > max) {
      max = v;
      dominant = k;
    }
  }

  const quizRows = await db.query.quizResponses.findMany({
    where: eq(quizResponses.coupleId, coupleId),
  });
  const avgQuiz =
    quizRows.length === 0
      ? 0
      : quizRows.reduce((a, r) => a + r.score, 0) / quizRows.length;

  const coupleHash = createHash("sha256").update(coupleId).digest("hex");
  const payload = {
    couple_hash: coupleHash,
    avg_daily_messages: avg((s) => s.messageCount),
    avg_quiz_score: avgQuiz,
    avg_audio_minutes: avg((s) => s.audioMinutes),
    avg_location_uptime_minutes: avg((s) => s.locationUptimeMinutes),
    quiz_completion_rate: days.filter((d) => d.quizCompleted).length / n,
    mood_logging_rate: days.filter((d) => d.moodLogged).length / n,
    dominant_mood: dominant,
    calibration_days: 15,
  };

  const rie = getLocalAIProvider();
  const persona = await rie.generateInsight(payload);

  await db.insert(aiInsights).values({
    id: createId(),
    coupleId,
    archetype: persona.archetype,
    strengths: persona.strengths,
    growthAreas: persona.growth_areas,
    suggestedTheme: persona.suggested_theme,
    dailyTaskStyle: persona.daily_task_style,
    rawResponse: persona,
  });

  await db
    .update(couples)
    .set({ isCalibrated: true })
    .where(eq(couples.id, coupleId));
}

export async function runNightlyCalibrationJob() {
  // Flush "yesterday" IST after midnight IST cron (18:00 UTC)
  const yesterdayDate = new Date(Date.now() + 5.5 * 3600 * 1000 - 86400000);
  const y = yesterdayDate.getUTCFullYear();
  const m = String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(yesterdayDate.getUTCDate()).padStart(2, "0");
  const flushDate = `${y}-${m}-${d}`;

  const PAGE = 50;
  let processed = 0;
  let lastCalibrationId: string | undefined = undefined;

  for (;;) {
    const active: Couple[] = await db.query.couples.findMany({
      where: lastCalibrationId
        ? and(
            eq(couples.status, "active"),
            eq(couples.isCalibrated, false),
            gt(couples.id, lastCalibrationId),
          )
        : and(eq(couples.status, "active"), eq(couples.isCalibrated, false)),
      orderBy: [asc(couples.id)],
      limit: PAGE,
    });
    if (!active.length) break;
    lastCalibrationId = active[active.length - 1].id;

    for (const couple of active) {
      try {
        await flushCoupleDay(couple.id, flushDate);

        const nextDay = Math.min(16, (couple.calibrationDay ?? 0) + 1);
        await db
          .update(couples)
          .set({ calibrationDay: nextDay })
          .where(eq(couples.id, couple.id));

        if (nextDay >= 16) {
          const existing = await db.query.aiInsights.findFirst({
            where: eq(aiInsights.coupleId, couple.id),
          });
          if (!existing) {
            await generateDay16Persona(couple.id);
          } else {
            await db
              .update(couples)
              .set({ isCalibrated: true })
              .where(eq(couples.id, couple.id));
          }
        }
        processed += 1;
      } catch {
        console.error("[cron] couple failed", couple.id);
      }
    }
    if (active.length < PAGE) break;
  }

  // Cursor-based batch update for all active couples' pet state
  let lastActiveId: string | undefined = undefined;
  for (;;) {
    const batch: Couple[] = await db.query.couples.findMany({
      where: lastActiveId
        ? and(eq(couples.status, "active"), gt(couples.id, lastActiveId))
        : eq(couples.status, "active"),
      orderBy: [asc(couples.id)],
      limit: 100,
    });
    if (!batch.length) break;
    lastActiveId = batch[batch.length - 1].id;

    for (const couple of batch) {
      try {
        const score = await getEngagementScore(couple.id, flushDate);
        await db
          .update(couples)
          .set({ petState: petStateFromScore(score) })
          .where(eq(couples.id, couple.id));
      } catch {
        console.error("[cron] pet flush failed", couple.id);
      }
    }
    if (batch.length < 100) break;
  }

  let verification = { ensured: 0, dueSoonNotified: 0 };
  try {
    const { rotateCoupleVerifications } = await import(
      "@/lib/couple-verification"
    );
    verification = await rotateCoupleVerifications();
  } catch {
    console.error("[cron] verification rotate failed");
  }

  let ephemeralPurged = 0;
  try {
    const { purgeExpiredEphemeralMedia } = await import("@/actions/media");
    const res = await purgeExpiredEphemeralMedia();
    ephemeralPurged = res.purged;
  } catch {
    console.error("[cron] ephemeral media purge failed");
  }

  return { processed, verification, ephemeralPurged };
}
