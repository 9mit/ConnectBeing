import type {
  AIProvider,
  InsightStatsPayload,
  QuizQuestionData,
  RelationshipInsight,
  WatchSessionSummary,
} from "./types";
import {
  getOfflineQuizQuestions,
  generateMovieDiscussionPrompts,
  generateConflictMediation,
} from "./templates";

export const LocalProvider: AIProvider = {
  async generateQuiz(coupleId: string): Promise<QuizQuestionData[]> {
    void coupleId;
    return getOfflineQuizQuestions(3);
  },

  async generateInsight(
    statsPayload: InsightStatsPayload,
  ): Promise<RelationshipInsight> {
    const avgMessages = statsPayload.avg_daily_messages || 0;
    const avgVoice = statsPayload.avg_audio_minutes || 0;
    const quizRate = statsPayload.quiz_completion_rate || 0;

    let archetype: RelationshipInsight["archetype"] = "nurture";
    let strengths: string[] = ["Consistent connection"];
    let growth_areas: string[] = ["Increase shared activities"];
    let suggested_theme: RelationshipInsight["suggested_theme"] = "rose";
    let daily_task_style: RelationshipInsight["daily_task_style"] = "nurture";

    if (avgMessages > 25) {
      archetype = "challenge";
      strengths = ["Highly communicative", "Frequent text check-ins"];
      growth_areas = ["Set aside designated screen-free quality time"];
      suggested_theme = "amber";
      daily_task_style = "challenge";
    } else if (avgVoice > 15 || quizRate > 0.8) {
      archetype = "nurture";
      strengths = ["Strong emotional presence", "High daily consistency"];
      growth_areas = ["Try exploring new shared outdoor activities"];
      suggested_theme = "violet";
      daily_task_style = "nurture";
    } else if ((statsPayload.watch_nights ?? 0) >= 2) {
      archetype = "adventure";
      strengths = ["Shared entertainment rituals", "Flexible scheduling"];
      growth_areas = ["Work on establishing daily check-in habits"];
      suggested_theme = "sky";
      daily_task_style = "adventure";
    }

    if ((statsPayload.mood_logs ?? 0) >= 10) {
      strengths = [...strengths, "Regular emotional check-ins"];
    }

    return {
      archetype,
      strengths,
      growth_areas,
      suggested_theme,
      daily_task_style,
    };
  },

  async generateSummary(
    messages: string[],
    sessionTitle: string,
    durationMinutes: number,
  ): Promise<WatchSessionSummary> {
    const recap =
      messages.length > 0
        ? `You spent about ${durationMinutes} minutes with "${sessionTitle}" and kept the conversation going.`
        : `A peaceful ${durationMinutes}-minute watch of "${sessionTitle}" — comfortable silence counts too.`;

    const bestMoments = messages
      .slice(0, 3)
      .map((m) => `Shared reaction noted (${m.length} chars)`)
      .concat(
        durationMinutes >= 90
          ? ["Long shared watch session"]
          : durationMinutes >= 30
            ? ["Solid shared watch block"]
            : [],
      )
      .slice(0, 3);

    const questions = generateMovieDiscussionPrompts(sessionTitle, "other");

    return {
      recap,
      bestMoments:
        bestMoments.length > 0
          ? bestMoments
          : ["Quiet companionship during the show"],
      questions,
    };
  },

  async mediateConflict(context: {
    tensionHint?: string;
  }): Promise<{ steps: string[]; prompt: string }> {
    return generateConflictMediation(context.tensionHint);
  },
};
