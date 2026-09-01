"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Palette, Volume2, Heart, Check, Save } from "lucide-react";

import {
  getCoupleSettingsAction,
  updateCoupleSettingsAction,
} from "@/actions/settings";

const THEMES = [
  { id: "rose-dusk", name: "Rose Dusk", accent: "from-rose-500 to-purple-800", desc: "Intimate velvet crimson & deep twilight" },
  { id: "midnight-violet", name: "Midnight Violet", accent: "from-purple-600 to-indigo-900", desc: "Regal violet abyss & ethereal glow" },
  { id: "imperial-gold", name: "Imperial Gold", accent: "from-amber-400 to-yellow-700", desc: "Opulent starlight & golden warmth" },
  { id: "celestial-sky", name: "Celestial Sky", accent: "from-sky-400 to-blue-900", desc: "Galactic cyan & serene starlight" },
] as const;

export function SettingsPanel() {
  const [theme, setTheme] = useState<string>("rose-dusk");
  const [petName, setPetName] = useState("Buddy");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ambientGlow, setAmbientGlow] = useState(true);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function loadSettings() {
    const res = await getCoupleSettingsAction();
    if (res.ok) {
      setTheme(res.data.theme);
      setPetName(res.data.petName);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const res = await updateCoupleSettingsAction({
        theme: theme as "rose-dusk" | "midnight-violet" | "imperial-gold" | "celestial-sky",
        petName,
      });

      if (res.ok) {
        // Apply theme to document
        document.documentElement.setAttribute("data-theme", theme);
        setSuccess("Settings saved successfully!");
        setTimeout(() => setSuccess(null), 3000);
        await loadSettings();
      } else {
        setError(res.error.message);
      }
    });
  }

  if (loading) {
    return <p className="text-sm text-amber-300/70 italic py-12 text-center">Loading settings…</p>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            Personalize Your Space
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Couple Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            Customize visual themes, pet companion name, and app ambiance.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2 rounded-xl text-center">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm font-semibold text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-4 py-2 rounded-xl text-center">
          {success}
        </p>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Theme Customizer Card */}
        <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 space-y-5 shadow-lg">
          <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
            <Palette className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold text-white font-display">Aesthetic & Theme Palette</h2>
              <p className="text-xs text-slate-300">Choose the emotional atmosphere of your shared home.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {THEMES.map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    isSelected
                      ? "border-amber-400 bg-amber-500/15 shadow-[0_0_20px_rgba(212,175,55,0.25)]"
                      : "border-purple-900/40 bg-purple-950/40 hover:border-amber-500/30 hover:bg-purple-900/40"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${t.accent} shrink-0 shadow-inner flex items-center justify-center`}>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm font-display">{t.name}</h3>
                    <p className="text-[11px] text-slate-300 font-medium leading-snug mt-0.5">{t.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Digital Pet Settings */}
        <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 space-y-4 shadow-lg">
          <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
            <Heart className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold text-white font-display">Digital Pet Companion</h2>
              <p className="text-xs text-slate-300">Name the shared companion that grows with your relationship.</p>
            </div>
          </div>

          <div className="max-w-sm space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Pet Name
            </label>
            <input
              type="text"
              required
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              className="w-full rounded-xl border border-amber-500/30 bg-purple-950/60 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Ambiance & Sound Toggles */}
        <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 space-y-4 shadow-lg">
          <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
            <Volume2 className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold text-white font-display">Experience & Ambiance</h2>
              <p className="text-xs text-slate-300">Micro-animations and sound effects toggles.</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-purple-900/40 bg-purple-950/40 cursor-pointer">
              <div>
                <span className="text-xs font-bold text-white block">In-App Audio & Nudge Chimes</span>
                <span className="text-[11px] text-slate-400">Play subtle chimes on nudges and call invites.</span>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-400"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-purple-900/40 bg-purple-950/40 cursor-pointer">
              <div>
                <span className="text-xs font-bold text-white block">Celestial Background Glows</span>
                <span className="text-[11px] text-slate-400">Ambient radial lighting and smooth glow effects.</span>
              </div>
              <input
                type="checkbox"
                checked={ambientGlow}
                onChange={(e) => setAmbientGlow(e.target.checked)}
                className="w-4 h-4 accent-amber-400"
              />
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="btn-madlove-gold px-8 py-3 text-xs font-bold flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{pending ? "Saving Changes…" : "Save Settings"}</span>
          </button>
        </div>
      </form>

      {/* Quick Security & Privacy Links */}
      <div className="grid gap-3 sm:grid-cols-3 pt-4">
        <Link
          href="/privacy"
          className="rounded-2xl glass-panel p-4 border border-purple-900/40 hover:border-amber-500/30 text-center space-y-1 group"
        >
          <span className="text-xl">🔒</span>
          <h3 className="text-xs font-bold text-white group-hover:text-amber-200">Privacy Center</h3>
          <p className="text-[10px] text-slate-400">E2EE keys & data isolation</p>
        </Link>

        <Link
          href="/security"
          className="rounded-2xl glass-panel p-4 border border-purple-900/40 hover:border-amber-500/30 text-center space-y-1 group"
        >
          <span className="text-xl">🛡️</span>
          <h3 className="text-xs font-bold text-white group-hover:text-amber-200">Security Center</h3>
          <p className="text-[10px] text-slate-400">Sessions & password updates</p>
        </Link>

        <Link
          href="/verify"
          className="rounded-2xl glass-panel p-4 border border-purple-900/40 hover:border-amber-500/30 text-center space-y-1 group"
        >
          <span className="text-xl">✓</span>
          <h3 className="text-xs font-bold text-white group-hover:text-amber-200">Verification Gate</h3>
          <p className="text-[10px] text-slate-400">Weekly couple sync status</p>
        </Link>
      </div>
    </div>
  );
}
