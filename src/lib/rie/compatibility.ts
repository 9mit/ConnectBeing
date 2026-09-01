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

export function calculateCompatibility(
  metrics: BehavioralMetrics,
  graph: RelationshipGraph,
): CompatibilityScores {
  const balanceFactor = 1 - Math.abs(metrics.conversationBalance - 0.5) * 2;
  const volumeFactor = Math.min(metrics.avgMessagesPerDay / 20, 1);
  const communication = Math.round(
    (balanceFactor * 0.6 + volumeFactor * 0.4) * 100,
  );

  const voiceFactor = Math.min(metrics.avgVoiceCallMinutes / 30, 1);
  const movieFactor = Math.min(metrics.movieFrequencyPerWeek / 2, 1);
  const qualityTime = Math.round((voiceFactor * 0.5 + movieFactor * 0.5) * 100);

  const plannedNodes = graph.edges.filter((e) => e.type === "planned").length;
  const completedNodes = graph.edges.filter(
    (e) => e.type === "watched" || e.type === "completed",
  ).length;
  const planningRatio =
    completedNodes + plannedNodes > 0
      ? completedNodes / (completedNodes + plannedNodes)
      : 0.5;
  const planning = Math.round(planningRatio * 100);

  const consistency = Math.round(metrics.interactionConsistency * 100);

  const movieNodes = graph.nodes.filter((n) => n.type === "movie");
  const movieGenres = new Set(
    movieNodes.map((n) => String(n.properties?.provider || "other")),
  );
  const sharedInterests =
    Math.min(Math.round((movieGenres.size / 4) * 100), 100) || 50;

  const responseFactor = Math.min(
    120 / Math.max(metrics.avgResponseTimeSeconds, 1),
    1,
  );
  const humor = Math.round(
    (metrics.weekendActivityRatio * 0.5 + responseFactor * 0.5) * 100,
  );
  const adventure = Math.round(
    (movieFactor * 0.6 + metrics.weekendActivityRatio * 0.4) * 100,
  );
  const support = Math.round(consistency * 0.5 + communication * 0.5);
  const conflictRecovery = Math.round(
    (balanceFactor * 0.7 + metrics.interactionConsistency * 0.3) * 100,
  );
  const trustSignals = Math.round(
    consistency * 0.4 + qualityTime * 0.3 + communication * 0.3,
  );

  const overall = Math.round(
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
