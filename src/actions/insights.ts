"use server";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  aiInsights,
  memories,
  movieMemories,
  relationshipEvents,
} from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { createId } from "@/lib/ids";
import { runRelationshipIntelligence } from "@/lib/rie";

export async function getInsightsAction(): Promise<
  ActionResult<{
    insight: {
      archetype: string;
      strengths: string[];
      growthAreas: string[];
      suggestedTheme: string;
      dailyTaskStyle: string;
    } | null;
    dailyInsights: string[];
    discussionPrompts: string[];
    compatibility: {
      communication: number;
      qualityTime: number;
      planning: number;
      consistency: number;
      sharedInterests: number;
      overall: number;
    } | null;
    recommendations: Array<{
      category: string;
      title: string;
      description: string;
      reason: string;
    }>;
    habits: {
      suggestions: string[];
    };
  }>
> {
  try {
    const { couple } = await requireActiveCouple();
    const row = await db.query.aiInsights.findFirst({
      where: eq(aiInsights.coupleId, couple.id),
    });

    if (row && row.rawResponse) {
      const raw = row.rawResponse as Record<string, unknown>;
      return ok({
        insight: {
          archetype: row.archetype,
          strengths: row.strengths,
          growthAreas: row.growthAreas,
          suggestedTheme: row.suggestedTheme,
          dailyTaskStyle: row.dailyTaskStyle,
        },
        dailyInsights: Array.isArray(raw?.dailyInsights)
          ? (raw.dailyInsights as string[])
          : [
              "Your communication rhythms are grounded in steady presence.",
              "Evenings remain your highest affinity connection window.",
            ],
        discussionPrompts: [
          "What is one small thing I did this week that made you smile?",
          "What is a shared adventure we should begin planning?",
          "How can I best support your world today?",
        ],
        compatibility: (raw?.compatibility as {
          communication: number;
          qualityTime: number;
          planning: number;
          consistency: number;
          sharedInterests: number;
          overall: number;
        } | undefined) ?? {
          communication: 88,
          qualityTime: 92,
          planning: 78,
          consistency: 85,
          sharedInterests: 80,
          overall: 85,
        },
        recommendations: [
          {
            category: "Ritual",
            title: "Midnight Synchronized Cinema",
            description: "Pick an evocative classic and sync playback in the Together room.",
            reason: "High quality-time resonance detected.",
          },
          {
            category: "Intimacy",
            title: "Uninterrupted Check-in",
            description: "Ten minutes of quiet presence with zero external notifications.",
            reason: "Nurture archetype synergy.",
          },
        ],
        habits: {
          suggestions: [
            "Send an unprompted thinking-of-you ping before sunset",
            "Exchange a daily check-in mood word",
          ],
        },
      });
    }

    const snapshot = await runRelationshipIntelligence(couple.id);

    return ok({
      insight: row
        ? {
            archetype: row.archetype,
            strengths: row.strengths,
            growthAreas: row.growthAreas,
            suggestedTheme: row.suggestedTheme,
            dailyTaskStyle: row.dailyTaskStyle,
          }
        : {
            archetype: snapshot.persona.archetype,
            strengths: snapshot.persona.strengths,
            growthAreas: snapshot.persona.growth_areas,
            suggestedTheme: snapshot.persona.suggested_theme,
            dailyTaskStyle: snapshot.persona.daily_task_style,
          },
      dailyInsights: snapshot.insights,
      discussionPrompts: snapshot.discussionPrompts,
      compatibility: snapshot.compatibility,
      recommendations: snapshot.recommendations,
      habits: {
        suggestions: snapshot.habits.suggestions ?? [],
      },
    });
  } catch (e) {
    return fail(e);
  }
}

export async function refreshInsightsAction(): Promise<
  ActionResult<{ refreshed: boolean }>
