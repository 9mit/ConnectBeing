"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock } from "lucide-react";

import { listAchievementsAction } from "@/actions/achievements";

type AchievementItem = {
  code: string;
  title: string;
  description: string;
  icon: string;
  tier: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

const TIERS = [
  { value: "all", label: "All Trophies" },
  { value: "celestial", label: "👑 Celestial" },
  { value: "gold", label: "✨ Gold" },
  { value: "silver", label: "💎 Silver" },
  { value: "bronze", label: "🌟 Bronze" },
] as const;

function getTierStyle(tier: string, unlocked: boolean) {
  if (!unlocked) {
    return "border-purple-900/30 bg-purple-950/20 opacity-50 grayscale";
  }

  switch (tier) {
    case "celestial":
      return "border-amber-400 bg-gradient-to-br from-amber-500/30 via-purple-600/30 to-pink-500/30 shadow-[0_0_30px_rgba(212,175,55,0.4)]";
    case "gold":
      return "border-amber-500/60 bg-gradient-to-br from-amber-500/20 to-yellow-600/20 shadow-[0_0_20px_rgba(212,175,55,0.25)]";
    case "silver":
      return "border-slate-300/40 bg-gradient-to-br from-slate-400/20 to-purple-800/20 shadow-[0_0_15px_rgba(200,200,220,0.2)]";
    case "bronze":
    default:
      return "border-amber-700/40 bg-gradient-to-br from-amber-900/20 to-purple-950/40 shadow-sm";
  }
}

export function AchievementsPanel() {
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const res = await listAchievementsAction();
    if (res.ok) {
      setItems(res.data.items);
      setUnlockedCount(res.data.unlockedCount);
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filtered =
    filter === "all" ? items : items.filter((i) => i.tier === filter);

  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div className="space-y-1 text-center md:text-left">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            Couple Milestones & Badges
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Trophy Vault
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-md">
            Celebrate every milestone, ritual completed, and intimate memory forged in your universe.
          </p>
        </div>

        {/* Progress Display */}
        <div className="flex items-center gap-4 bg-purple-950/80 border border-amber-500/30 px-6 py-4 rounded-2xl shadow-inner">
          <div className="text-center">
            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400 font-display text-glow-gold">
              {progressPercent}%
            </span>
            <span className="block text-[9px] font-bold tracking-widest uppercase text-slate-400 mt-0.5">
              Completed
            </span>
          </div>
          <div className="w-px h-10 bg-amber-500/20" />
          <div className="text-center">
            <span className="text-2xl font-bold text-white font-display">
              {unlockedCount} / {totalCount}
            </span>
            <span className="block text-[9px] font-bold tracking-widest uppercase text-amber-400/80 mt-0.5">
              Unlocked
            </span>
          </div>
        </div>
      </div>

      {/* Tier Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {TIERS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(t.value)}
            className={`px-4 py-2 rounded-full text-xs font-bold tracking-wider uppercase transition-all whitespace-nowrap ${
              filter === t.value
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(212,175,55,0.2)]"
                : "bg-purple-950/40 text-slate-400 border border-purple-900/30 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Trophies Grid */}
      {loading ? (
        <p className="text-sm text-amber-300/70 italic py-12 text-center">Loading trophies…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2">
          {filtered.map((item, idx) => {
            const isUnlocked = item.unlocked;
            const style = getTierStyle(item.tier, isUnlocked);

            return (
              <motion.div
                key={item.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`rounded-2xl glass-panel p-5 border flex items-start gap-4 transition-all duration-300 ${style}`}
              >
                {/* Trophy Icon */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${
                    isUnlocked
                      ? "bg-amber-500/20 border-amber-400/60 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                      : "bg-purple-950/60 border-purple-800/40 text-slate-600"
                  }`}
                >
                  {isUnlocked ? item.icon : <Lock className="w-5 h-5 text-slate-500" />}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-white text-base font-display truncate">
                      {item.title}
                    </h3>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-900/40 text-amber-300 border border-amber-500/20 shrink-0">
                      {item.tier}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {item.description}
                  </p>

                  {isUnlocked && item.unlockedAt && (
                    <p className="text-[10px] text-amber-400/80 pt-1 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Unlocked on {new Date(item.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
