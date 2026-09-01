"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Image as ImageIcon,
  Smile,
  ShieldCheck,
  Heart,
  Sparkles,
  Film,
  Lock,
  Radio,
  Mic,
} from "lucide-react";

const MOODS = [
  { emoji: "🥰", text: "Craving cuddles", color: "from-rose-500/25 to-pink-600/25", border: "border-rose-500/40", textCol: "text-rose-200" },
  { emoji: "✨", text: "Excited & inspired", color: "from-amber-500/25 to-yellow-600/25", border: "border-amber-500/40", textCol: "text-amber-200" },
  { emoji: "☕", text: "Slow calm evening", color: "from-purple-500/25 to-indigo-600/25", border: "border-purple-500/40", textCol: "text-purple-200" },
  { emoji: "🥺", text: "Need your voice", color: "from-pink-500/25 to-rose-600/25", border: "border-pink-500/40", textCol: "text-pink-200" },
];

export function InteractivePreview() {
  const [activeTab, setActiveTab] = useState("chat");
  const [now, setNow] = useState<Date | null>(null);
  const [selectedMoodIdx, setSelectedMoodIdx] = useState(0);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const timeLabel = useMemo(
    () =>
      now
        ? now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : "8:45 PM",
    [now],
  );

  const activeMood = MOODS[selectedMoodIdx]!;

  const tabs = useMemo(
    () => [
      {
        id: "chat",
        label: "Secret Chat",
        icon: MessageSquare,
        title: "End-to-End Encrypted Messaging",
        desc: "Direct messages encrypted with client-side ECDH P-256 keys. Even the database only ever stores ciphertexts.",
        previewContent: (
          <div className="space-y-4 font-sans max-w-sm mx-auto p-6 rounded-3xl border border-amber-500/30 bg-purple-950/60 backdrop-blur-2xl shadow-2xl">
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                <span className="text-xs font-bold text-slate-100 font-sans">Partner Online</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full shadow-inner">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                <span>E2EE Active</span>
              </div>
            </div>

            {/* Message Thread */}
            <div className="space-y-3 pt-1 text-xs">
              <div className="flex flex-col items-start max-w-[88%]">
                <div className="rounded-2xl rounded-tl-sm bg-purple-900/60 border border-amber-500/20 px-4 py-3 text-slate-200 leading-relaxed shadow-sm">
                  Movie night still on for tonight? Picked out the snacks 🍿
                </div>
                <span className="text-[9px] text-slate-400 mt-1 ml-2">{timeLabel}</span>
              </div>

              <div className="flex flex-col items-end ml-auto max-w-[88%]">
                <div className="rounded-2xl rounded-tr-sm bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-600 px-4 py-3 text-purple-950 font-bold leading-relaxed shadow-lg shadow-amber-500/20">
                  Yes! Virtual theater is set up. See you in our room 💕
                </div>
                <div className="flex items-center gap-1.5 mt-1 mr-2 text-[9px] text-amber-300">
                  <span className="font-bold">Read</span>
                  <span>·</span>
                  <span>{timeLabel}</span>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "mood",
        label: "Live Vibe Sync",
        icon: Smile,
        title: "Instant Emotional Resonance",
        desc: "Tap your mood to broadcast your vibe in real time. Nudge your partner with gentle celestial chimes.",
        previewContent: (
          <div className="space-y-6 font-sans max-w-sm mx-auto">
            {/* Interactive Selector */}
            <div className="flex justify-center gap-2.5">
              {MOODS.map((m, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedMoodIdx(idx)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-300 border ${
                    selectedMoodIdx === idx
                      ? "bg-amber-500/20 border-amber-400 scale-110 shadow-[0_0_20px_rgba(212,175,55,0.35)]"
                      : "bg-purple-950/40 border-purple-800/40 hover:border-amber-500/30"
                  }`}
                  aria-label={`Select ${m.text}`}
                >
                  {m.emoji}
                </button>
              ))}
            </div>

            {/* High Fidelity Vibe Card */}
            <motion.div
              key={selectedMoodIdx}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`p-6 rounded-3xl border ${activeMood.border} bg-gradient-to-b ${activeMood.color} backdrop-blur-xl text-center shadow-xl space-y-2`}
            >
              <div className="text-5xl filter drop-shadow-md animate-bounce">{activeMood.emoji}</div>
              <div>
                <h4 className={`text-base font-bold tracking-wide ${activeMood.textCol} font-display`}>
                  {activeMood.text}
                </h4>
                <p className="text-[11px] text-slate-300/80 font-medium mt-1">
                  Synced with partner · {timeLabel}
                </p>
              </div>
            </motion.div>
          </div>
        ),
      },
      {
        id: "memories",
        label: "Memory Vault",
        icon: ImageIcon,
        title: "Chronological Love Archive",
        desc: "A tamper-proof vault of milestones, photos, and time-locked letters that only unlock on future anniversaries.",
        previewContent: (
          <div className="space-y-5 font-sans max-w-md mx-auto">
            <div className="relative h-44 flex items-center justify-center">
              {/* Polaroid 1 */}
              <div className="absolute w-36 polaroid-card p-3 rounded-2xl shadow-xl transform -rotate-6 -translate-x-12 translate-y-2 hover:-translate-y-1 transition-transform">
                <div className="aspect-square rounded-xl bg-gradient-to-br from-rose-500/20 to-purple-600/20 flex items-center justify-center border border-white/10">
                  <Heart className="w-6 h-6 text-rose-400 fill-rose-400/40" />
                </div>
                <div className="text-[11px] font-serif text-slate-200 text-center mt-2 font-bold">
                  Starlight Cafe ☕
                </div>
              </div>

              {/* Polaroid 2 */}
              <div className="absolute w-36 polaroid-card p-3 rounded-2xl shadow-2xl transform rotate-6 translate-x-12 translate-y-1 hover:-translate-y-2 transition-transform z-10 border-amber-500/40">
                <div className="aspect-square rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/20 flex items-center justify-center border border-amber-500/30">
                  <Sparkles className="w-6 h-6 text-amber-300" />
                </div>
                <div className="text-[11px] font-serif text-amber-200 text-center mt-2 font-bold">
                  Road Trip 🚗
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center bg-purple-950/60 border border-amber-500/30 px-5 py-3 rounded-2xl text-xs shadow-inner">
              <span className="text-slate-300 font-medium">Vault Security</span>
              <span className="text-amber-300 font-mono font-bold">Scoped Scoped URLs</span>
            </div>
          </div>
        ),
      },
      {
        id: "together",
        label: "Virtual Theater",
        icon: Film,
        title: "Synchronized Together Room",
        desc: "4K synchronized video player with sub-100ms drift correction, floating live reactions, and push-to-talk voice.",
        previewContent: (
          <div className="space-y-4 font-sans max-w-sm mx-auto p-5 rounded-3xl border border-cyan-500/30 bg-purple-950/70 backdrop-blur-2xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span className="text-xs font-bold text-white">4K Sync Stream</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-cyan-200 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                <Mic className="w-3 h-3 text-cyan-400" />
                <span>Push to Talk</span>
              </div>
            </div>

            <div className="aspect-video rounded-2xl bg-black/80 border border-white/10 flex items-center justify-center text-3xl">
              🍿✨💕
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono text-slate-300 pt-1">
              <span className="text-cyan-300 font-bold">Interstellar</span>
              <span>Playing · 0ms Drift</span>
            </div>
          </div>
        ),
      },
    ],
    [timeLabel, selectedMoodIdx, activeMood],
  );

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0]!;

  return (
    <section
      className="landing-section relative z-10"
      aria-label="Interactive preview"
    >
      <div className="mx-auto w-full max-w-5xl px-5 md:px-8">
        <div className="max-w-xl mb-12 text-left">
          <div className="stardust-pill mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Interactive Interface Preview</span>
          </div>
          <h2 className="display-lg text-white font-serif tracking-tight">
            Feel the experience
          </h2>
          <p className="mt-4 text-sm text-slate-300 font-sans font-light leading-relaxed">
            Switch between modules to preview the intimate atmosphere of your shared home.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-t border-amber-500/20 pt-10">
          {/* Navigation Controls */}
          <div className="lg:col-span-5 space-y-6">
            <div
              className="flex flex-col gap-2.5"
              role="tablist"
              aria-label="Preview modules"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3.5 px-5 py-4 rounded-2xl text-sm font-bold transition-all text-left ${
                      isActive
                        ? "bg-amber-500/20 border border-amber-400/50 text-amber-200 shadow-[0_0_20px_rgba(212,175,55,0.25)]"
                        : "bg-purple-950/30 border border-purple-900/30 text-slate-300 hover:bg-purple-900/40 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-amber-300" : "text-slate-400"}`} aria-hidden />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 4 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 text-left"
              >
                <h3 className="text-xl font-serif font-bold text-white text-glow-gold">{currentTab.title}</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">{currentTab.desc}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Screen Preview Card */}
          <div className="lg:col-span-7 flex items-center justify-center p-6 md:p-10 rounded-3xl glass-card-luxury border border-amber-500/30 min-h-[380px] relative overflow-hidden shadow-2xl">
            <div className="absolute -left-20 -top-20 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

            <div className="w-full relative z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTab.id}
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ duration: 0.25 }}
                >
                  {currentTab.previewContent}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
