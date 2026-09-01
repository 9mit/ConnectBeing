export type RieEventType =
  | "message_sent"
  | "movie_started"
  | "movie_finished"
  | "quiz_completed"
  | "call_started"
  | "call_ended"
  | "mood_updated"
  | "photo_saved"
  | "reaction_sent"
  | "pet_fed";

export interface RieEvent {
  id: string;
  coupleId: string;
  userId: string;
  eventType: RieEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export type RelationshipArchetype = "challenge" | "nurture" | "adventure";

export interface RelationshipInsight {
  archetype: RelationshipArchetype;
  strengths: string[];
  growth_areas: string[];
  suggested_theme: "rose" | "violet" | "amber" | "sky";
  daily_task_style: "challenge" | "nurture" | "adventure";
}

export interface WatchSessionSummary {
  recap: string;
  bestMoments: string[];
  questions: string[];
}

export interface QuizQuestionData {
  index: number;
  question: string;
  correct_answer: string;
  distractors: string[];
}

export interface InsightStatsPayload {
  avg_daily_messages?: number;
  avg_audio_minutes?: number;
  avg_quiz_score?: number;
  quiz_completion_rate?: number;
  mood_logs?: number;
  watch_nights?: number;
  dominant_mood?: string;
}

export interface ConflictMediation {
  steps: string[];
  prompt: string;
}

export interface AIProvider {
  generateQuiz(coupleId: string): Promise<QuizQuestionData[]>;
  generateInsight(statsPayload: InsightStatsPayload): Promise<RelationshipInsight>;
  generateSummary(
    messages: string[],
    sessionTitle: string,
    durationMinutes: number,
  ): Promise<WatchSessionSummary>;
  mediateConflict(context: {
    tensionHint?: string;
  }): Promise<ConflictMediation>;
}