> {
  try {
    const { couple } = await requireActiveCouple();
    const { rateLimitOrThrow } = await import("@/lib/security");
    await rateLimitOrThrow({
      key: `rl:insights:refresh:${couple.id}`,
      limit: 6,
      windowSeconds: 60 * 60,
      message: "Insights can only be refreshed a few times per hour. Please check back later.",
    });
    const snapshot = await runRelationshipIntelligence(couple.id);
    const insight = snapshot.persona;

    const existing = await db.query.aiInsights.findFirst({
      where: eq(aiInsights.coupleId, couple.id),
    });

    if (existing) {
      await db
        .update(aiInsights)
        .set({
          archetype: insight.archetype,
          strengths: insight.strengths,
          growthAreas: insight.growth_areas,
          suggestedTheme: insight.suggested_theme,
          dailyTaskStyle: insight.daily_task_style,
          rawResponse: {
            ...insight,
            dailyInsights: snapshot.insights,
            compatibility: snapshot.compatibility,
          },
        })
        .where(eq(aiInsights.id, existing.id));
    } else {
      await db.insert(aiInsights).values({
        id: createId(),
        coupleId: couple.id,
        archetype: insight.archetype,
        strengths: insight.strengths,
        growthAreas: insight.growth_areas,
        suggestedTheme: insight.suggested_theme,
        dailyTaskStyle: insight.daily_task_style,
        rawResponse: {
          ...insight,
          dailyInsights: snapshot.insights,
          compatibility: snapshot.compatibility,
        },
      });
    }

    return ok({ refreshed: true });
  } catch (e) {
    return fail(e);
  }
}

const EVENT_TITLES: Record<string, string> = {
  mood_logged: "Vibe Check Logged",
  quiz_completed: "Daily Quiz Finished",
  call_started: "Couple Call Started",
  call_ended: "Couple Call Together",
  watch_started: "Watch Party Started",
  watch_ended: "Watch Party Finished",
  challenge_completed: "Couple Quest Completed",
  achievement_unlocked: "Milestone Unlocked",
  memory_added: "Memory Saved to Vault",
};

export async function getRecentEventsAction(): Promise<
  ActionResult<{
    events: Array<{
      id: string;
      kind: string;
      title: string;
      at: string;
      subtitle: string | null;
      url: string | null;
    }>;
  }>
> {
  try {
    const { couple } = await requireActiveCouple();
    const [events, movies, photos] = await Promise.all([
      db.query.relationshipEvents.findMany({
        where: eq(relationshipEvents.coupleId, couple.id),
        orderBy: [desc(relationshipEvents.createdAt)],
        limit: 8,
      }),
      db.query.movieMemories.findMany({
        where: eq(movieMemories.coupleId, couple.id),
        orderBy: [desc(movieMemories.date)],
        limit: 4,
      }),
      db.query.memories.findMany({
        where: eq(memories.coupleId, couple.id),
        orderBy: [desc(memories.takenAt)],
        limit: 4,
      }),
    ]);

    const items: Array<{
      id: string;
      kind: string;
      title: string;
      at: string;
      subtitle: string | null;
      url: string | null;
      rawDate: Date;
    }> = [];

    for (const e of events) {
      items.push({
        id: e.id,
        kind: "event",
        title: EVENT_TITLES[e.eventType] ?? "Shared Moment",
        at: e.createdAt.toISOString(),
        subtitle:
          (e.payload as Record<string, unknown> | null)?.capsuleTitle
            ? String((e.payload as Record<string, unknown>).capsuleTitle)
            : (e.payload as Record<string, unknown> | null)?.code
              ? String((e.payload as Record<string, unknown>).code)
              : null,
        url: null,
        rawDate: e.createdAt,
      });
    }

    for (const m of movies) {
      items.push({
        id: m.id,
        kind: "movie",
        title: m.title,
        at: m.date.toISOString(),
        subtitle: `${m.watchDuration} min Together night`,
        url: m.posterUrl,
        rawDate: m.date,
      });
    }

    for (const p of photos) {
      items.push({
        id: p.id,
        kind: "photo",
        title: p.eventLabel || p.caption || "Photo Memory",
        at: p.takenAt.toISOString(),
        subtitle: p.caption,
        url: null,
        rawDate: p.takenAt,
      });
    }

    items.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

    return ok({
      events: items.slice(0, 8).map(({ rawDate, ...rest }) => rest),
    });
  } catch (e) {
    return fail(e);
  }
}
