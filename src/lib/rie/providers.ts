import type {
  AIProvider,
  ConflictMediation,
  InsightStatsPayload,
  QuizQuestionData,
  RelationshipInsight,
  WatchSessionSummary,
} from "./types";
import { LocalProvider as CoreLocal } from "./local-provider";

export const LocalProvider: AIProvider = CoreLocal;

export const NullProvider: AIProvider = {
  async generateQuiz() {
    return [];
  },
  async generateInsight(): Promise<RelationshipInsight> {
    return {
      archetype: "nurture",
      strengths: [],
      growth_areas: [],
      suggested_theme: "rose",
      daily_task_style: "nurture",
    };
  },
  async generateSummary(): Promise<WatchSessionSummary> {
    return { recap: "", bestMoments: [], questions: [] };
  },
  async mediateConflict(): Promise<ConflictMediation> {
    return {
      steps: ["Pause", "Reflect", "Reconnect"],
      prompt: "Take a short break, then share one feeling each.",
    };
  },
};

function disabledProvider(name: string): AIProvider {
  const err = () => {
    throw new Error(
      `${name} is optional and disabled. MadLove core uses LocalProvider only.`,
    );
  };
  return {
    generateQuiz: err,
    generateInsight: err,
    generateSummary: err,
    mediateConflict: err,
  };
}

/** Future adapters — never required, never default. */
export const FutureGroqProvider = disabledProvider("FutureGroqProvider");
export const FutureGeminiProvider = disabledProvider("FutureGeminiProvider");
export const FutureOpenAIProvider = disabledProvider("FutureOpenAIProvider");

export type {
  AIProvider,
  InsightStatsPayload,
  QuizQuestionData,
  RelationshipInsight,
  WatchSessionSummary,
};
