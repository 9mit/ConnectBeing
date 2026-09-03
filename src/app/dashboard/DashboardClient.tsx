"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SITE } from "@/content/site";
import { capitalizeMood } from "@/lib/format";
import { usePresence } from "@/components/presence-provider";

type ActionBag<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

type TimelineEvent = {
  id: string;
  kind: string;
  title: string;
  at: string;
  subtitle: string | null;
  url: string | null;
};

type DashboardProps = {
  data: {
    moods: ActionBag<{
      mine?: { mood: string } | null;
      partner?: { mood: string } | null;
    }>;
    pet: ActionBag<{
      petName: string;
      petState: string;
      score: number;
    }>;
    insightResult: ActionBag<{
      compatibility?: {
        overall: number;
        communication: number;
        qualityTime: number;
        consistency: number;
      } | null;
      insight?: {
        archetype: string;
        strengths: string[];
        growthAreas: string[];
      } | null;
      dailyInsights: string[];
      discussionPrompts: string[];
      recommendations?: Array<{
        category: string;
        title: string;
        description: string;
        reason: string;
      }>;
      habits?: { suggestions: string[] };
    }>;
    recentUs: ActionBag<{ events: TimelineEvent[] }>;
    partnerName: string | null;
    daysTogetherLabel: string;
    daysTogether: number;
  };
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

function kindEmoji(kind: string): string {
  switch (kind) {
    case "photo":
      return "📷";
    case "movie":
    case "watch":
      return "🍿";
    case "mood":
      return "🎭";
    case "quiz":
      return "❓";
    case "call":
      return "📞";
    case "challenge":
      return "🎯";
    case "achievement":
      return "✨";
    default:
      return "✦";
  }
}

export function DashboardClient({ data }: DashboardProps) {
  const {
    moods,
    pet,
    insightResult,
    recentUs,
    partnerName,
    daysTogetherLabel,
    daysTogether,
  } = data;
  const { partnerOnline, myStatus, toggleMyStatus, nudgePartner, nudgePending } = usePresence();
  const [mounted, setMounted] = useState(false);
  const [nudgeToast, setNudgeToast] = useState<string | null>(null);

  const matchScore =
    insightResult.ok && insightResult.data.compatibility
      ? insightResult.data.compatibility.overall
      : 0;

  const petName =
    pet.ok && pet.data.petName ? pet.data.petName : SITE.defaultPetName;
  const mineMood = capitalizeMood(moods.ok ? moods.data.mine?.mood : null);
  const partnerMood = capitalizeMood(
    moods.ok ? moods.data.partner?.mood : null,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleNudge() {
    const res = await nudgePartner();
    setNudgeToast(res.message || (res.ok ? "🔔 Ping sent!" : "Failed"));
    setTimeout(() => setNudgeToast(null), 3000);
  }

  const tonightLines: string[] = [];
  if (insightResult.ok) {
    for (const s of insightResult.data.habits?.suggestions ?? []) {
      tonightLines.push(s);
    }
    for (const r of (insightResult.data.recommendations ?? []).slice(0, 3)) {
      tonightLines.push(`${r.title}: ${r.description}`);
    }
    for (const p of insightResult.data.discussionPrompts ?? []) {
      tonightLines.push(p);
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-10"
    >
      {/* Partner Joined Welcome Banner */}
      {daysTogether <= 1 && partnerName && (
        <div className="p-4 sm:p-5 rounded-3xl border border-amber-500/40 bg-gradient-to-r from-purple-950/70 via-[#0d0218] to-purple-950/70 backdrop-blur-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(212,175,55,0.15)] animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">🎉</span>
            <div>
              <h3 className="text-sm font-bold text-amber-200">
                Your partner is here! {partnerName} has joined your sanctuary.
              </h3>
              <p className="text-xs text-slate-300">
                Your private 2-person digital home is now live. Everything is completely synced.
              </p>
            </div>
          </div>
          <Link
            href="/chat"
            className="py-2 px-4 rounded-xl border border-amber-500/40 bg-amber-500/20 text-xs font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500 hover:text-purple-950 transition-all flex-shrink-0"
          >
            Say Hello in Chat ❤️
          </Link>
        </div>
      )}

      <motion.header variants={itemVariants} className="relative z-10">
        <p className="text-[11px] uppercase tracking-[0.22em] text-amber-400 font-bold mb-2">
          {daysTogetherLabel}
          {partnerName ? ` · with ${partnerName}` : ""}
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 font-display text-glow-gold">
          Home
        </h1>
        <p className="mt-2 text-sm text-slate-300 font-medium max-w-xl">
          Your shared digital life — rituals, status, and the story you build
          together.
        </p>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          {/* Partner Status */}
          <span className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/40 border border-amber-500/20 text-xs font-bold uppercase tracking-wider shadow-inner">
            <span
              className={`h-2.5 w-2.5 rounded-full transition-all ${
                partnerOnline
                  ? "bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]"
                  : "bg-slate-500"
              }`}
            />
            <span className={partnerOnline ? "text-amber-300" : "text-slate-400"}>
              {partnerName ? partnerName : "Partner"} is{" "}
              {partnerOnline ? "Online" : "Away"}
            </span>
          </span>

          {/* User On/Off Presence Switch */}
          <button
            type="button"
            onClick={toggleMyStatus}
            title={
              myStatus === "online"
                ? "Your status is ONLINE. Click to toggle OFF (appear offline)"
                : "Your status is OFFLINE. Click to toggle ON (appear online)"
            }
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
              myStatus === "online"
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                : "border-slate-700 bg-slate-900/80 text-slate-400"
            }`}
          >
            <span className="text-[10px] opacity-75">You:</span>
            <span
              className={`h-2 w-2 rounded-full transition-all ${
                myStatus === "online" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              }`}
            />
            <span>{myStatus === "online" ? "Online (ON)" : "Offline (OFF)"}</span>
          </button>

          {/* Ping Partner Button */}
          <button
            type="button"
            disabled={nudgePending}
            onClick={handleNudge}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500 hover:text-purple-950 transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_12px_rgba(212,175,55,0.2)]"
          >
            <span>🔔</span>
            <span>{nudgePending ? "Pinging…" : "Ping Partner"}</span>
          </button>
          {nudgeToast ? (
            <span className="text-xs font-bold text-amber-300 bg-purple-950/80 border border-amber-500/40 px-3 py-1.5 rounded-full animate-bounce">
              {nudgeToast}
            </span>
          ) : null}
        </div>
      </motion.header>

      {/* Today ritual strip */}
      <motion.section variants={itemVariants} className="space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
          Today&apos;s ritual
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/mood"
            className="rounded-2xl border border-amber-500/20 bg-purple-950/40 p-5 hover:border-amber-500/40 hover:bg-purple-900/40 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              1 · Vibe
            </p>
            <p className="mt-2 text-lg font-display font-bold text-white">
              Check in
            </p>
            <p className="mt-1 text-xs text-slate-300">
              You: {mineMood} · Partner: {partnerMood}
            </p>
          </Link>
          <Link
            href="/quiz"
            className="rounded-2xl border border-amber-500/20 bg-purple-950/40 p-5 hover:border-amber-500/40 hover:bg-purple-900/40 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              2 · Quiz
            </p>
            <p className="mt-2 text-lg font-display font-bold text-white">
              Play daily quiz
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Learn each other — not a chat game
            </p>
          </Link>
          <Link
            href="/together"
            className="rounded-2xl border border-amber-500/20 bg-purple-950/40 p-5 hover:border-amber-500/40 hover:bg-purple-900/40 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              3 · Together
            </p>
            <p className="mt-2 text-lg font-display font-bold text-white">
              Shared night
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Sync a room — becomes a memory
            </p>
          </Link>
        </div>
      </motion.section>

      {/* Status */}
      <motion.section
        variants={itemVariants}
        className="grid gap-4 sm:grid-cols-3"
      >
        <Link
          href="/pet"
          className="rounded-2xl border border-amber-500/20 bg-purple-950/40 p-5 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
            Companion
          </p>
          <p className="mt-2 text-xl font-display font-bold text-white">
            {petName}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {pet.ok
              ? `${pet.data.petState} · ${pet.data.score}/100`
              : "—"}
          </p>
        </Link>
        <div className="rounded-2xl border border-amber-500/20 bg-purple-950/40 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
            Match
          </p>
          <p className="mt-2 text-3xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400 text-glow-gold">
            {mounted ? matchScore : 0}
            <span className="text-lg text-amber-400/70">%</span>
          </p>
          {insightResult.ok && insightResult.data.compatibility ? (
            <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Comm {insightResult.data.compatibility.communication} · Time{" "}
              {insightResult.data.compatibility.qualityTime} · Rhythm{" "}
              {insightResult.data.compatibility.consistency}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-purple-950/40 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
            Archetype
          </p>
          <p className="mt-2 text-xl font-display font-bold capitalize text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500">
            {insightResult.ok && insightResult.data.insight
              ? insightResult.data.insight.archetype
              : "Growing…"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Local Relationship Intelligence
          </p>
        </div>
      </motion.section>

      {/* Recent Us */}
      <motion.section variants={itemVariants} className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
            Recent us
          </h2>
          <Link
            href="/timeline"
            className="text-[10px] font-bold uppercase tracking-widest text-amber-300 hover:text-amber-100"
          >
            Full timeline →
          </Link>
        </div>
        {!recentUs.ok ? (
          <p className="text-sm text-red-400">{recentUs.error.message}</p>
        ) : recentUs.data.events.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl border border-amber-500/15 bg-purple-950/30 p-6">
            Complete today&apos;s ritual — moments appear here automatically.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentUs.data.events.map((e) => (
              <li
                key={`${e.kind}-${e.id}`}
                className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-purple-950/30 px-4 py-3"
              >
                <span className="text-lg" aria-hidden>
                  {kindEmoji(e.kind)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-100 truncate">
                    {e.title}
                  </p>
                  {e.subtitle ? (
                    <p className="text-xs text-slate-400 truncate">{e.subtitle}</p>
                  ) : null}
                </div>
                <time className="text-[10px] font-semibold text-amber-400/70 whitespace-nowrap">
                  {new Date(e.at).toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* Tonight */}
      {tonightLines.length > 0 ? (
        <motion.section
          variants={itemVariants}
          className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-purple-950/80 via-purple-900/60 to-purple-950/90 p-6 space-y-4 shadow-[0_0_25px_rgba(212,175,55,0.1)]"
        >
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
            Tonight
          </h2>
          <ul className="space-y-3">
            {tonightLines.slice(0, 5).map((line) => (
              <li
                key={line}
                className="text-sm text-slate-200 font-medium leading-relaxed flex gap-2"
              >
                <span className="text-amber-400">✦</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </motion.section>
      ) : null}

      {insightResult.ok && insightResult.data.insight ? (
        <motion.section
          variants={itemVariants}
          className="grid gap-6 sm:grid-cols-2"
        >
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80 mb-3">
              Strengths
            </h3>
            <div className="flex flex-wrap gap-2">
              {insightResult.data.insight.strengths.map((s) => (
                <span
                  key={s}
                  className="text-xs font-semibold text-amber-200 bg-purple-950/60 border border-amber-500/30 px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.15)]"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80 mb-3">
              Growth
            </h3>
            <div className="flex flex-wrap gap-2">
              {insightResult.data.insight.growthAreas.map((g) => (
                <span
                  key={g}
                  className="text-xs font-semibold text-slate-300 bg-purple-950/40 border border-purple-800/40 px-3 py-1.5 rounded-full"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </motion.section>
      ) : null}
    </motion.div>
  );
}
