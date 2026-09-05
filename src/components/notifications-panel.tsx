"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Sparkles, MessageCircle, Film, Trophy, Check, ArrowRight } from "lucide-react";

import {
  listNotificationsAction,
  markNotificationReadAction,
  type InAppNotificationDTO,
} from "@/actions/notifications";
import { usePresence } from "@/components/presence-provider";

const FILTER_TAGS = [
  { value: "all", label: "All Activity" },
  { value: "unread", label: "Unread" },
  { value: "nudge", label: "🔔 Nudges" },
  { value: "quiz", label: "❓ Quizzes" },
  { value: "watch", label: "🍿 Watch Party" },
  { value: "achievement", label: "✨ Trophies" },
] as const;

function getNotificationIcon(kind: string) {
  switch (kind) {
    case "nudge":
      return <Bell className="w-4 h-4 text-amber-400" />;
    case "quiz":
      return <MessageCircle className="w-4 h-4 text-pink-400" />;
    case "watch":
      return <Film className="w-4 h-4 text-amber-400" />;
    case "achievement":
      return <Trophy className="w-4 h-4 text-yellow-300" />;
    case "verification":
      return <Check className="w-4 h-4 text-emerald-400" />;
    default:
      return <Sparkles className="w-4 h-4 text-purple-400" />;
  }
}

export function NotificationsPanel({
  initialNotifications,
}: {
  initialNotifications?: { notifications: InAppNotificationDTO[]; unreadCount: number };
} = {}) {
  const [notifications, setNotifications] = useState<InAppNotificationDTO[]>(initialNotifications?.notifications ?? []);
  const [unreadCount, setUnreadCount] = useState(initialNotifications?.unreadCount ?? 0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(!initialNotifications);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { nudgePartner, nudgePending } = usePresence();
  const [nudgeMsg, setNudgeMsg] = useState<string | null>(null);

  async function loadData() {
    const res = await listNotificationsAction();
    if (res.ok) {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!initialNotifications) {
      void loadData();
    }
  }, [initialNotifications]);

  function handleMarkRead(id?: string) {
    startTransition(async () => {
      const res = await markNotificationReadAction(id);
      if (res.ok) {
        await loadData();
      }
    });
  }

  async function handleSendNudge() {
    const res = await nudgePartner();
    setNudgeMsg(res.message || (res.ok ? "Partner pinged!" : "Failed"));
    setTimeout(() => setNudgeMsg(null), 3000);
  }

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "all") return true;
    return n.kind === filter;
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Activity & Ritual Feed</span>
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Notifications Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            Stay updated with partner nudges, daily connection vibes, and scheduled rituals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => handleMarkRead()}
              className="btn-madlove-subtle px-4 py-2 text-xs flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}

          <button
            type="button"
            disabled={nudgePending}
            onClick={handleSendNudge}
            className="btn-madlove-gold px-4 py-2 text-xs flex items-center gap-1.5"
          >
            <span>🔔</span>
            <span>{nudgePending ? "Pinging…" : "Nudge Partner"}</span>
          </button>
        </div>
      </div>

      {nudgeMsg && (
        <p className="text-sm font-semibold text-amber-300 bg-purple-950/90 border border-amber-500/40 px-4 py-2 rounded-xl text-center shadow-lg">
          {nudgeMsg}
        </p>
      )}

      {error && (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2 rounded-xl text-center">
          {error}
        </p>
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

      {/* Notifications List */}
      {loading ? (
        <p className="text-sm text-amber-300/70 italic py-12 text-center">Loading notifications…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl glass-panel p-8 text-center border border-amber-500/15">
          <p className="text-2xl mb-2">🔔</p>
          <p className="text-sm font-semibold text-slate-300">No notifications in this category.</p>
          <p className="text-xs text-slate-400 mt-1">You are all caught up with your partner.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const d = new Date(item.createdAt);
            return (
              <div
                key={item.id}
                className={`rounded-2xl glass-panel p-4 sm:p-5 border transition-all flex items-start justify-between gap-4 ${
                  !item.read
                    ? "border-amber-500/40 bg-purple-950/60 shadow-[0_0_20px_rgba(212,175,55,0.12)]"
                    : "border-purple-900/30 bg-purple-950/30 opacity-75"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-950 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
                    {getNotificationIcon(item.kind)}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm font-display truncate">
                        {item.title}
                      </h3>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#fbbf24] shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      {item.body}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[10px] text-slate-400">
                      <span>{d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {d.toLocaleDateString()}</span>
                      {item.link && (
                        <Link
                          href={item.link}
                          className="text-amber-300 hover:text-white font-bold flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {!item.read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(item.id)}
                    title="Mark as read"
                    className="text-xs text-slate-400 hover:text-amber-300 p-1.5 rounded-lg border border-amber-500/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
