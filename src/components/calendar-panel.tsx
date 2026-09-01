"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Trash2, CheckCircle2, Circle, Clock, Sparkles } from "lucide-react";

import {
  createCalendarEventAction,
  deleteCalendarEventAction,
  listCalendarEventsAction,
  toggleCalendarEventAction,
  type CalendarEventDTO,
} from "@/actions/calendar";

const CATEGORIES = [
  { value: "date_night", label: "🍿 Date Night", color: "from-rose-500/20 to-purple-600/20 border-rose-500/30" },
  { value: "anniversary", label: "💍 Anniversary", color: "from-amber-500/20 to-yellow-600/20 border-amber-500/40" },
  { value: "ritual", label: "🕯️ Ritual", color: "from-indigo-500/20 to-purple-800/20 border-indigo-500/30" },
  { value: "custom", label: "✨ Special", color: "from-purple-500/20 to-pink-600/20 border-purple-500/30" },
] as const;

export function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [category, setCategory] = useState<"date_night" | "anniversary" | "ritual" | "custom">("date_night");
  const [pending, startTransition] = useTransition();

  async function loadEvents() {
    const res = await listCalendarEventsAction();
    if (res.ok) {
      setEvents(res.data.events);
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !eventDate) return;

    startTransition(async () => {
      const res = await createCalendarEventAction({
        title,
        description: description || undefined,
        eventDate: new Date(eventDate).toISOString(),
        category,
        reminderHours: 24,
      });

      if (res.ok) {
        setTitle("");
        setDescription("");
        setEventDate("");
        setIsAdding(false);
        await loadEvents();
      } else {
        setError(res.error.message);
      }
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      const res = await toggleCalendarEventAction(id);
      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) => (e.id === id ? { ...e, completed: res.data.completed } : e)),
        );
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteCalendarEventAction(id);
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
    });
  }

  const upcomingEvents = events.filter((e) => !e.completed);
  const completedEvents = events.filter((e) => e.completed);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            Shared Connection Schedule
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Couple Calendar & Rituals
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            Plan romantic date nights, remember milestones, and cultivate shared rituals.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="btn-madlove-gold px-5 py-2.5 text-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdding ? "Cancel" : "Add Date"}</span>
        </button>
      </div>

      {error && (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center">
          {error}
        </p>
      )}

      {/* Add Event Drawer / Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/60 p-6 md:p-8 space-y-4 shadow-xl overflow-hidden"
          >
            <h2 className="text-lg font-bold text-white font-display text-glow-gold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Schedule a Special Moment
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rooftop Stargazing & Wine"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      category === cat.value
                        ? "border-amber-400 bg-amber-500/20 text-amber-200 shadow-[0_0_12px_rgba(212,175,55,0.25)]"
                        : "border-purple-900/40 bg-purple-950/40 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Notes / Ideas (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Bring warm blankets and chocolate..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="btn-madlove-gold px-6 py-2 text-xs font-bold disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save Date"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Upcoming Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white font-display tracking-wide uppercase flex items-center gap-2 border-b border-amber-500/20 pb-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span>Upcoming Dates & Rituals ({upcomingEvents.length})</span>
        </h2>

        {loading ? (
          <p className="text-sm text-amber-300/70 italic py-6 text-center">Loading calendar moments…</p>
        ) : upcomingEvents.length === 0 ? (
          <div className="rounded-2xl glass-panel p-8 text-center border border-amber-500/15">
            <p className="text-2xl mb-2">🥂</p>
            <p className="text-sm font-semibold text-slate-300">No upcoming dates scheduled yet.</p>
            <p className="text-xs text-slate-400 mt-1">Tap &ldquo;Add Date&rdquo; to surprise your partner with a plan.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingEvents.map((event) => {
              const d = new Date(event.eventDate);
              const isToday = d.toDateString() === new Date().toDateString();
              const categoryMeta = CATEGORIES.find((c) => c.value === event.category) ?? CATEGORIES[0]!;

              return (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-2xl glass-panel p-5 border bg-gradient-to-br ${categoryMeta.color} flex flex-col justify-between hover:-translate-y-0.5 transition-all shadow-md group`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggle(event.id)}
                          title="Mark as completed"
                          className="text-slate-400 hover:text-amber-300 transition-colors"
                        >
                          <Circle className="w-5 h-5" />
                        </button>
                        <h3 className="font-bold text-white text-base leading-snug">{event.title}</h3>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                        {isToday ? "✨ Today" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    {event.description && (
                      <p className="text-xs text-slate-300 pl-7 leading-relaxed font-medium">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between pl-7 text-[11px] text-amber-300/80">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(event.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400 p-1"
                      title="Delete event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Completed Section */}
      {completedEvents.length > 0 && (
        <section className="space-y-3 pt-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Completed Dates ({completedEvents.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 opacity-60 hover:opacity-100 transition-opacity">
            {completedEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl glass-panel p-3.5 flex items-center justify-between border border-white/10 text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="line-through text-slate-300">{event.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(event.id)}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
