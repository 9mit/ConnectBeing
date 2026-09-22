"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { onboardingProfiles, quizQuestions, quizResponses } from "@/db/schema";
import { createPartnerNotification } from "@/actions/notifications";
import { tryUnlockAchievement } from "@/lib/achievements";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActiveCouple } from "@/lib/auth";
import { bumpChallengeProgress } from "@/lib/challenges";
import { getIstDateString, getIstYesterdayString, quizCacheKey } from "@/lib/date-ist";
import { incrementEngagement } from "@/lib/engagement";
import { AppError } from "@/lib/errors";
import { appendRelationshipEvent } from "@/lib/events";
import { createId } from "@/lib/ids";
import { redis } from "@/lib/redis";
import { getLocalAIProvider } from "@/lib/rie";
import { quizArraySchema, quizAnswerSchema } from "@/lib/validations";

type QuizQuestion = {
  index: number;
  question: string;
  correct_answer: string;
  distractors: string[];
};

export async function getDailyQuizAction(): Promise<
  ActionResult<{
    questionSetId: string;
    date: string;
    questions: Array<{
      index: number;
      question: string;
      options: string[];
    }>;
    alreadyAnswered: boolean;
  }>
> {
  try {
    const { user, couple } = await requireActiveCouple();
    const date = getIstDateString();
    const cacheKey = quizCacheKey(couple.id, date);

    let questions: QuizQuestion[] | null = null;
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      questions = quizArraySchema.parse(
        typeof cached === "string" ? JSON.parse(cached) : cached,
      );
    }

    let questionSet = await db.query.quizQuestions.findFirst({
      where: and(
        eq(quizQuestions.coupleId, couple.id),
        eq(quizQuestions.date, date),
      ),
    });

    if (!questionSet) {
      if (!questions) {
        questions = await generateQuizForCouple(couple.id);
        await redis.set(cacheKey, JSON.stringify(questions), {
          ex: 60 * 60 * 24,
        });
      }

      const id = createId();
      await db.insert(quizQuestions).values({
        id,
        coupleId: couple.id,
        date,
        questions,
      });
      questionSet = await db.query.quizQuestions.findFirst({
        where: eq(quizQuestions.id, id),
      });
    } else if (!questions) {
      questions = quizArraySchema.parse(questionSet.questions);
      await redis.set(cacheKey, JSON.stringify(questions), {
        ex: 60 * 60 * 24,
      });
    }

    if (!questionSet || !questions) {
      throw new AppError("INTERNAL_ERROR", "Failed to load daily quiz.", 500);
    }

    const existing = await db.query.quizResponses.findFirst({
      where: and(
        eq(quizResponses.questionSetId, questionSet.id),
        eq(quizResponses.userId, user.id),
      ),
    });

    return ok({
      questionSetId: questionSet.id,
      date,
      alreadyAnswered: Boolean(existing),
      questions: questions.map((q) => ({
        index: q.index,
        question: q.question,
        options: shuffle([q.correct_answer, ...q.distractors]),
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function submitQuizAction(
  input: unknown,
): Promise<ActionResult<{ score: number; maxScore: number; streak: number }>> {
  try {
    const parsed = quizAnswerSchema.parse(input);
    const { user, couple } = await requireActiveCouple();

    const questionSet = await db.query.quizQuestions.findFirst({
      where: and(
        eq(quizQuestions.id, parsed.questionSetId),
        eq(quizQuestions.coupleId, couple.id),
      ),
    });

    if (!questionSet) {
      throw new AppError("NOT_FOUND", "Quiz not found.", 404);
    }

    const existing = await db.query.quizResponses.findFirst({
      where: and(
        eq(quizResponses.questionSetId, questionSet.id),
        eq(quizResponses.userId, user.id),
      ),
    });

    if (existing) {
      throw new AppError("FORBIDDEN", "Quiz already submitted today.", 400);
    }

    const graded = quizArraySchema.parse(questionSet.questions);
    if (parsed.answers.length !== graded.length) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Expected ${graded.length} answer(s).`,
        400,
      );
    }

    let score = 0;
    graded.forEach((q, i) => {
      if (
        parsed.answers[i]?.trim().toLowerCase() ===
        q.correct_answer.trim().toLowerCase()
      ) {
        score += 1;
      }
    });

    await db.insert(quizResponses).values({
      id: createId(),
      questionSetId: questionSet.id,
      coupleId: couple.id,
      userId: user.id,
      answers: parsed.answers,
      score,
    });

    await incrementEngagement(couple.id, "quiz");
    await appendRelationshipEvent({
      coupleId: couple.id,
      actorUserId: user.id,
      eventType: "quiz_completed",
      payload: { score, maxScore: graded.length },
    });
    await bumpChallengeProgress({
      coupleId: couple.id,
      actorUserId: user.id,
      code: "shared_quiz",
    });
    await tryUnlockAchievement(couple.id, user.id, "first_quiz");

    const streakKey = `quiz-streak:${user.id}`;
    const lastDateKey = `quiz-last-date:${user.id}`;
    const today = getIstDateString();
    const yesterday = getIstYesterdayString();
    const lastDate = await redis.get<string>(lastDateKey);

    // Reset streak if last quiz was NOT yesterday or today (i.e. user missed a day)
    if (lastDate && lastDate !== yesterday && lastDate !== today) {
      await redis.del(streakKey);
    }

    const streak = await redis.incr(streakKey);
    await redis.expire(streakKey, 60 * 60 * 24 * 40);
    await redis.set(lastDateKey, today, { ex: 60 * 60 * 24 * 40 });

    const partnerId =
      couple.userAId === user.id ? couple.userBId : couple.userAId;

    const profile = await db.query.onboardingProfiles.findFirst({
      where: eq(onboardingProfiles.userId, user.id),
    });
    const senderName = profile?.name?.trim() || "Your partner";

    if (partnerId) {
      await createPartnerNotification({
        coupleId: couple.id,
        senderUserId: user.id,
        partnerUserId: partnerId,
        title: "❓ Daily Quiz Completed",
        body: `${senderName} submitted today's quiz answers! See if you match.`,
        kind: "quiz",
        link: "/quiz",
      }).catch(() => {});
    }

    return ok({ score, maxScore: graded.length, streak });
  } catch (e) {
    return fail(e);
  }
}

async function generateQuizForCouple(
  coupleId: string,
): Promise<QuizQuestion[]> {
  return getLocalAIProvider().generateQuiz(coupleId);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
