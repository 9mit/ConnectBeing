import { BehavioralMetrics } from "./behavior";
import { RelationshipGraph } from "./graph";

export interface CompatibilityScores {
  communication: number;
  qualityTime: number;
  planning: number;
  consistency: number;
  sharedInterests: number;
  humor: number;
  adventure: number;
  support: number;
  conflictRecovery: number;
  trustSignals: number;
  overall: number;
}

function clamp(val: number, min = 0, max = 100): number {
  if (Number.isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

export function calculateCompatibility(
  metrics: BehavioralMetrics,
  graph: RelationshipGraph,
): CompatibilityScores {
  const balance = clamp(metrics.conversationBalance, 0, 1);
  const balanceFactor = clamp(1 - Math.abs(balance - 0.5) * 2, 0, 1);
  const volumeFactor = clamp(metrics.avgMessagesPerDay / 20, 0, 1);
  const communication = clamp(
    Math.round((balanceFactor * 0.6 + volumeFactor * 0.4) * 100),
  );

  const voiceFactor = clamp(metrics.avgVoiceCallMinutes / 30, 0, 1);
  const movieFactor = clamp(metrics.movieFrequencyPerWeek / 2, 0, 1);
  const qualityTime = clamp(
    Math.round((voiceFactor * 0.5 + movieFactor * 0.5) * 100),
  );

  const plannedNodes = graph.edges.filter((e) => e.type === "planned").length;
  const completedNodes = graph.edges.filter(
    (e) => e.type === "watched" || e.type === "completed",
  ).length;
  const planningRatio =
    completedNodes + plannedNodes > 0
      ? completedNodes / (completedNodes + plannedNodes)
      : 0.5;
  const planning = clamp(Math.round(planningRatio * 100));

  const consistency = clamp(Math.round(clamp(metrics.interactionConsistency, 0, 1) * 100));

  const movieNodes = graph.nodes.filter((n) => n.type === "movie");
  const movieGenres = new Set(
    movieNodes.map((n) => String(n.properties?.provider || "other")),
  );
  const sharedInterests = clamp(
    Math.min(Math.round((movieGenres.size / 4) * 100), 100) || 50,
  );

  const responseFactor = clamp(
    120 / Math.max(metrics.avgResponseTimeSeconds || 1, 1),
    0,
    1,
  );
  const weekendRatio = clamp(metrics.weekendActivityRatio, 0, 1);
  const humor = clamp(
    Math.round((weekendRatio * 0.5 + responseFactor * 0.5) * 100),
  );
  const adventure = clamp(
    Math.round((movieFactor * 0.6 + weekendRatio * 0.4) * 100),
  );
  const support = clamp(Math.round(consistency * 0.5 + communication * 0.5));
  const conflictRecovery = clamp(
    Math.round((balanceFactor * 0.7 + clamp(metrics.interactionConsistency, 0, 1) * 0.3) * 100),
  );
  const trustSignals = clamp(
    Math.round(consistency * 0.4 + qualityTime * 0.3 + communication * 0.3),
  );

  const overall = clamp(
    Math.round(
      communication * 0.18 +
        qualityTime * 0.16 +
        planning * 0.1 +
        consistency * 0.14 +
        sharedInterests * 0.08 +
        humor * 0.08 +
        adventure * 0.08 +
        support * 0.08 +
        conflictRecovery * 0.05 +
        trustSignals * 0.05,
    ),
  );

  return {
    communication,
    qualityTime,
    planning,
    consistency,
    sharedInterests,
    humor,
    adventure,
    support,
    conflictRecovery,
    trustSignals,
    overall,
  };
}
