"use client";

import { useEffect, useState, useTransition } from "react";

import { listAchievementsAction } from "@/actions/achievements";
import { listChallengesAction } from "@/actions/challenges";
import {
  completeReminderAction,
  createReminderAction,
  listRemindersAction,
} from "@/actions/reminders";

export function PlayPanel() {
  const [achievements, setAchievements] = useState<Awaited<
    ReturnType<typeof listAchievementsAction>
  > | null>(null);
  const [challenges, setChallenges] = useState<Awaited<
    ReturnType<typeof listChallengesAction>
  > | null>(null);
  const [reminders, setReminders] = useState<Awaited<
    ReturnType<typeof listRemindersAction>
  > | null>(null);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    void listAchievementsAction().then(setAchievements);
    void listChallengesAction().then(setChallenges);
    void listRemindersAction().then(setReminders);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {error ? (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center">
          {error}
        </p>
      ) : null}

      {/* Challenges Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-white font-display border-b border-amber-500/20 pb-3 flex items-center gap-2 text-glow-gold">
          <span>🏆</span> Active Quests
        </h2>
        {!challenges ? (
          <p className="text-sm text-amber-300/80 italic">Loading challenges…</p>
        ) : !challenges.ok ? (
          <p className="text-sm text-red-300">{challenges.error.message}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {challenges.data.challenges.map((c) => {
              const progressPct = Math.min(100, Math.max(0, (c.progress / c.goal) * 100));
              return (
                <li
                  key={c.id}
                  className="rounded-2xl glass-panel border border-amber-500/20 bg-purple-950/40 p-5 flex flex-col justify-between hover:border-amber-500/40 hover:-translate-y-0.5 transition-all duration-300 shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-4">
                      <p className="font-bold text-white text-base font-display">{c.title}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        c.status === "completed" 
                          ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                          : "bg-purple-900/40 text-amber-300 border border-amber-500/20"
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">{c.description}</p>
                  </div>
                  
                  <div className="mt-6 space-y-3">
                    <div className="flex justify-between text-xs font-semibold text-amber-400/80">
                      <span>Progress</span>
                      <span className="text-amber-200">{c.progress} / {c.goal}</span>
                    </div>
                    <div className="h-2 w-full bg-purple-950/60 rounded-full overflow-hidden border border-amber-500/20">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 shadow-[0_0_8px_#fbbf24]" 
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {c.status === "active" ? (
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Progresses automatically from vibe, quiz, and Together nights
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Achievements Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-white font-display border-b border-amber-500/20 pb-3 flex items-center gap-2 text-glow-gold">
          <span>✨</span> Couple Trophies
        </h2>
        {!achievements ? (
          <p className="text-sm text-amber-300/80 italic">Loading achievements…</p>
        ) : !achievements.ok ? (
          <p className="text-sm text-red-300">{achievements.error.message}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {achievements.data.items.map((a) => (
              <div
                key={a.code}
                className={`rounded-2xl glass-panel p-5 border transition-all duration-300 flex flex-col justify-between min-h-[120px] ${
                  a.unlocked
                    ? "border-amber-500/40 bg-purple-950/60 text-white shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                    : "border-purple-900/30 bg-purple-950/20 opacity-50"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-xl">{a.unlocked ? "👑" : "🔒"}</span>
                  </div>
                  <p className="font-bold text-white mt-3 font-display text-sm tracking-tight">{a.title}</p>
                  <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">{a.description}</p>
                </div>
                {a.unlocked && (
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-300 mt-3 text-glow-gold">UNLOCKED</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reminders Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-white font-display border-b border-amber-500/20 pb-3 flex items-center gap-2 text-glow-gold">
          <span>📅</span> Shared Reminders
        </h2>
        
        <form
          className="flex flex-col sm:flex-row gap-3 rounded-2xl glass-panel border border-amber-500/30 bg-purple-950/50 p-5 shadow-md"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await createReminderAction({
                title,
                dueAt: new Date(dueAt).toISOString(),
              });
              if (!res.ok) setError(res.error.message);
              else {
                setTitle("");
                setDueAt("");
                refresh();
              }
            });
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New reminder (e.g. Anniversary dinner)"
            className="flex-1 rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
            required
          />
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-base text-slate-200 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all font-semibold"
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-6 py-3 text-sm font-extrabold text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)]"
          >
            Add Task
          </button>
        </form>

        {!reminders ? null : !reminders.ok ? (
          <p className="text-sm text-red-300">{reminders.error.message}</p>
        ) : (
          <ul className="grid gap-3">
            {reminders.data.reminders.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl glass-panel border border-amber-500/20 bg-purple-950/40 px-5 py-4 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${r.completed ? "bg-slate-600" : "bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]"}`} />
                  <span className={`font-semibold ${r.completed ? "line-through text-slate-500" : "text-slate-200"}`}>
                    {r.title} <span className="text-xs text-amber-400/70 font-medium ml-2">— Due: {new Date(r.dueAt).toLocaleString()}</span>
                  </span>
                </div>
                {!r.completed ? (
                  <button
                    type="button"
                    className="text-xs font-bold uppercase tracking-wider text-amber-300 hover:text-amber-100 transition-colors"
                    onClick={() =>
                      startTransition(async () => {
                        await completeReminderAction({ id: r.id });
                        refresh();
                      })
                    }
                  >
                    Done ✓
                  </button>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Completed</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
