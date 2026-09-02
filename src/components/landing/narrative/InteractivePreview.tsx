"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Film,
  Smile,
  Lock,
  Sparkles,
  Play,
  Pause,
  Send,
  Radio,
  Clock,
  Heart,
  ShieldCheck,
} from "lucide-react";

type TabId = "chat" | "theater" | "presence" | "capsule" | "synergy";

export function InteractivePreview() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [typedMessage, setTypedMessage] = useState("");
  const [messages, setMessages] = useState<
    Array<{ sender: "you" | "partner"; text: string; time: string }>
  >([
    {
      sender: "partner",
      text: "Virtual theater room is set up. Ready for movie night? 🍿",
      time: "8:42 PM",
    },
    {
      sender: "you",
      text: "Snacks ready. Joining our sanctuary room now 💕",
      time: "8:43 PM",
    },
  ]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackTime, setPlaybackTime] = useState(5058); // 01:24:18
  const [selectedVibe, setSelectedVibe] = useState("calm");

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlaybackTime((t) => (t >= 7200 ? 0 : t + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const formattedPlayback = useMemo(() => {
    const hrs = Math.floor(playbackTime / 3600);
    const mins = Math.floor((playbackTime % 3600) / 60);
    const secs = playbackTime % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [playbackTime]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedMessage.trim()) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    setMessages((prev) => [
      ...prev,
      {
        sender: "you",
        text: typedMessage.trim(),
        time: timeStr,
      },
    ]);
    setTypedMessage("");
  };

  return (
    <section id="demo" className="landing-section relative py-20 px-4 md:px-8">
      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="sanctuary-pill mb-3 inline-flex">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Interactive Sanctuary Preview</span>
          </div>
          <h2 className="display-lg text-[#fbf9f4] tracking-tight">
            Designed for Everyday Intimacy.
          </h2>
          <p className="mt-3 text-sm md:text-base text-zinc-300 font-sans font-light">
            Take a hands-on tour of your private space. Every feature works in real-time, just between the two of you.
          </p>
        </div>

        {/* Console Frame */}
        <div className="console-frame border border-white/15 bg-[#10081c]/80 shadow-2xl">
          {/* Tabs Bar */}
          <div className="console-titlebar flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0d0717]/90 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
              <span className="font-serif text-sm font-semibold text-zinc-200">
                Couple Sanctuary
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`console-tab flex items-center gap-1.5 ${
                  activeTab === "chat" ? "active" : ""
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Secret Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("theater")}
                className={`console-tab flex items-center gap-1.5 ${
                  activeTab === "theater" ? "active" : ""
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Together Theater</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("presence")}
                className={`console-tab flex items-center gap-1.5 ${
                  activeTab === "presence" ? "active" : ""
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span>Mood &amp; Presence</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("capsule")}
                className={`console-tab flex items-center gap-1.5 ${
                  activeTab === "capsule" ? "active" : ""
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Memory Capsule</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("synergy")}
                className={`console-tab flex items-center gap-1.5 ${
                  activeTab === "synergy" ? "active" : ""
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Synergy</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-5 md:p-8 min-h-[420px] bg-[#080410]/70">
            <AnimatePresence mode="wait">
              {/* TAB 1: CHAT */}
              {activeTab === "chat" && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-xl mx-auto flex flex-col h-[380px] sanctuary-card p-5"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-semibold text-zinc-200">Partner Online</span>
                    </div>
                    <span className="text-[11px] text-sky-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> End-to-End Encrypted
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto py-4 space-y-3 font-sans text-xs">
                    {messages.map((m, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${
                          m.sender === "you" ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[82%] px-4 py-2.5 rounded-2xl ${
                            m.sender === "you"
                              ? "bg-gradient-to-r from-sky-400 to-sky-500 text-black font-medium rounded-tr-sm shadow-md"
                              : "bg-white/10 text-zinc-100 rounded-tl-sm border border-white/10"
                          }`}
                        >
                          {m.text}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-1 px-1">{m.time}</span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendMessage} className="pt-3 border-t border-white/10 flex gap-2">
                    <input
                      type="text"
                      value={typedMessage}
                      onChange={(e) => setTypedMessage(e.target.value)}
                      placeholder="Type a message to your partner..."
                      className="flex-1 bg-black/40 border border-white/15 rounded-full px-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-400"
                    />
                    <button
                      type="submit"
                      className="btn-cta-primary px-4 py-2 text-xs rounded-full"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </motion.div>
              )}

              {/* TAB 2: THEATER */}
              {activeTab === "theater" && (
                <motion.div
                  key="theater"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-2xl mx-auto space-y-4"
                >
                  <div className="relative aspect-video rounded-xl bg-gradient-to-br from-purple-950/60 via-black/80 to-sky-950/40 border border-white/15 p-6 flex flex-col justify-between overflow-hidden shadow-2xl">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-white/15 text-zinc-200">
                        <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
                        <span>Synchronized 4K Stream</span>
                      </div>
                      <div className="text-[11px] text-sky-400 font-mono">
                        DRIFT: ±0.016s · PERFECT SYNC
                      </div>
                    </div>

                    <div className="text-center py-4 space-y-1">
                      <h4 className="font-serif text-2xl md:text-3xl text-zinc-100 font-bold">
                        Midnight in Paris
                      </h4>
                      <p className="text-xs text-zinc-400">Watching together right now</p>
                    </div>

                    <div className="space-y-2 bg-black/60 backdrop-blur p-3 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between text-xs text-zinc-300">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="p-1.5 hover:text-sky-400 transition-colors"
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <span className="font-mono text-[11px]">{formattedPlayback}</span>
                          <span className="text-zinc-600">/</span>
                          <span className="font-mono text-[11px] text-zinc-500">02:00:00</span>
                        </div>
                        <span className="text-[11px] text-emerald-400">Both Devices Locked</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-rose-400 transition-all duration-300"
                          style={{ width: `${(playbackTime / 7200) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: PRESENCE */}
              {activeTab === "presence" && (
                <motion.div
                  key="presence"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-xl mx-auto sanctuary-card p-6 space-y-6"
                >
                  <div className="text-center space-y-1">
                    <span className="text-[11px] uppercase tracking-wider text-sky-400 font-semibold">
                      Real-Time Distance &amp; Presence
                    </span>
                    <div className="font-serif text-4xl text-zinc-100">
                      3,480 <span className="text-lg text-sky-400 font-sans">km apart</span>
                    </div>
                    <p className="text-xs text-zinc-400">San Francisco ↔ New York</p>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs text-zinc-300 font-medium">Broadcast How You Feel:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: "calm", label: "Calm Evening ☕" },
                        { id: "voice", label: "Need Voice 🎙️" },
                        { id: "inspired", label: "Inspired ✨" },
                        { id: "cuddle", label: "Craving Cuddles 🥰" },
                      ].map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVibe(v.id)}
                          className={`p-3 rounded-xl border text-center text-xs transition-all ${
                            selectedVibe === v.id
                              ? "bg-sky-500/20 border-sky-400 text-white shadow-lg"
                              : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: CAPSULE */}
              {activeTab === "capsule" && (
                <motion.div
                  key="capsule"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-xl mx-auto sanctuary-card p-6 space-y-5"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-serif text-lg font-bold text-zinc-100">
                          Our 1st Anniversary Letter
                        </h4>
                        <span className="text-[11px] text-amber-300">
                          Date-locked until October 14, 2026
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                    &ldquo;Writing this while you are asleep on the couch next to me. Save this for the day we celebrate one full year in our new home…&rdquo;
                  </p>

                  <div className="p-3 bg-black/40 border border-white/10 rounded-lg flex items-center justify-between text-xs text-zinc-400">
                    <span>Cryptographic Seal: Active</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" /> Verified
                    </span>
                  </div>
                </motion.div>
              )}

              {/* TAB 5: SYNERGY */}
              {activeTab === "synergy" && (
                <motion.div
                  key="synergy"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-xl mx-auto sanctuary-card p-6 space-y-5"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div>
                      <h4 className="font-serif text-lg font-bold text-zinc-100">
                        Couple Synergy Score
                      </h4>
                      <p className="text-xs text-zinc-400">Calculated privately on your devices</p>
                    </div>
                    <span className="text-sm font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-3 py-1 rounded-full">
                      96% Synergy
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    {[
                      { label: "Communication Rhythm & Warmth", val: 94 },
                      { label: "Quality Time & Movie Nights", val: 98 },
                      { label: "Milestone Consistency & Rituals", val: 92 },
                    ].map((s) => (
                      <div key={s.label} className="space-y-1.5">
                        <div className="flex justify-between text-zinc-300">
                          <span>{s.label}</span>
                          <span className="font-semibold text-sky-400">{s.val}%</span>
                        </div>
                        <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 via-rose-400 to-amber-400 rounded-full"
                            style={{ width: `${s.val}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
