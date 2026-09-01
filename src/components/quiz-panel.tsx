"use client";

import { useEffect, useState, useTransition } from "react";

import { getDailyQuizAction, submitQuizAction } from "@/actions/quiz";

export function QuizPanel() {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getDailyQuizAction>
  > | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void getDailyQuizAction().then(setData);
  }, []);

  if (!data) return <p className="text-sm text-amber-300/80 italic">Loading quiz questions…</p>;
  if (!data.ok) return <p className="text-sm text-red-300 font-semibold bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl">{data.error.message}</p>;

  const quiz = data.data;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Quiz Header Info */}
      <div className="rounded-2xl glass-panel border border-amber-500/30 bg-purple-950/50 p-5 flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(212,175,55,0.12)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Daily Connection Vibe</span>
          <h2 className="text-xl font-bold tracking-tight text-white font-display mt-1 text-glow-gold">RIE Daily Quiz</h2>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70">Date</div>
          <div className="text-sm font-semibold text-amber-200 mt-1">{quiz.date}</div>
        </div>
      </div>

      {quiz.alreadyAnswered ? (
        <div className="rounded-2xl glass-panel border border-amber-500/30 bg-purple-950/50 p-8 text-center space-y-3 shadow-lg">
          <div className="text-4xl">🎉</div>
          <h3 className="text-xl font-bold text-amber-200 font-display text-glow-gold">Daily Challenge Complete</h3>
          <p className="text-sm text-slate-300 max-w-sm mx-auto">
            You already answered today&apos;s quiz. Check back tomorrow for the next set of connection cards!
          </p>
        </div>
      ) : (
        quiz.questions.map((q, qi) => (
          <div key={q.index} className="rounded-2xl glass-panel border border-amber-500/20 bg-purple-950/40 p-6 space-y-4 shadow-md">
            <h3 className="text-base font-bold text-white leading-relaxed">
              <span className="text-amber-400 font-extrabold font-display mr-2">Q{qi + 1}.</span> {q.question}
            </h3>
            
            <div className="grid gap-2.5">
              {q.options.map((opt) => {
                const isSelected = answers[qi] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      const next = [...answers];
                      next[qi] = opt;
                      setAnswers(next);
                    }}
                    className={`w-full px-4 py-3.5 rounded-xl border text-left text-sm font-semibold transition-all duration-200 flex items-center justify-between ${
                      isSelected
                        ? "border-amber-400 bg-amber-500/20 text-amber-200 shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                        : "border-purple-800/40 bg-purple-950/30 text-slate-300 hover:border-amber-500/30 hover:bg-purple-900/40"
                    }`}
                  >
                    <span>{opt}</span>
                    {isSelected && (
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Action Footer */}
      {!quiz.alreadyAnswered ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={pending || answers.filter(Boolean).length !== quiz.questions.length}
            className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-6 py-3.5 text-sm font-extrabold text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(212,175,55,0.35)]"
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
                setResult(`Congratulations! Score: ${res.data.score}/${res.data.maxScore}`);
                setData({
                  ok: true,
                  data: { ...quiz, alreadyAnswered: true },
                });
              });
            }}
          >
            Submit Quiz
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-3 text-center text-sm font-bold text-amber-200 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
          {result}
        </div>
      ) : null}
      
      {error ? (
        <div className="rounded-xl bg-red-950/80 border border-red-500/40 px-4 py-3 text-center text-sm font-bold text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
