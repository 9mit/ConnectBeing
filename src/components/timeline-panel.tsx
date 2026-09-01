"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Lock,
  Unlock,
  Sparkles,
  Camera,
  Film,
  Trophy,
  Calendar as CalendarIcon,
  Target,
  Plus,
} from "lucide-react";

import {
  createTimeCapsuleAction,
  getRelationshipTimelineAction,
  listTimeCapsulesAction,
  unlockTimeCapsuleAction,
  type TimeCapsuleDTO,
  type TimelineEventDTO,
} from "@/actions/timeline";

const FILTER_TAGS = [
  { value: "all", label: "All Story" },
  { value: "capsule", label: "⏳ Capsules" },
  { value: "memory", label: "📷 Photos" },
  { value: "movie", label: "🍿 Movies" },
  { value: "achievement", label: "✨ Trophies" },
  { value: "challenge", label: "🎯 Quests" },
  { value: "calendar", label: "📅 Dates" },
] as const;

function kindIcon(kind: string) {
  switch (kind) {
    case "memory":
      return <Camera className="w-4 h-4 text-pink-400" />;
    case "movie":
      return <Film className="w-4 h-4 text-amber-400" />;
    case "achievement":
      return <Trophy className="w-4 h-4 text-yellow-300" />;
    case "calendar":
      return <CalendarIcon className="w-4 h-4 text-sky-400" />;
    case "challenge":
      return <Target className="w-4 h-4 text-emerald-400" />;
    case "capsule":
      return <Clock className="w-4 h-4 text-purple-400" />;
    default:
      return <Sparkles className="w-4 h-4 text-amber-300" />;
  }
}

