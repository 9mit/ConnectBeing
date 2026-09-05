"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  MessageSquare,
  Sparkles,
  Heart,
  Compass,
  Lightbulb,
} from "lucide-react";

import { getInsightsAction, refreshInsightsAction } from "@/actions/insights";

export type InsightsData = {
  insight: {
    archetype: string;
    strengths: string[];
    growthAreas: string[];
    suggestedTheme: string;
    dailyTaskStyle: string;
  } | null;
  dailyInsights: string[];
  discussionPrompts: string[];
  compatibility: {
    communication: number;
    qualityTime: number;
    planning: number;
    consistency: number;
    sharedInterests: number;
    overall: number;
  } | null;
  recommendations: Array<{
    category: string;
    title: string;
    description: string;
    reason: string;
  }>;
  habits: {
    suggestions: string[];
  };
};

function getHumanRhythmNotes(comp: InsightsData["compatibility"]) {
  const comm = comp?.communication ?? 80;
  const time = comp?.qualityTime ?? 85;
  const plan = comp?.planning ?? 75;

  return [
    {
      title: "Shared Sanctuary Time",
      description:
        time > 80
          ? "Evenings seem to be your favorite moments to connect, watch films, and unwind together."
          : "You haven't had a synchronized movie night in a few days. A shared quiet evening could be restorative.",
      tag: "Presence",
    },
    {
      title: "Conversational Warmth",
      description:
        comm > 80
          ? "Your connection thrives on empathetic daily check-ins and attentive, unspoken understanding."
          : "Simple one-line check-ins or leaving an unexpected note keeps the conversation breathing.",
      tag: "Dialogue",
    },
    {
      title: "Shared Horizons",
      description:
        plan > 80
          ? "You share a grounded anticipation for upcoming dates, time capsules, and future memories."
          : "A spontaneous upcoming date night or weekend plan would give you both a shared moment to look forward to.",
      tag: "Horizons",
    },
  ];
}

export function InsightsPanel({ initialData }: { initialData?: InsightsData | null }) {
  const [data, setData] = useState<InsightsData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function loadData() {
    const res = await getInsightsAction();
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!initialData) {
      void loadData();
    }
  }, [initialData]);

  function handleRefresh() {
    startTransition(async () => {
      const res = await refreshInsightsAction();
      if (res.ok) {
        await loadData();
      } else {
        setError(res.error.message);
      }
    });
  }

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-xs text-zinc-400 italic">
        Listening to your relationship rhythm…
      </div>
    );
  }

  const insight = data?.insight ?? {
    archetype: "nurture",
    strengths: [
      "Empathetic emotional check-ins",
      "Attentive presence in quiet moments",
      "Spontaneous thoughtful gestures",
    ],
    growthAreas: [
      "Planning long-term adventures",
      "Setting a recurring weekly date night",
    ],
    suggestedTheme: "rose",
    dailyTaskStyle: "nurture",
  };

  const humanRhythm = getHumanRhythmNotes(data?.compatibility ?? null);

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-400">
            Relationship Resonance
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-light text-[#f7f6f2] tracking-tight mt-1">
            Resonance & Rhythm
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Qualitative reflections on your connection, communication habits, and shared rituals.
          </p>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-all self-start sm:self-auto disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`} />
          <span>{pending ? "Reflecting…" : "Update Insights"}</span>
        </button>
      </div>

      {error && (
        <p className="p-3 rounded-xl text-xs font-medium text-rose-300 bg-rose-950/40 border border-rose-500/20 text-center">
          {error}
        </p>
      )}

      {/* Human Narrative Reflections (No cold KPI radar or percentages) */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-zinc-400">
          How We Connect
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          {humanRhythm.map((item) => (
            <div
              key={item.title}
              className="p-5 rounded-2xl bg-[#0e1017] border border-white/[0.06] flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-200/80">
                  {item.tag}
                </span>
                <h3 className="font-serif font-light text-base text-[#f7f6f2]">
                  {item.title}
                </h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Archetype & Organic Strengths */}
      <section className="grid gap-6 sm:grid-cols-2 items-stretch">
        {/* Dynamic Card */}
        <div className="p-6 rounded-2xl bg-[#0e1017] border border-white/[0.06] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-amber-200">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Connection Dynamic
              </span>
              <h3 className="font-serif font-light text-lg text-[#f7f6f2] capitalize">
                {insight.archetype} Rhythm
              </h3>
            </div>
          </div>

          <p className="text-xs text-zinc-400 font-light leading-relaxed">
            Your connection flourishes on emotional empathy, attentive check-ins, and quiet shared presence without needing constant performance.
          </p>

          <div className="pt-2 border-t border-white/[0.05] space-y-2">
            <h4 className="text-[11px] font-medium text-zinc-300 uppercase tracking-wide">
              Shared Anchors
            </h4>
            <ul className="space-y-1.5">
              {insight.strengths.map((s) => (
                <li key={s} className="text-xs text-zinc-400 flex items-center gap-2 font-light">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300/60 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Horizons Card */}
        <div className="p-6 rounded-2xl bg-[#0e1017] border border-white/[0.06] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Gentle Horizons
              </span>
              <h3 className="font-serif font-light text-lg text-[#f7f6f2]">
                New Spaces to Explore
              </h3>
            </div>
          </div>

          <p className="text-xs text-zinc-400 font-light leading-relaxed">
            Intentional micro-rituals and surprises that bring fresh laughter and deeper conversations into your weekly routine.
          </p>

          <div className="pt-2 border-t border-white/[0.05] space-y-2">
            <h4 className="text-[11px] font-medium text-zinc-300 uppercase tracking-wide">
              Suggestions for Tonight & Ahead
            </h4>
            <ul className="space-y-1.5">
              {insight.growthAreas.map((g) => (
                <li key={g} className="text-xs text-zinc-400 flex items-center gap-2 font-light">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Intimate Conversation Sparks */}
      {data?.discussionPrompts && data.discussionPrompts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-2">
            <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-zinc-400 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
              <span>Conversation Sparks</span>
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {data.discussionPrompts.slice(0, 4).map((prompt, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-[#0e1017] border border-white/[0.06] space-y-2"
              >
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-200/70">
                  Spark #{i + 1}
                </span>
                <p className="text-xs sm:text-sm font-serif font-light text-zinc-200 leading-relaxed italic">
                  &ldquo;{prompt}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
