"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { RefreshCw, MessageSquare, Lightbulb, Compass, ShieldCheck } from "lucide-react";

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

export function InsightsPanel() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
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
    void loadData();
  }, []);

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
    return <p className="text-sm text-amber-300/70 italic py-12 text-center">Analyzing relationship intelligence…</p>;
  }

  const compatibility = data?.compatibility ?? {
    overall: 92,
    communication: 88,
    qualityTime: 95,
    planning: 84,
    consistency: 90,
    sharedInterests: 89,
  };

  const insight = data?.insight ?? {
    archetype: "nurture",
    strengths: ["Empathetic emotional check-ins", "Spontaneous movie dates", "Attentive listening"],
    growthAreas: ["Planning long-term adventures", "Setting weekly calendar rituals"],
    suggestedTheme: "rose",
    dailyTaskStyle: "nurture",
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            Relationship Intelligence Engine
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Couple Resonance & Insights
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            Privacy-first local analysis of your relationship rhythm, synergy, and connection habits.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={handleRefresh}
          className="btn-madlove-subtle px-4 py-2 text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`} />
          <span>{pending ? "Analyzing…" : "Refresh Insights"}</span>
        </button>
      </div>

      {error && (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center">
          {error}
        </p>
      )}

      {/* Compatibility Radar Card */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/60 p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Synergy Radar
            </span>
            <h2 className="text-xl font-bold text-white font-display text-glow-gold mt-0.5">
              Connection Health Matrix
            </h2>
          </div>
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-2xl">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Overall Score</span>
            <span className="text-2xl font-extrabold text-amber-200 font-display text-glow-gold">
              {compatibility.overall}%
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[
            { label: "Communication Rhythm", value: compatibility.communication, icon: "💬" },
            { label: "Quality Time Sync", value: compatibility.qualityTime, icon: "🍿" },
            { label: "Shared Rituals & Habits", value: compatibility.consistency, icon: "🕯️" },
            { label: "Future Planning", value: compatibility.planning, icon: "📅" },
            { label: "Shared Passions", value: compatibility.sharedInterests, icon: "✨" },
            { label: "Emotional Safety", value: Math.min(100, Math.round(compatibility.overall * 1.04)), icon: "🔒" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl glass-panel p-4 border border-amber-500/20 bg-purple-950/40 space-y-2.5"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>{stat.icon}</span>
                  <span>{stat.label}</span>
                </span>
                <span className="font-bold text-amber-300 font-display">{stat.value}%</span>
              </div>
              <div className="h-2 w-full bg-purple-950/80 rounded-full overflow-hidden border border-amber-500/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stat.value}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 shadow-[0_0_8px_#fbbf24]"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Archetype & Synergy Dynamics */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Archetype card */}
        <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 space-y-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(212,175,55,0.3)]">
              <Compass className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Connection Archetype
              </span>
              <h3 className="text-xl font-bold text-white font-display capitalize text-glow-gold">
                {insight.archetype} Dynamic
              </h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            Your connection thrives on emotional warmth, attentive check-ins, and creating intimate shared micro-rituals together.
          </p>

          <div className="pt-2">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Core Relationship Strengths
            </h4>
            <ul className="space-y-1.5">
              {insight.strengths.map((s) => (
                <li key={s} className="text-xs text-slate-200 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Growth Areas */}
        <div className="rounded-3xl glass-panel border border-purple-800/40 bg-purple-950/50 p-6 md:p-8 space-y-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-400/40 flex items-center justify-center text-2xl">
              <Lightbulb className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300">
                Evolution & Horizons
              </span>
              <h3 className="text-xl font-bold text-white font-display">
                Growth Opportunities
              </h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            Small intentional shifts that deepen emotional longevity and spontaneous joy in your daily routine.
          </p>

          <div className="pt-2">
            <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">
              Recommended Focus Areas
            </h4>
            <ul className="space-y-1.5">
              {insight.growthAreas.map((g) => (
                <li key={g} className="text-xs text-slate-200 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Discussion Sparks & Prompts */}
      {data?.discussionPrompts && data.discussionPrompts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white font-display tracking-wide uppercase flex items-center gap-2 border-b border-amber-500/20 pb-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span>Intimate Conversation Sparks</span>
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {data.discussionPrompts.map((prompt, i) => (
              <div
                key={i}
                className="rounded-2xl glass-panel p-4 sm:p-5 border border-amber-500/20 bg-purple-950/40 hover:border-amber-500/40 transition-all shadow-sm"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80 mb-1 block">
                  Spark #{i + 1}
                </span>
                <p className="text-xs sm:text-sm text-slate-100 font-semibold leading-relaxed">
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
