"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  X,
} from "lucide-react";

import {
  createCalendarEventAction,
  deleteCalendarEventAction,
  listCalendarEventsAction,
  toggleCalendarEventAction,
  type CalendarEventDTO,
} from "@/actions/calendar";

const CATEGORIES = [
  { value: "date_night", label: "Date Night" },
  { value: "anniversary", label: "Anniversary" },
  { value: "ritual", label: "Ritual" },
  { value: "custom", label: "Special" },
] as const;

export function CalendarPanel({ initialEvents }: { initialEvents?: CalendarEventDTO[] }) {
  const [events, setEvents] = useState<CalendarEventDTO[]>(initialEvents ?? []);
  const [loading, setLoading] = useState(!initialEvents);
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
    if (!initialEvents) {
      void loadEvents();
    }
  }, [initialEvents]);

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
    <div className="space-y-10 max-w-3xl mx-auto">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-400">
            Shared Schedule
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-light text-[#f7f6f2] tracking-tight mt-1">
            Couple Calendar
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Plan date nights, anniversaries, and intimate shared rituals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f7f6f2] text-[#07080b] text-xs font-semibold hover:bg-white transition-all self-start sm:self-auto shadow-sm active:scale-98"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAdding ? "Close" : "Schedule Date"}</span>
        </button>
      </div>

      {error && (
        <p className="p-3 rounded-xl text-xs font-medium text-rose-300 bg-rose-950/40 border border-rose-500/20 text-center">
          {error}
        </p>
      )}

      {/* Add Event Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="rounded-2xl border border-white/[0.08] bg-[#0e1017] p-6 space-y-4 shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h2 className="text-sm font-medium text-[#f7f6f2] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <span>Schedule a Shared Moment</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rooftop Stargazing & Wine"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs text-[#f7f6f2] placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs text-[#f7f6f2] focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
                Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      category === cat.value
                        ? "border-white/25 bg-white/15 text-white shadow-sm"
                        : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-white"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
                Notes & Ideas (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="What to prepare, locations, or reminders…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs text-[#f7f6f2] placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="px-5 py-2 rounded-full bg-[#f7f6f2] text-[#07080b] text-xs font-semibold hover:bg-white disabled:opacity-40 transition-all"
              >
                {pending ? "Saving…" : "Save Date"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Upcoming Events */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
          <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-zinc-400 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>Upcoming Dates ({upcomingEvents.length})</span>
          </h2>
        </div>

        {loading ? (
          <p className="text-xs text-zinc-400 italic py-6 text-center">Loading calendar…</p>
        ) : upcomingEvents.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e1017] p-8 text-center space-y-2">
            <Sparkles className="w-5 h-5 text-zinc-500 mx-auto" />
            <p className="text-xs font-medium text-[#f7f6f2]">No upcoming dates scheduled.</p>
            <p className="text-xs text-zinc-500">Tap &ldquo;Schedule Date&rdquo; to plan your next date night or shared ritual.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingEvents.map((event) => {
              const d = new Date(event.eventDate);
              const isToday = d.toDateString() === new Date().toDateString();

              return (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/[0.06] bg-[#0e1017] p-4 sm:p-5 flex flex-col justify-between space-y-3 hover:border-white/[0.14] transition-all group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggle(event.id)}
                          title="Mark as completed"
                          className="text-zinc-500 hover:text-white transition-colors"
                        >
                          <Circle className="w-4 h-4" />
                        </button>
                        <h3 className="font-serif font-light text-[#f7f6f2] text-base leading-snug">
                          {event.title}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-300 border border-white/[0.06] whitespace-nowrap">
                        {isToday ? "Today" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    {event.description && (
                      <p className="text-xs text-zinc-400 pl-6.5 font-light leading-relaxed">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between pl-6.5 text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(event.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-rose-400 p-1"
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
        <section className="space-y-3 pt-2">
          <h3 className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
            Completed Dates ({completedEvents.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 opacity-65 hover:opacity-100 transition-opacity">
            {completedEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-white/[0.05] bg-[#0e1017] p-3 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="line-through text-zinc-400">{event.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(event.id)}
                  className="text-zinc-500 hover:text-rose-400"
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
