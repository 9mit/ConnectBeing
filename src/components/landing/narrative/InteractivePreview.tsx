"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Film,
  Smile,
  Lock,
  Play,
  Pause,
  Send,
  Radio,
  ShieldCheck,
} from "lucide-react";

type TabId = "chat" | "theater" | "capsule" | "presence";

export function InteractivePreview() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [typedMessage, setTypedMessage] = useState("");
  const [messages, setMessages] = useState<
    Array<{ sender: "you" | "partner"; text: string; time: string }>
  >([
    {
      sender: "partner",
      text: "The room is set up. Ready for movie night? 🍿",
      time: "8:42 PM",
    },
    {
      sender: "you",
      text: "Snacks ready. Joining our space now ✨",
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
    <section id="experience" className="landing-section relative py-20 px-4 md:px-8">
      <div className="relative z-10 mx-auto max-w-4xl">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-zinc-400/80 mb-3">
            Chapter II · The Sanctuary Space
          </p>
          <h2 className="font-serif text-[clamp(2.2rem,5vw,3.6rem)] font-light tracking-[-0.015em] leading-[1.12] text-[#fbf9f4]">
            Designed for Everyday Intimacy.
          </h2>
          <p className="mt-3 text-sm md:text-base text-zinc-300/80 font-sans font-light">
            Every feature works in quiet synchrony, shared exclusively between the two of you.
          </p>
        </div>

        {/* Quiet Editorial Frame */}
        <div className="console-frame">
          {/* Navigation Bar */}
          <div className="console-titlebar flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
              <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
                Shared Space
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`console-tab flex items-center gap-1.5 ${
                  activeTab === "chat" ? "active" : ""
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Whisper Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("theater")}
                className={`console-tab flex items-center gap-1.5 ${
                  activeTab === "theater" ? "active" : ""
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Together Cinema</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("capsule")}
                className={`console-tab flex items-center gap-1.5 ${
                  activeTab === "capsule" ? "active" : ""
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Time Capsule</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("presence")}
                className={`console-tab flex items-center gap-1.5 ${
                  activeTab === "presence" ? "active" : ""
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span>Resonance</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6 md:p-8 min-h-[380px] bg-black/15">
            <AnimatePresence mode="wait">
              {/* TAB 1: CHAT */}
              {activeTab === "chat" && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-xl mx-auto flex flex-col h-[340px] p-2"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                      <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-300">Connected</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
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
                              ? "bg-[#fbf9f4] text-[#09070f] font-medium rounded-tr-sm shadow-sm"
                              : "bg-white/[0.05] text-white/90 rounded-tl-sm border border-white/[0.06]"
                          }`}
                        >
                          {m.text}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-1 px-1 font-mono">{m.time}</span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendMessage} className="pt-3 border-t border-white/[0.06] flex gap-2">
                    <input
                      type="text"
                      value={typedMessage}
                      onChange={(e) => setTypedMessage(e.target.value)}
                      placeholder="Type a quiet note..."
                      className="flex-1 bg-white/[0.03] border border-white/10 rounded-full px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
                    />
                    <button
                      type="submit"
                      aria-label="Send message"
                      className="px-4 py-2 rounded-full bg-[#fbf9f4] text-[#09070f] font-semibold text-xs hover:bg-white transition-colors"
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
                  className="max-w-xl mx-auto space-y-4"
                >
                  <div className="relative aspect-video rounded-xl bg-[#06040a] border border-white/[0.06] p-6 flex flex-col justify-between overflow-hidden shadow-2xl">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/80">
                        <Radio className="w-3 h-3 text-rose-300/80 animate-pulse" />
                        <span className="font-mono text-[11px] tracking-wider uppercase">Synchronized</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono tracking-wider">
                        DRIFT: ±0.01s · PHASE-LOCKED
                      </div>
                    </div>

                    <div className="text-center py-4 space-y-1">
                      <h4 className="font-serif text-2xl md:text-3xl text-[#fbf9f4] font-light tracking-wide">
                        Midnight in Paris
                      </h4>
                      <p className="text-xs text-zinc-400 tracking-wider font-sans">Shared cinema room</p>
                    </div>

                    <div className="space-y-2 bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/[0.06]">
                      <div className="flex items-center justify-between text-xs text-zinc-300">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsPlaying(!isPlaying)}
                            aria-label={isPlaying ? "Pause" : "Play"}
                            className="p-1 hover:text-white transition-colors"
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <span className="font-mono text-[11px] text-white/90">{formattedPlayback}</span>
                          <span className="text-white/30">/</span>
                          <span className="font-mono text-[11px] text-zinc-500">02:00:00</span>
                        </div>
                        <span className="text-[11px] text-emerald-400/80 font-mono">In Unison</span>
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#fbf9f4] transition-all duration-300"
                          style={{ width: `${(playbackTime / 7200) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: CAPSULE */}
              {activeTab === "capsule" && (
                <motion.div
                  key="capsule"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-lg mx-auto p-4 space-y-6"
                >
                  <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-white/[0.04] text-zinc-300">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-serif text-xl font-light text-[#fbf9f4]">
                          First Anniversary Letter
                        </h4>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          Date-locked until October 14, 2026
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-300 font-serif leading-relaxed italic">
                    &ldquo;Writing this while you are asleep next to me. Save this for the day we celebrate one full year in our new home…&rdquo;
                  </p>

                  <div className="p-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>Cryptographic Seal</span>
                    <span className="text-zinc-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> Sealed
                    </span>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: PRESENCE */}
              {activeTab === "presence" && (
                <motion.div
                  key="presence"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-lg mx-auto p-4 space-y-8"
                >
                  <div className="text-center space-y-2">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 font-mono">
                      Pairwise Distance
                    </span>
                    <div className="font-serif text-5xl text-[#fbf9f4] font-light">
                      3,480 <span className="text-sm font-mono text-zinc-400 tracking-widest uppercase">km</span>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono">San Francisco ↔ New York</p>
                  </div>

                  <div className="space-y-4">
                    <span className="text-xs text-zinc-400 font-medium tracking-wider uppercase font-mono">Resonance State:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: "calm", label: "Quiet Evening ☕" },
                        { id: "voice", label: "Need Voice 🎙️" },
                        { id: "inspired", label: "Inspired ✨" },
                        { id: "cuddle", label: "Warmth 🤍" },
                      ].map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVibe(v.id)}
                          className={`p-3 rounded-xl border text-center text-xs transition-all ${
                            selectedVibe === v.id
                              ? "bg-white/[0.08] border-white/20 text-[#fbf9f4]"
                              : "bg-white/[0.02] border-white/[0.04] text-zinc-400 hover:text-white"
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
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
