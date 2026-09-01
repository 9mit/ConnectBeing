import { calculateBehavioralMetrics } from "./behavior";
import { buildRelationshipGraph } from "./graph";
import { calculateCompatibility } from "./compatibility";
import { analyzeConversation } from "./conversation";
import { analyzeMoodTrends } from "./mood-engine";
import { analyzeHabits } from "./habit";
import { getRecommendations } from "./recommendation";
import { generateDailyInsights, pickDiscussionQuestions } from "./templates";
import { buildMemoryIndex } from "./memory-engine";
import { LocalProvider } from "./local-provider";

export interface RieSnapshot {
  insights: string[];
  discussionPrompts: string[];
  compatibility: ReturnType<typeof calculateCompatibility>;
  habits: ReturnType<typeof analyzeHabits>;
  mood: Awaited<ReturnType<typeof analyzeMoodTrends>>;
  conversation: Awaited<ReturnType<typeof analyzeConversation>>;
  recommendations: ReturnType<typeof getRecommendations>;
  memoryCount: number;
  persona: Awaited<ReturnType<typeof LocalProvider.generateInsight>>;
}

/** Full local RIE pass — no external LLM. */
export async function runRelationshipIntelligence(
  coupleId: string,
): Promise<RieSnapshot> {
  const [metrics, graph, conversation, mood, memories] = await Promise.all([
    calculateBehavioralMetrics(coupleId),
    buildRelationshipGraph(coupleId),
    analyzeConversation(coupleId),
    analyzeMoodTrends(coupleId),
    buildMemoryIndex(coupleId),
  ]);

  const compatibility = calculateCompatibility(metrics, graph);
  const habits = analyzeHabits(metrics);
  const insights = generateDailyInsights(metrics, conversation, mood);
  const recommendations = getRecommendations(
    memories.filter((m) => m.kind === "movie").map((m) => m.title),
    mood.dominant ?? "happy",
  );
  const persona = await LocalProvider.generateInsight({
    avg_daily_messages: metrics.avgMessagesPerDay,
    avg_audio_minutes: metrics.avgVoiceCallMinutes,
    quiz_completion_rate: metrics.interactionConsistency,
    mood_logs: Object.values(mood.monthly).reduce((a, b) => a + b, 0),
    watch_nights: Math.round(metrics.movieFrequencyPerWeek),
    dominant_mood: mood.dominant ?? undefined,
  });

  return {
    insights,
    discussionPrompts: pickDiscussionQuestions(3),
    compatibility,
    habits,
    mood,
    conversation,
    recommendations,
    memoryCount: memories.length,
    persona,
  };
}
