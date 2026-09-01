import type { BehavioralMetrics } from "./behavior";

export interface HabitProfile {
  checkInHabit: number;
  movieHabit: number;
  voiceHabit: number;
  weekendHabit: number;
  overallHabitScore: number;
  suggestions: string[];
}

export function analyzeHabits(metrics: BehavioralMetrics): HabitProfile {
  const checkInHabit = Math.round(metrics.interactionConsistency * 100);
  const movieHabit = Math.min(
    100,
    Math.round((metrics.movieFrequencyPerWeek / 2) * 100),
  );
  const voiceHabit = Math.min(
    100,
    Math.round((metrics.avgVoiceCallMinutes / 20) * 100),
  );
  const weekendHabit = Math.round(metrics.weekendActivityRatio * 100);

  const overallHabitScore = Math.round(
    checkInHabit * 0.4 + movieHabit * 0.2 + voiceHabit * 0.2 + weekendHabit * 0.2,
  );

  const suggestions: string[] = [];
  if (checkInHabit < 50) {
    suggestions.push("Set a two-message daily check-in habit.");
  }
  if (movieHabit < 40) {
    suggestions.push("Schedule one MadLove Together night this week.");
  }
  if (voiceHabit < 40) {
    suggestions.push("Try a short push-to-talk call tonight.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Keep your current rhythm — consistency is compounding.");
  }

  return {
    checkInHabit,
    movieHabit,
    voiceHabit,
    weekendHabit,
    overallHabitScore,
    suggestions,
  };
}