export function TimelinePanel() {
  const [events, setEvents] = useState<TimelineEventDTO[]>([]);
  const [capsules, setCapsules] = useState<TimeCapsuleDTO[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time capsule creation form
  const [isCreatingCapsule, setIsCreatingCapsule] = useState(false);
  const [capsuleTitle, setCapsuleTitle] = useState("");
  const [capsuleMessage, setCapsuleMessage] = useState("");
  const [capsuleUnlockDate, setCapsuleUnlockDate] = useState("");
  const [pending, startTransition] = useTransition();

  async function loadData() {
    const [timelineRes, capsulesRes] = await Promise.all([
      getRelationshipTimelineAction(),
      listTimeCapsulesAction(),
    ]);

    if (timelineRes.ok) setEvents(timelineRes.data.events);
    if (capsulesRes.ok) setCapsules(capsulesRes.data.capsules);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  function handleCreateCapsule(e: React.FormEvent) {
    e.preventDefault();
    if (!capsuleTitle || !capsuleMessage || !capsuleUnlockDate) return;

    startTransition(async () => {
      const res = await createTimeCapsuleAction({
        title: capsuleTitle,
        message: capsuleMessage,
        unlockAt: new Date(capsuleUnlockDate).toISOString(),
      });

      if (res.ok) {
        setCapsuleTitle("");
        setCapsuleMessage("");
        setCapsuleUnlockDate("");
        setIsCreatingCapsule(false);
        await loadData();
      } else {
        setError(res.error.message);
      }
    });
  }

  function handleUnlockCapsule(id: string) {
    startTransition(async () => {
      const res = await unlockTimeCapsuleAction(id);
      if (res.ok) {
        await loadData();
      } else {
        setError(res.error.message);
      }
    });
  }

  const filteredEvents =
    filter === "all" ? events : events.filter((e) => e.kind === filter);

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            Chronicles of Us
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Relationship Timeline
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            Every memory, movie date, quest, and sealed time capsule written in your stars.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreatingCapsule(!isCreatingCapsule)}
          className="btn-madlove-gold px-5 py-2.5 text-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreatingCapsule ? "Cancel" : "Seal Time Capsule"}</span>
        </button>
      </div>

      {error && (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center">
          {error}
        </p>
      )}

      {/* Time Capsule Creation Form */}
      <AnimatePresence>
        {isCreatingCapsule && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreateCapsule}
            className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/60 p-6 md:p-8 space-y-4 shadow-xl overflow-hidden"
          >
            <h2 className="text-lg font-bold text-white font-display text-glow-gold flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              Seal a Message for the Future
            </h2>
            <p className="text-xs text-slate-300">
              Write a love letter, prediction, or promise. It will stay sealed until the chosen date.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Capsule Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Open on Our 1-Year Anniversary"
                  value={capsuleTitle}
                  onChange={(e) => setCapsuleTitle(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Unlock Date
                </label>
                <input
                  type="datetime-local"
                  required
                  value={capsuleUnlockDate}
                  onChange={(e) => setCapsuleUnlockDate(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Secret Message
              </label>
              <textarea
                rows={4}
                required
                placeholder="What I love most about you right now is..."
                value={capsuleMessage}
                onChange={(e) => setCapsuleMessage(e.target.value)}
                className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingCapsule(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="btn-madlove-gold px-6 py-2 text-xs font-bold disabled:opacity-50"
              >
                {pending ? "Sealing…" : "Seal Capsule 🔒"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Sealed Time Capsules Grid */}
      {capsules.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white font-display tracking-wide uppercase flex items-center gap-2 border-b border-amber-500/20 pb-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Time Capsules ({capsules.length})</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {capsules.map((capsule) => {
              const unlockDate = new Date(capsule.unlockAt);
              const isReady = new Date() >= unlockDate;

              return (
                <div
                  key={capsule.id}
                  className="rounded-2xl glass-panel p-5 border border-purple-800/40 bg-gradient-to-br from-purple-950/50 to-slate-900/50 flex flex-col justify-between shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-amber-200 text-base font-display flex items-center gap-2">
                        {capsule.isUnlocked ? (
                          <Unlock className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-400" />
                        )}
                        {capsule.title}
                      </h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-200 border border-purple-700/40">
                        {capsule.isUnlocked ? "Unlocked" : isReady ? "Ready to Open" : "Sealed"}
                      </span>
                    </div>

                    {capsule.isUnlocked && capsule.message ? (
                      <p className="text-xs text-slate-200 bg-purple-950/70 p-3 rounded-xl border border-amber-500/20 leading-relaxed italic">
                        &ldquo;{capsule.message}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Sealed until {unlockDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}.
                      </p>
                    )}
                  </div>

                  {!capsule.isUnlocked && isReady && (
                    <div className="mt-4 pt-3 border-t border-purple-800/30">
                      <button
                        type="button"
                        onClick={() => handleUnlockCapsule(capsule.id)}
                        className="btn-madlove-gold w-full py-2 text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Unlock Capsule Now</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {FILTER_TAGS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(t.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all whitespace-nowrap ${
              filter === t.value
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(212,175,55,0.2)]"
                : "bg-purple-950/40 text-slate-400 border border-purple-900/30 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      <section className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.5 sm:before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-amber-400 before:via-purple-600 before:to-transparent">
        {loading ? (
          <p className="text-sm text-amber-300/70 italic py-8">Loading relationship storyline…</p>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-2xl glass-panel p-8 text-center border border-amber-500/15">
            <p className="text-2xl mb-2">✨</p>
            <p className="text-sm font-semibold text-slate-300">No events found in this category.</p>
            <p className="text-xs text-slate-400 mt-1">Start chatting, capturing memories, and watching movies to build your timeline.</p>
          </div>
        ) : (
          filteredEvents.map((evt, idx) => {
            const d = new Date(evt.at);
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="relative group"
              >
                {/* Node Dot */}
                <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-6 h-6 rounded-full bg-purple-950 border border-amber-400/80 flex items-center justify-center shadow-[0_0_10px_rgba(212,175,55,0.3)]">
                  {kindIcon(evt.kind)}
                </div>

                <div className="rounded-2xl glass-panel border border-amber-500/20 bg-purple-950/40 p-4 sm:p-5 hover:border-amber-500/40 transition-all shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                    <h3 className="font-bold text-white text-base font-display">{evt.title}</h3>
                    <span className="text-[10px] font-semibold text-amber-400/80">
                      {d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>

                  {evt.subtitle && (
                    <p className="text-xs text-slate-300 font-medium">{evt.subtitle}</p>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </section>
    </div>
  );
}
