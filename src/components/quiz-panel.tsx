"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Sparkles } from "lucide-react";

import { getDailyQuizAction, submitQuizAction } from "@/actions/quiz";

export function QuizPanel({
  initialQuiz,
}: {
  initialQuiz?: Awaited<ReturnType<typeof getDailyQuizAction>> | null;
} = {}) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getDailyQuizAction>
  > | null>(initialQuiz ?? null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function loadQuiz() {
    const res = await getDailyQuizAction();
    setData(res);
  }

  useEffect(() => {
    if (!initialQuiz) {
      void loadQuiz();
    }
  }, [initialQuiz]);

  if (!data) {
    return (
      <div className="py-20 text-center text-xs text-zinc-400 italic">
        Loading today’s questions…
      </div>
    );
  }

  if (!data.ok) {
    return (
      <p className="p-4 rounded-xl text-xs font-medium text-rose-300 bg-rose-950/40 border border-rose-500/20 text-center">
        {data.error.message}
      </p>
    );
  }

  const quiz = data.data;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-white/[0.06] pb-6">
        <div>
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-400">
            Daily Ritual
          </span>
          <h1 className="text-3xl font-serif font-light text-[#f7f6f2] tracking-tight mt-1">
            Couple Discovery Quiz
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Playful, intimate questions to learn each other deeper every day.
          </p>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono self-start sm:self-auto">
          {quiz.date}
        </span>
      </div>

      {quiz.alreadyAnswered ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0e1017] p-8 text-center space-y-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-amber-200">
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-serif font-light text-[#f7f6f2]">
            Daily Discovery Complete
          </h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            You’ve completed today’s questions. Check in again tomorrow for fresh cards to explore together.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {quiz.questions.map((q, qi) => (
            <div
              key={q.index}
              className="rounded-2xl border border-white/[0.06] bg-[#0e1017] p-5 sm:p-6 space-y-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono text-zinc-400 pt-0.5">
                  0{qi + 1}
                </span>
                <h3 className="text-base font-serif font-light text-[#f7f6f2] leading-snug">
                  {q.question}
                </h3>
              </div>

              <div className="grid gap-2.5 pl-0 sm:pl-6">
                {q.options.map((opt) => {
                  const isSelected = answers[qi] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        const next = [...answers];
                        next[qi] = opt;
                        setAnswers(next);
                      }}
                      className={`w-full px-4 py-3.5 min-h-[46px] rounded-xl border text-left text-xs sm:text-sm font-medium transition-all flex items-center justify-between touch-manipulation active:scale-[0.99] ${
                        isSelected
                          ? "border-white/25 bg-white/15 text-white shadow-sm"
                          : "border-white/[0.06] bg-white/[0.02] text-zinc-300 hover:border-white/15 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      <span className="leading-snug">{opt}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-white shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Submit Action */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={
                pending ||
                answers.filter(Boolean).length !== quiz.questions.length
              }
              onClick={() => {
                startTransition(async () => {
                  const res = await submitQuizAction({
                    questionSetId: quiz.questionSetId,
                    answers,
                  });
                  if (!res.ok) {
                    setError(res.error.message);
                    return;
                  }
                  setResult(
                    `Answers saved. Harmony Score: ${res.data.score}/${res.data.maxScore}`,
                  );
                  setData({
                    ok: true,
                    data: { ...quiz, alreadyAnswered: true },
                  });
                });
              }}
              className="w-full sm:w-auto px-6 py-3 min-h-[46px] rounded-full bg-[#f7f6f2] text-[#07080b] text-xs sm:text-sm font-semibold hover:bg-white disabled:opacity-40 transition-all shadow-sm active:scale-95"
            >
              {pending ? "Saving Answers…" : "Submit Today’s Quiz"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.12] p-4 text-center text-xs font-medium text-zinc-200">
          {result}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-950/40 border border-rose-500/20 p-4 text-center text-xs font-medium text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}
