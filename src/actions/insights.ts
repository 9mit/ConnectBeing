"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { aiInsights } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { createId } from "@/lib/ids";
import { runRelationshipIntelligence } from "@/lib/rie";
import { listTimelineAction } from "@/actions/media";

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
    const timeline = await listTimelineAction();
    if (!timeline.ok) {
      return { ok: false, error: timeline.error };
    }
    return ok({
      events: timeline.data.items.slice(0, 12).map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        at: item.at,
        subtitle: item.subtitle,
        url: item.url,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
