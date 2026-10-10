"use client";

import { motion, Variants } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2, Loader2, Play, Clock, Film, AlertTriangle, X, Laptop } from "lucide-react";
import { deleteWatchSessionAction, deleteMovieMemoryAction } from "@/actions/together";
import { BRAND } from "@/lib/brand";
import { formatSessionDateTime, formatDateMedium } from "@/lib/date";

export type UpNextSession = {
  id: string;
  provider: string;
  status: string;
  title: string;
  scheduledFor: string | Date;
  posterUrl?: string | null;
  invitationMessage?: string | null;
  currentPosition?: number | null;
  playbackState?: string | null;
};

export type VaultMemory = {
  id: string;
  sessionId: string;
  title: string;
  provider?: string | null;
  posterUrl?: string | null;
  watchDuration: number;
  date: string | Date;
  expiresAt: string | Date;
};

type TogetherProps = {
  upNextSessions: UpNextSession[];
  vaultMemories: VaultMemory[];
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
};

function formatPlaybackSeconds(sec?: number | null): string {
  if (typeof sec !== "number" || sec <= 0) return "00:00";
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getDaysRemaining(expiresAt?: string | Date | null): string {
  if (!expiresAt) return "7 days left";
  const exp = new Date(expiresAt).getTime();
  const diffMs = exp - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Expiring today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function TogetherClient({ upNextSessions, vaultMemories }: TogetherProps) {
  const [sessions, setSessions] = useState(upNextSessions);
  const [memories, setMemories] = useState(vaultMemories);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Vault memory deletion modal state
  const [memoryToDelete, setMemoryToDelete] = useState<VaultMemory | null>(null);
  const [isDeletingMemory, setIsDeletingMemory] = useState(false);

  useEffect(() => {
    setSessions(upNextSessions);
  }, [upNextSessions]);

  useEffect(() => {
    setMemories(vaultMemories);
  }, [vaultMemories]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "movie-night");
    return () => document.documentElement.removeAttribute("data-theme");
  }, []);

  const handleDeleteSession = async (sessionId: string, title: string) => {
    if (!window.confirm(`Delete scheduled night plan for "${title}"?`)) return;
    setDeletingSessionId(sessionId);
    try {
      const res = await deleteWatchSessionAction(sessionId);
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        alert(res.error.message || "Failed to delete scheduled night plan.");
      }
    } catch {
      alert("An error occurred while deleting the plan.");
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleConfirmDeleteMemory = async () => {
    if (!memoryToDelete) return;
    setIsDeletingMemory(true);
    try {
      const res = await deleteMovieMemoryAction(memoryToDelete.id);
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryToDelete.id));
        setMemoryToDelete(null);
      } else {
        alert(res.error.message || "Failed to remove memory from vault.");
      }
    } catch {
      alert("An error occurred while removing the memory.");
    } finally {
      setIsDeletingMemory(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-5xl space-y-12 pb-16"
    >
      {/* Header Banner */}
      <motion.header
        variants={itemVariants}
        className="relative rounded-[28px] sm:rounded-[32px] glass-panel p-6 sm:p-12 text-center border-t border-white/[0.08] overflow-hidden group"
      >
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-screen group-hover:scale-105 transition-transform duration-[2s] ease-out" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020104] via-black/40 to-transparent" />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[100px] opacity-30 bg-amber-500/50 ambient-pulse" />

        <div className="relative z-10 flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400/80 mb-3 sm:mb-4 bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/20 shadow-[0_0_20px_rgba(251,191,36,0.15)]">
            Virtual Theater
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 font-display tracking-tight text-glow">
            {BRAND.name} Together
          </h1>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base text-slate-300 font-medium max-w-lg mx-auto leading-relaxed">
            Your private cinematic space. Sync movies, share whispers, and resume unfinished movie nights anytime.
          </p>
          <div className="mt-6 sm:mt-8 flex justify-center gap-6">
            <Link
              href="/together/new"
              className="group relative inline-flex items-center gap-2 rounded-full bg-white text-black px-6 sm:px-8 py-3 sm:py-3.5 font-extrabold text-[11px] uppercase tracking-widest shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:scale-105 transition-all duration-300"
            >
              <span>Plan Movie Night</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </motion.header>

      {/* PC-to-PC Streaming Advisory */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Laptop size={16} />
          </div>
          <div>
            <p className="font-semibold text-white">Recommended Setup: Watch PC to PC</p>
            <p className="text-[11px] text-zinc-400">
              For crisp 1080p video and synced tab audio, both partners should join from a PC or laptop (Chrome, Edge, Brave). Mobile devices work best in Companion Mode.
            </p>
          </div>
        </div>
      </motion.div>

      {/* UP NEXT SECTION */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <motion.h2
            variants={itemVariants}
            className="text-sm font-bold text-white font-display tracking-[0.1em] uppercase flex items-center gap-3"
          >
            <span className="w-8 h-px bg-white/20" />
            Up Next
            <span className="w-8 h-px bg-white/20" />
          </motion.h2>
          {sessions.some((s) => s.status === "ended_unfinished" || s.status === "paused" || ((s.currentPosition || 0) > 0)) && (
            <span className="text-[11px] font-mono text-rose-400">
              Continue where you left off
            </span>
          )}
        </div>

        {sessions.length === 0 ? (
          <motion.div
            variants={itemVariants}
            className="rounded-3xl glass-panel border border-white/[0.04] bg-white/[0.01] p-8 sm:p-12 text-center flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-2xl text-slate-600">
              🍿
            </div>
            <div>
              <p className="text-slate-400 font-medium text-sm">The theater is currently empty.</p>
              <p className="text-slate-500 text-xs mt-1">Set up a movie date to see it here.</p>
            </div>
            <Link
              href="/together/new"
              className="mt-2 text-xs font-semibold text-amber-300 hover:text-amber-200 underline transition-colors"
            >
              Plan a movie date now →
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {sessions.map((session) => {
              const isUnfinished =
                session.status === "ended_unfinished" ||
                session.status === "paused" ||
                (typeof session.currentPosition === "number" && session.currentPosition > 0);

              const formattedPos = formatPlaybackSeconds(session.currentPosition);

              return (
                <motion.div
                  variants={itemVariants}
                  key={session.id}
                  className="group relative overflow-hidden rounded-3xl glass-panel border border-white/[0.06] bg-[#0c0a14]/80 p-5 sm:p-8 shadow-2xl interactive flex flex-col justify-between"
                >
                  {/* Poster Backdrop */}
                  {session.posterUrl ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-25 group-hover:opacity-35 group-hover:scale-105 transition-all duration-700"
                      style={{ backgroundImage: `url('${session.posterUrl}')` }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#090711] via-[#090711]/85 to-transparent" />

                  <div className="relative z-10 flex flex-col h-full justify-between space-y-6">
                    <div>
                      {/* Top Badges */}
                      <div className="mb-4 flex items-center justify-between">
                        <span className="rounded-full bg-black/60 border border-white/[0.12] px-3 py-1 text-[9px] font-bold text-amber-300 uppercase tracking-widest backdrop-blur-md">
                          {session.provider}
                        </span>

                        <div className="flex items-center gap-2">
                          {isUnfinished ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2.5 py-1 rounded-full border border-rose-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                              Continue Watching
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Scheduled
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={deletingSessionId === session.id}
                            onClick={() => handleDeleteSession(session.id, session.title)}
                            title="Cancel movie plan"
                            aria-label="Cancel movie plan"
                            className="p-1.5 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-200 disabled:opacity-50"
                          >
                            {deletingSessionId === session.id ? (
                              <Loader2 size={13} className="animate-spin text-rose-400" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>
                      </div>

                      <h3 className="text-2xl font-bold text-white font-display tracking-tight leading-tight group-hover:text-amber-100 transition-colors">
                        {session.title}
                      </h3>

                      {isUnfinished ? (
                        <div className="mt-3 flex items-center gap-2 text-xs font-mono text-rose-300/90 bg-rose-950/40 border border-rose-500/20 px-3 py-1.5 rounded-xl w-fit">
                          <Clock size={12} className="text-rose-400" />
                          <span>You left off at {formattedPos}</span>
                        </div>
                      ) : (
                        <p className="text-[11px] font-semibold text-slate-400 mt-2 uppercase tracking-widest">
                          {formatSessionDateTime(session.scheduledFor)}
                        </p>
                      )}

                      {session.invitationMessage && (
                        <p className="mt-4 text-xs italic text-slate-200 bg-black/40 border-l-2 border-amber-500/50 p-3 rounded-r-xl">
                          &ldquo;{session.invitationMessage}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center gap-3 pt-2">
                      <Link
                        href={`/together/room/${session.id}`}
                        className={`flex-1 inline-flex justify-center items-center gap-2 rounded-xl px-4 py-3 text-[11px] font-extrabold uppercase tracking-widest transition-all duration-300 backdrop-blur-sm shadow-md active:scale-95 ${
                          isUnfinished
                            ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20"
                            : "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-white shadow-amber-500/15"
                        }`}
                      >
                        {isUnfinished ? (
                          <>
                            <Play size={13} className="fill-current" />
                            <span>Resume Movie</span>
                          </>
                        ) : (
                          <span>Enter Room 🍿</span>
                        )}
                      </Link>

                      <button
                        type="button"
                        disabled={deletingSessionId === session.id}
                        onClick={() => handleDeleteSession(session.id, session.title)}
                        title="Cancel movie plan"
                        aria-label="Cancel movie plan"
                        className="p-3 rounded-xl border border-white/[0.08] bg-black/40 hover:bg-rose-500/20 hover:border-rose-500/30 text-zinc-400 hover:text-rose-300 transition-all duration-200 disabled:opacity-50"
                      >
                        {deletingSessionId === session.id ? (
                          <Loader2 size={15} className="animate-spin text-rose-400" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* WATCH MEMORY VAULT SECTION (7-Day Temporary Memories) */}
      {memories.length > 0 && (
        <div className="space-y-6 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <motion.h2
              variants={itemVariants}
              className="text-sm font-bold text-white font-display tracking-[0.1em] uppercase flex items-center gap-3"
            >
              <span className="w-8 h-px bg-white/20" />
              Watch Memory Vault
              <span className="w-8 h-px bg-white/20" />
            </motion.h2>
            <span className="text-[11px] font-mono text-zinc-500">
              Completed movie memories (kept for 7 days)
            </span>
          </div>

          {/* Filmstrip / Cards Grid */}
          <motion.div
            variants={itemVariants}
            className="grid gap-4 sm:grid-cols-2 md:grid-cols-3"
          >
            {memories.map((memory) => {
              const daysLeft = getDaysRemaining(memory.expiresAt);

              return (
                <div
                  key={memory.id}
                  className="group relative rounded-2xl glass-panel border border-white/[0.08] bg-[#0a0812]/90 p-4 hover:border-amber-500/30 hover:bg-white/[0.03] transition-all duration-300 flex flex-col justify-between"
                >
                  <Link href={`/together/memory/${memory.sessionId}`} className="block">
                    <div className="aspect-video w-full rounded-xl bg-[#050208] border border-white/10 mb-3 relative overflow-hidden flex items-center justify-center">
                      {memory.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={memory.posterUrl}
                          alt={memory.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                          <Film className="w-8 h-8 text-zinc-600" />
                        </>
                      )}
                      <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-mono text-amber-300 border border-white/10">
                        {memory.watchDuration}m
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-100 font-display text-sm tracking-tight truncate group-hover:text-amber-200 transition-colors">
                      {memory.title}
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5 uppercase tracking-widest">
                      Finished {formatDateMedium(memory.date)}
                    </p>
                  </Link>

                  {/* Card Footer: 7-Day Expiry Tag & Delete Action */}
                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                    <span className="inline-flex items-center gap-1 font-mono text-zinc-500">
                      <Clock size={10} />
                      <span>{daysLeft}</span>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemoryToDelete(memory);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1"
                      title="Delete from Vault"
                      aria-label={`Delete memory for ${memory.title}`}
                    >
                      <Trash2 size={12} />
                      <span className="text-[10px] font-medium">Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR DELETING MEMORY FROM VAULT */}
      {memoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative max-w-sm w-full rounded-2xl border border-white/[0.1] bg-[#0c0d14] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle size={18} />
                <h3 className="text-sm font-bold text-white">Remove from Vault?</h3>
              </div>
              <button
                type="button"
                onClick={() => setMemoryToDelete(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Remove the memory of &ldquo;<span className="font-semibold text-white">{memoryToDelete.title}</span>&rdquo; from your Watch Memory Vault?
            </p>
            <p className="text-[11px] text-zinc-500">
              This will permanently delete this 7-day memory card.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingMemory}
                onClick={() => setMemoryToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingMemory}
                onClick={handleConfirmDeleteMemory}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {isDeletingMemory && <Loader2 size={12} className="animate-spin" />}
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
