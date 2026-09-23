"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  Sparkles,
  Film,
  MessageSquare,
  Radio,
  Heart,
  Calendar,
  ArrowRight,
  Smile,
  Clock,
} from "lucide-react";

import { SITE } from "@/content/site";
import { capitalizeMood } from "@/lib/format";
import { usePresence } from "@/components/presence-provider";
import { setMoodAction } from "@/actions/mood";
import { formatWeekdayDate, formatDateShort } from "@/lib/date";

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

const MOOD_OPTIONS = [
  { value: "happy", label: "Happy", emoji: "😊" },
  { value: "cuddles", label: "Cuddly", emoji: "🤍" },
  { value: "excited", label: "Excited", emoji: "✨" },
  { value: "space", label: "Space", emoji: "🌙" },
  { value: "low", label: "Low", emoji: "🌧️" },
] as const;

function getTimeSalutation(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getPetReactionText(petState: string, petName: string): string {
  switch (petState) {
    case "thriving":
      return `${petName} is thriving in the warmth of your connection.`;
    case "happy":
      return `${petName} is playing happily in your sanctuary.`;
    case "sad":
      return `${petName} is curled up, waiting for your next shared moment.`;
    case "neglected":
      return `${petName} could use a gentle touch or shared check-in today.`;
    default:
      return `${petName} is peacefully resting in your shared space.`;
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
  const { partnerOnline, nudgePartner, nudgePending } = usePresence();
  const [mounted, setMounted] = useState(false);
  const [nudgeToast, setNudgeToast] = useState<string | null>(null);
  const [currentMineMood, setCurrentMineMood] = useState<string | null>(
    moods.ok ? moods.data.mine?.mood ?? null : null,
  );
  const [isSettingMood, startMoodTransition] = useTransition();

  const partnerMood = capitalizeMood(moods.ok ? moods.data.partner?.mood : null);
  const petName = pet.ok && pet.data.petName ? pet.data.petName : SITE.defaultPetName;
  const petState = pet.ok ? pet.data.petState : "neutral";

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleNudge() {
    const res = await nudgePartner();
    setNudgeToast(res.message || (res.ok ? "Ping sent" : "Failed"));
    setTimeout(() => setNudgeToast(null), 2800);
  }

  function handleQuickMood(m: string) {
    setCurrentMineMood(m);
    startMoodTransition(async () => {
      await setMoodAction({ mood: m });
    });
  }

  // Generate a human-readable insight
  const archetype = insightResult.ok && insightResult.data.insight
    ? insightResult.data.insight.archetype
    : "Nurturing";

  const featuredPrompt =
    insightResult.ok && insightResult.data.discussionPrompts?.length > 0
      ? insightResult.data.discussionPrompts[0]
      : "What was the sweetest surprise from this past week?";

  const recs = insightResult.ok ? insightResult.data.recommendations : undefined;
  const featuredActivity =
    recs && recs.length > 0
      ? recs[0]
      : {
          title: "Private Cinema Night",
          description: "Sync a favorite film or show in your Together room.",
        };

  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* 1. Header: Greeting & Intimate Relationship Presence */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-white/[0.06] pb-6">
          <div>
            <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-400">
              {daysTogetherLabel}
              {partnerName ? ` with ${partnerName}` : ""}
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif font-light text-[#f7f6f2] tracking-tight mt-1">
              {mounted ? getTimeSalutation() : "Welcome back"}
            </h1>
          </div>

          {/* Intimate Partner Presence Indicator */}
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto pt-1 sm:pt-0">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <span
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  partnerOnline
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                    : "bg-zinc-600"
                }`}
                aria-hidden
              />
              <span>
                {partnerName ? partnerName : "Partner"} is{" "}
                <span className={partnerOnline ? "text-[#f7f6f2] font-medium" : "text-zinc-400"}>
                  {partnerOnline ? "here with you" : "away"}
                </span>
              </span>
            </div>

            {/* Quick Ping */}
            <button
              type="button"
              disabled={nudgePending}
              onClick={handleNudge}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-full text-xs font-medium border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:text-white hover:border-white/[0.18] transition-all touch-manipulation active:scale-95"
              title="Ping your partner"
            >
              <Radio className="w-3 h-3 text-amber-300/80" />
              <span>{nudgePending ? "Pinging…" : "Ping"}</span>
            </button>

            {nudgeToast && (
              <span className="text-xs text-amber-200 animate-fade-in font-medium">
                {nudgeToast}
              </span>
            )}
          </div>
        </div>

        {/* First Day Welcome Moment (quiet & elegant, no loud purple box) */}
        {daysTogether <= 1 && partnerName && (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-300 leading-relaxed">
              <span className="text-amber-200 font-medium">Your sanctuary is live.</span>{" "}
              {partnerName} has joined your shared 2-person digital home.
            </p>
            <Link
              href="/chat"
              className="text-xs font-medium text-amber-200 hover:text-white shrink-0 inline-flex items-center gap-1 transition-colors"
            >
              <span>Say hello</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </section>

      {/* 2. TODAY: One Coherent Journey (No 3-column equal boxes) */}
      <section className="space-y-6">
        <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-2">
          <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-zinc-400">
            Today
          </h2>
          <span className="text-xs text-zinc-400">
            {formatWeekdayDate(new Date())}
          </span>
        </div>

        {/* Daily Emotional Check-In & Ritual */}
        <div className="grid gap-6 md:grid-cols-2 items-stretch">
          {/* How are you two feeling? */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#0e1015] border border-white/[0.06] flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-400">
                Connection Ritual
              </span>
              <h3 className="text-lg font-serif font-light text-[#f7f6f2] mt-0.5">
                How are you feeling right now?
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {currentMineMood
                  ? `You are feeling ${capitalizeMood(currentMineMood)}. Tap to adjust.`
                  : "Share your vibe with your partner in one touch."}
              </p>
            </div>

            {/* Quick Mood Selection */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {MOOD_OPTIONS.map((opt) => {
                const isSelected = currentMineMood === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isSettingMood}
                    onClick={() => handleQuickMood(opt.value)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-full text-xs font-medium transition-all touch-manipulation active:scale-95 ${
                      isSelected
                        ? "bg-white/15 text-white border border-white/25 shadow-sm"
                        : "bg-white/[0.03] text-zinc-300 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Partner's current state */}
            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-xs text-zinc-400">
              <span>{partnerName || "Partner"}’s mood:</span>
              <span className="text-zinc-200 font-medium">
                {partnerMood || "Not checked in yet"}
              </span>
            </div>
          </div>

          {/* Daily Quiz & Question */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#0e1015] border border-white/[0.06] flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-400">
                Daily Discovery
              </span>
              <h3 className="text-lg font-serif font-light text-[#f7f6f2] mt-0.5">
                Today’s Connection Prompt
              </h3>
              <p className="text-xs text-zinc-300 italic mt-2 leading-relaxed">
                &ldquo;{featuredPrompt}&rdquo;
              </p>
            </div>

            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
              <Link
                href="/quiz"
                className="text-xs font-medium text-zinc-300 hover:text-white inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Answer Daily Quiz</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href="/chat"
                className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1 transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Discuss in Chat</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TONIGHT: One Focused Shared Moment */}
      <section className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#12141c] to-[#0c0d12] border border-white/[0.08] relative overflow-hidden">
        <div className="max-w-xl space-y-3 relative z-10">
          <span className="text-[11px] font-medium tracking-wider uppercase text-amber-200/90 flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5" />
            <span>Shared Evening</span>
          </span>
          <h2 className="text-xl sm:text-2xl font-serif font-light text-[#f7f6f2] tracking-tight">
            {featuredActivity.title}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 font-light leading-relaxed">
            {featuredActivity.description}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link
              href="/together"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-full bg-[#f7f6f2] text-[#07080b] text-xs font-semibold hover:bg-white hover:shadow-md transition-all active:scale-[0.98]"
            >
              <span>Start in Together Room</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/calendar"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 min-h-[44px] rounded-full border border-white/[0.08] text-xs text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Night</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. YOUR LIVING SANCTUARY: Companion & Relationship Resonance */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-2">
          <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-zinc-400">
            Our Living World
          </h2>
          <Link
            href="/insights"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Resonance details →
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 items-stretch">
          {/* Companion Buddy (living expression, not a statistics card) */}
          <Link
            href="/pet"
            className="p-5 rounded-2xl bg-[#0e1015] border border-white/[0.06] hover:border-white/[0.14] transition-all flex items-center gap-4 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 text-xl group-hover:scale-105 transition-transform">
              <Heart className="w-6 h-6 text-rose-300/80" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-[#f7f6f2] truncate">
                  {petName}
                </h3>
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
                  · {petState}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {getPetReactionText(petState, petName)}
              </p>
            </div>
          </Link>

          {/* Relationship Resonance (Human insight instead of artificial Match 31%) */}
          <Link
            href="/insights"
            className="p-5 rounded-2xl bg-[#0e1015] border border-white/[0.06] hover:border-white/[0.14] transition-all flex items-center gap-4 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 text-xl group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6 text-amber-200/80" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-[#f7f6f2] capitalize">
                  {archetype} Dynamic
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Your connection rhythm is grounded in warm empathy and quiet shared rituals.
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* 5. FROM YOUR STORY: Chronological Moments (Not a generic card list) */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-2">
          <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-zinc-400">
            From Your Story
          </h2>
          <Link
            href="/timeline"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Full timeline →
          </Link>
        </div>

        {!recentUs.ok ? (
          <p className="text-xs text-zinc-400">{recentUs.error.message}</p>
        ) : recentUs.data.events.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#0e1015] border border-white/[0.06] text-center space-y-2">
            <Clock className="w-5 h-5 text-zinc-500 mx-auto" />
            <p className="text-xs text-zinc-300 font-medium">Your story is just starting.</p>
            <p className="text-xs text-zinc-500">
              Check in today or share a movie night — moments will weave into your timeline automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recentUs.data.events.slice(0, 4).map((e) => (
              <div
                key={`${e.kind}-${e.id}`}
                className="p-4 rounded-xl bg-[#0e1015] border border-white/[0.06] flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0 text-xs text-zinc-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#f7f6f2] truncate">
                    {e.title}
                  </p>
                  {e.subtitle && (
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {e.subtitle}
                    </p>
                  )}
                  <time className="text-[10px] text-zinc-500 block mt-1">
                    {formatDateShort(e.at)}
                  </time>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
