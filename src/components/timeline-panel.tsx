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
  X,
  Heart,
} from "lucide-react";

import {
  createTimeCapsuleAction,
  getRelationshipTimelineAction,
  listTimeCapsulesAction,
  unlockTimeCapsuleAction,
  type TimeCapsuleDTO,
  type TimelineEventDTO,
} from "@/actions/timeline";
import { formatDateLong, formatDateMedium } from "@/lib/date";

const FILTER_TAGS = [
  { value: "all", label: "All Story" },
  { value: "capsule", label: "Capsules" },
  { value: "memory", label: "Photos" },
  { value: "movie", label: "Movies" },
  { value: "achievement", label: "Milestones" },
  { value: "challenge", label: "Quests" },
  { value: "calendar", label: "Dates" },
] as const;

function kindIcon(kind: string) {
  switch (kind) {
    case "memory":
      return <Camera className="w-3.5 h-3.5 text-rose-300" />;
    case "movie":
      return <Film className="w-3.5 h-3.5 text-amber-300" />;
    case "achievement":
      return <Trophy className="w-3.5 h-3.5 text-amber-200" />;
    case "calendar":
      return <CalendarIcon className="w-3.5 h-3.5 text-sky-300" />;
    case "challenge":
      return <Target className="w-3.5 h-3.5 text-emerald-300" />;
    case "capsule":
      return <Lock className="w-3.5 h-3.5 text-purple-300" />;
    default:
      return <Sparkles className="w-3.5 h-3.5 text-amber-200" />;
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

  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  function handleUnlockCapsule(id: string) {
    setUnlockingId(id);
    startTransition(async () => {
      try {
        const res = await unlockTimeCapsuleAction(id);
        if (res.ok) {
          await loadData();
        } else {
          setError(res.error.message);
        }
      } finally {
        setUnlockingId(null);
      }
    });
  }

  const filteredEvents =
    filter === "all" ? events : events.filter((e) => e.kind === filter);

  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-400">
            Relationship Chronicles
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-light text-[#f7f6f2] tracking-tight mt-1">
            Story Timeline
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Every shared milestone, date night, quest, and sealed time capsule written together.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingCapsule(!isCreatingCapsule)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f7f6f2] text-[#07080b] text-xs font-semibold hover:bg-white transition-all self-start sm:self-auto shadow-sm active:scale-98"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{isCreatingCapsule ? "Close" : "Seal Capsule"}</span>
        </button>
      </div>

      {error && (
        <p className="p-3 rounded-xl text-xs font-medium text-rose-300 bg-rose-950/40 border border-rose-500/20 text-center">
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
            className="rounded-2xl border border-white/[0.08] bg-[#0e1017] p-6 space-y-4 shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h2 className="text-sm font-medium text-[#f7f6f2] flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-300" />
                <span>Seal a Secret for the Future</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsCreatingCapsule(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Write a message, promise, or prediction. It remains locked and encrypted until the chosen date.
            </p>

            <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
                  Capsule Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Open on Our 1-Year Anniversary"
                  value={capsuleTitle}
                  onChange={(e) => setCapsuleTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-base sm:text-xs text-[#f7f6f2] placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
                  Unlock Date
                </label>
                <input
                  type="datetime-local"
                  required
                  value={capsuleUnlockDate}
                  onChange={(e) => setCapsuleUnlockDate(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-base sm:text-xs text-[#f7f6f2] focus:outline-none focus:border-white/20 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
                Encrypted Letter
              </label>
              <textarea
                rows={4}
                required
                placeholder="What I want to remember about us right now is…"
                value={capsuleMessage}
                onChange={(e) => setCapsuleMessage(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-base sm:text-xs text-[#f7f6f2] placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-full bg-[#f7f6f2] text-[#07080b] text-xs font-semibold hover:bg-white disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span>{pending ? "Sealing…" : "Seal Capsule"}</span>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Sealed Time Capsules Strip */}
      {capsules.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-zinc-400 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Time Capsules ({capsules.length})</span>
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {capsules.map((capsule) => {
              const unlockDate = new Date(capsule.unlockAt);
              const isReady = new Date() >= unlockDate;

              return (
                <div
                  key={capsule.id}
                  className="rounded-2xl border border-white/[0.07] bg-[#0e1017] p-5 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-serif font-light text-[#f7f6f2] text-base flex items-center gap-2">
                        {capsule.isUnlocked ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-amber-300/80" />
                        )}
                        <span>{capsule.title}</span>
                      </h3>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                        {capsule.isUnlocked ? "Unlocked" : isReady ? "Ready" : "Sealed"}
                      </span>
                    </div>

                    {capsule.isUnlocked && capsule.message ? (
                      <p className="text-xs text-zinc-300 bg-white/[0.02] p-3 rounded-xl border border-white/[0.05] leading-relaxed italic">
                        &ldquo;{capsule.message}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-400 font-light">
                        Locked until {formatDateLong(unlockDate)}.
                      </p>
                    )}
                  </div>

                  {!capsule.isUnlocked && isReady && (
                    <div className="pt-2 border-t border-white/[0.05]">
                      <button
                        type="button"
                        disabled={unlockingId === capsule.id}
                        onClick={() => handleUnlockCapsule(capsule.id)}
                        className="w-full py-2 rounded-xl bg-white/10 text-xs font-semibold text-white hover:bg-white/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${unlockingId === capsule.id ? "animate-spin" : ""}`} />
                        <span>{unlockingId === capsule.id ? "Unlocking…" : "Unlock Capsule Now"}</span>
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
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-white/[0.06] -mx-4 px-4 sm:mx-0 sm:px-0">
        {FILTER_TAGS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(t.value)}
            className={`px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-medium tracking-wide transition-colors whitespace-nowrap touch-manipulation active:scale-95 ${
              filter === t.value
                ? "bg-white/15 text-white border border-white/20"
                : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Chronological Stream */}
      <section className="relative pl-7 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-3.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/[0.08]">
        {loading ? (
          <p className="text-xs text-zinc-400 italic py-8">Loading storyline…</p>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e1017] p-8 text-center space-y-2">
            <Heart className="w-5 h-5 text-zinc-500 mx-auto" />
            <p className="text-xs font-medium text-[#f7f6f2]">No moments recorded in this view.</p>
            <p className="text-xs text-zinc-500">Events from chats, movie nights, and memories weave into this story automatically.</p>
          </div>
        ) : (
          filteredEvents.map((evt, idx) => {
            const d = new Date(evt.at);
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                className="relative group"
              >
                {/* Node */}
                <div className="absolute -left-[26px] sm:-left-[34px] top-2 w-5 h-5 rounded-full bg-[#07080b] border border-white/20 flex items-center justify-center">
                  {kindIcon(evt.kind)}
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-[#0e1017] p-4 sm:p-5 hover:border-white/[0.14] transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                    <h3 className="font-serif font-light text-[#f7f6f2] text-base">
                      {evt.title}
                    </h3>
                    <time className="text-[11px] text-zinc-400 font-mono">
                      {formatDateMedium(d)}
                    </time>
                  </div>

                  {evt.subtitle && (
                    <p className="text-xs text-zinc-400 font-light leading-relaxed">
                      {evt.subtitle}
                    </p>
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
