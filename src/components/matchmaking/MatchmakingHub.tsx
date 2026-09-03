"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Shield,
  Clock,
  Sparkles,
  MapPin,
  MessageCircle,
  Flag,
  UserX,
  Send,
  Pause,
  Play,
  CheckCircle2,
} from "lucide-react";

import {
  setMatchmakingConsentAction,
  setMatchmakingPausedAction,
  getNextCandidateAction,
  respondToCandidateAction,
  getConnectionsAction,
  getConnectionMessagesAction,
  sendConnectionMessageAction,
  reportAndBlockCandidateAction,
} from "@/actions/matchmaking";
import { PrivacySafeMatchCard } from "@/features/matchmaking";

interface Props {
  initialStatus: {
    hasProfile: boolean;
    enabled: boolean;
    paused: boolean;
    age?: number;
    countryCode?: string;
  };
}

export function MatchmakingHub({ initialStatus }: Props) {
  const [enabled, setEnabled] = useState(initialStatus.enabled);
  const [paused, setPaused] = useState(initialStatus.paused);
  const [activeTab, setActiveTab] = useState<"discover" | "connections" | "settings">("discover");

  const [candidate, setCandidate] = useState<PrivacySafeMatchCard | null>(null);
  const [loadingCandidate, setLoadingCandidate] = useState(false);
  const [pending, startTransition] = useTransition();

  // Connections
  const [connections, setConnections] = useState<
    Array<{
      id: string;
      partnerAge: number;
      partnerCountry: string;
      compatibilityScore: number;
      reasons: string[];
      createdAt: string;
    }>
  >([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      senderId: string;
      content: string;
      createdAt: string;
      isMine: boolean;
    }>
  >([]);
  const [newMessage, setNewMessage] = useState("");

  // Report Modal
  const [reportingCandidateId, setReportingCandidateId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("inappropriate_behavior");
  const [reportDetails, setReportDetails] = useState("");

  // Feedback notifications
  const [feedback, setFeedback] = useState<string | null>(null);

  // Load next candidate when enabled
  const fetchNextCandidate = () => {
    setLoadingCandidate(true);
    startTransition(async () => {
      const res = await getNextCandidateAction();
      if (res.ok) {
        setCandidate(res.data);
      }
      setLoadingCandidate(false);
    });
  };

  const fetchConnections = () => {
    startTransition(async () => {
      const res = await getConnectionsAction();
      if (res.ok) {
        setConnections(res.data);
      }
    });
  };

  useEffect(() => {
    if (enabled && !paused) {
      fetchNextCandidate();
      fetchConnections();
    }
  }, [enabled, paused]);

  useEffect(() => {
    if (selectedConnectionId) {
      startTransition(async () => {
        const res = await getConnectionMessagesAction(selectedConnectionId);
        if (res.ok) {
          setMessages(res.data);
        }
      });
    }
  }, [selectedConnectionId]);

  const handleConsent = (optIn: boolean) => {
    startTransition(async () => {
      const res = await setMatchmakingConsentAction(optIn);
      if (res.ok) {
        setEnabled(optIn);
        setFeedback(optIn ? "Welcome to MadLove Compatibility Discovery." : "Matchmaking disabled.");
      }
    });
  };

  const handleTogglePause = () => {
    startTransition(async () => {
      const nextState = !paused;
      const res = await setMatchmakingPausedAction(nextState);
      if (res.ok) {
        setPaused(nextState);
        setFeedback(nextState ? "Matchmaking paused." : "Matchmaking resumed.");
      }
    });
  };

  const handleRespond = (action: "interested" | "passed" | "saved_later") => {
    if (!candidate) return;
    const cid = candidate.candidateId;
    startTransition(async () => {
      const res = await respondToCandidateAction({
        candidateId: cid,
        action,
      });

      if (res.ok) {
        if (res.data.mutualMatch) {
          setFeedback("❤️ Mutual Match! You both expressed interest. An introduction is open!");
          fetchConnections();
        } else if (action === "interested") {
          setFeedback("Interest noted privately. If they also express interest, you'll be connected.");
        } else if (action === "passed") {
          setFeedback("Profile skipped.");
        }
        fetchNextCandidate();
      }
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConnectionId || !newMessage.trim()) return;

    const text = newMessage.trim();
    setNewMessage("");

    startTransition(async () => {
      const res = await sendConnectionMessageAction({
        connectionId: selectedConnectionId,
        content: text,
      });
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: res.data.id,
            senderId: "me",
            content: text,
            createdAt: new Date().toISOString(),
            isMine: true,
          },
        ]);
      }
    });
  };

  const handleReportAndBlock = () => {
    if (!reportingCandidateId) return;
    startTransition(async () => {
      await reportAndBlockCandidateAction({
        candidateId: reportingCandidateId,
        category: reportReason,
        details: reportDetails,
      });
      setReportingCandidateId(null);
      setReportDetails("");
      setFeedback("User reported and blocked. You will never be matched again.");
      fetchNextCandidate();
      fetchConnections();
    });
  };

  // State 1: Consent Screen (Not yet opted in)
  if (!enabled) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 py-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-purple-950/60 text-[11px] font-bold uppercase tracking-widest text-amber-300">
            <span>✨</span> Privacy-First Compatibility
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 font-display text-glow-gold">
            “I Wanna Try My Luck”
          </h1>
          <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            Discover a potentially compatible person based on values, interests, communication preferences, and lifestyle patterns.
          </p>
        </div>

        <div className="p-8 rounded-3xl border border-amber-500/30 bg-purple-950/40 backdrop-blur-2xl space-y-6 shadow-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-amber-400" />
            Our Privacy Guarantees
          </h2>

          <div className="grid gap-4 text-xs sm:text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Adult-Only (18+):</strong> Matchmaking is strictly restricted to adults. Enforced server-side.</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Zero Identity Exposure:</strong> Other candidates never see your email, name, or phone number.</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>No Precise Location:</strong> Only standard country codes (e.g. IN, US) are used for broad time-zone compatibility. Exact GPS or city is never exposed.</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Mutual Consent Required:</strong> A connection is only unlocked when both of you independently express interest.</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Complete Control:</strong> You can pause matching or permanently leave the matchmaking pool at any time.</span>
            </div>
          </div>

          <div className="pt-6 border-t border-amber-500/20 flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => handleConsent(true)}
              className="flex-1 py-3.5 px-6 rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50"
            >
              {pending ? "Setting up..." : "Opt-In & Enter Discovery ✨"}
            </button>
            <Link
              href="/invite"
              className="py-3.5 px-6 rounded-2xl border border-purple-800/60 bg-purple-950/40 text-slate-300 font-bold text-xs uppercase tracking-widest hover:text-white hover:border-amber-500/40 transition-all text-center"
            >
              I Have a Partner Instead
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Active Matchmaking Hub
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-2">
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center justify-between shadow-lg"
          >
            <span>{feedback}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-amber-400 hover:text-amber-100 text-xs px-2 py-0.5"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-amber-500/20">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 font-display text-glow-gold">
            Compatibility Discovery
          </h1>
          <p className="text-xs text-slate-400">
            {paused ? "Discovery is paused." : "Active · Matching based on meaningful values."}
          </p>
        </div>

        <div className="flex items-center gap-2 p-1 rounded-2xl border border-amber-500/20 bg-purple-950/40 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab("discover")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "discover"
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/30 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Discover ✨
          </button>
          <button
            onClick={() => {
              setActiveTab("connections");
              fetchConnections();
            }}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "connections"
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/30 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Connections</span>
            {connections.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                {connections.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "settings"
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/30 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Settings ⚙️
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "discover" && (
        <div className="space-y-6">
          {paused ? (
            <div className="p-12 text-center rounded-3xl border border-amber-500/20 bg-purple-950/30 backdrop-blur-2xl space-y-4">
              <Pause className="w-10 h-10 text-amber-400 mx-auto opacity-70" />
              <h2 className="text-xl font-bold text-white">Discovery is Paused</h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                You won&apos;t receive new candidate suggestions while paused. Your profile is temporarily hidden from new evaluations.
              </p>
              <button
                onClick={handleTogglePause}
                className="mt-2 py-2.5 px-6 rounded-xl border border-amber-500/50 bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider hover:bg-amber-500 hover:text-slate-950 transition-all"
              >
                Resume Discovery
              </button>
            </div>
          ) : loadingCandidate ? (
            <div className="p-16 text-center rounded-3xl border border-amber-500/20 bg-purple-950/20 space-y-4">
              <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
                Finding compatible alignment...
              </p>
            </div>
          ) : candidate ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-3xl border border-amber-500/30 bg-gradient-to-b from-purple-950/70 to-[#07020f]/90 backdrop-blur-3xl p-6 sm:p-8 shadow-2xl space-y-6"
            >
              {/* Card Top: Country & Age & Badge */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-amber-500/30 flex items-center justify-center text-xl font-bold text-amber-300 font-display">
                    {candidate.age}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-slate-300 text-sm font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>{candidate.countryCode}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 capitalize">
                      {candidate.relationshipGoals.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                    {candidate.compatibilityLevel} Compatibility
                  </span>
                  <button
                    type="button"
                    onClick={() => setReportingCandidateId(candidate.candidateId)}
                    aria-label="Report or Block"
                    className="p-2 rounded-xl border border-purple-800/40 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-all"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Shared Interests & Hobbies */}
              <div className="space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-amber-400/80">
                  Interests & Vibe
                </h3>
                <div className="flex flex-wrap gap-2">
                  {candidate.interests.map((item) => (
                    <span
                      key={item}
                      className="px-3 py-1.5 rounded-xl border border-amber-500/20 bg-purple-900/30 text-xs text-amber-100 font-medium"
                    >
                      {item}
                    </span>
                  ))}
                  {candidate.hobbies.map((item) => (
                    <span
                      key={item}
                      className="px-3 py-1.5 rounded-xl border border-purple-800/40 bg-purple-950/40 text-xs text-slate-300 font-medium"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Communication Style */}
              <div className="p-4 rounded-2xl border border-amber-500/15 bg-purple-950/30 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70">
                  Conversation Rhythm
                </span>
                <p className="text-xs text-slate-200">
                  Preferred communication style is <strong>{candidate.communicationStyle}</strong>.
                </p>
              </div>

              {/* Why This Match */}
              <div className="space-y-2.5 pt-2">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-amber-400/80 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Why we think you may get along
                </h3>
                <div className="grid gap-2">
                  {candidate.matchReasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-slate-300"
                    >
                      <span className="text-amber-400 font-bold mt-0.5">✓</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision Action Buttons */}
              <div className="pt-6 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleRespond("interested")}
                  className="py-3.5 px-4 rounded-2xl border border-rose-500/50 bg-gradient-to-r from-rose-500/30 to-amber-500/30 text-white font-bold text-xs uppercase tracking-wider hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.25)] disabled:opacity-50"
                >
                  <Heart className="w-4 h-4 text-rose-400" />
                  Meet Them ❤️
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleRespond("saved_later")}
                  className="py-3.5 px-4 rounded-2xl border border-purple-800/50 bg-purple-950/40 text-slate-300 font-bold text-xs uppercase tracking-wider hover:text-white hover:border-amber-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Clock className="w-4 h-4 text-amber-400" />
                  Show Me Later
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleRespond("passed")}
                  className="py-3.5 px-4 rounded-2xl border border-slate-800 bg-slate-950/40 text-slate-400 font-bold text-xs uppercase tracking-wider hover:text-rose-300 hover:border-rose-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Not For Me
                </button>
              </div>
            </motion.div>
          ) : (
            /* Empty State */
            <div className="p-16 text-center rounded-3xl border border-amber-500/20 bg-purple-950/20 backdrop-blur-xl space-y-4">
              <Sparkles className="w-10 h-10 text-amber-400/60 mx-auto" />
              <h2 className="text-lg font-bold text-white">No New Candidates Right Now</h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                We prioritize high-quality, thoughtful compatibility over endless feeds. We will notify you when someone compatible joins.
              </p>
              <button
                onClick={fetchNextCandidate}
                className="mt-2 py-2 px-5 rounded-xl border border-amber-500/30 bg-purple-950/50 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition-all"
              >
                Refresh Discovery
              </button>
            </div>
          )}
        </div>
      )}

      {/* Connections Tab */}
      {activeTab === "connections" && (
        <div className="space-y-6">
          {connections.length === 0 ? (
            <div className="p-16 text-center rounded-3xl border border-amber-500/20 bg-purple-950/20 space-y-3">
              <Heart className="w-10 h-10 text-rose-400/50 mx-auto" />
              <h2 className="text-lg font-bold text-white">No Mutual Connections Yet</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                When you and another candidate both click &quot;Meet Them ❤️&quot;, your mutual introduction will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Connections List */}
              <div className="space-y-3 md:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
                  Mutual Introductions
                </span>
                <div className="space-y-2">
                  {connections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConnectionId(c.id)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all ${
                        selectedConnectionId === c.id
                          ? "border-amber-500/60 bg-amber-500/15 text-amber-100 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                          : "border-purple-800/40 bg-purple-950/40 text-slate-300 hover:bg-purple-900/50"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>Candidate · {c.partnerAge}</span>
                        <span className="text-emerald-400">{c.compatibilityScore}%</span>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-amber-400" /> {c.partnerCountry}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Thread */}
              <div className="md:col-span-2 rounded-3xl border border-amber-500/30 bg-[#0c0418]/90 backdrop-blur-2xl p-6 flex flex-col h-[500px]">
                {selectedConnectionId ? (
                  <>
                    <div className="pb-3 border-b border-amber-500/15 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs">
                          ✨
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white">Safe Introduction Chat</h3>
                          <p className="text-[10px] text-slate-400">
                            Separate from couple vault. Respect each other&apos;s boundaries.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setReportingCandidateId(selectedConnectionId)}
                        className="text-[10px] text-rose-400 hover:text-rose-200 border border-rose-500/30 px-2 py-1 rounded-lg"
                      >
                        Block / Report
                      </button>
                    </div>

                    {/* Messages Container */}
                    <div className="flex-1 overflow-y-auto py-4 space-y-3">
                      {messages.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs">
                          Say hello and start your conversation with an open curiosity!
                        </div>
                      ) : (
                        messages.map((m) => (
                          <div
                            key={m.id}
                            className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                                m.isMine
                                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-100"
                                  : "bg-purple-950/60 border border-purple-800/40 text-slate-200"
                              }`}
                            >
                              {m.content}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Chat Input */}
                    <form onSubmit={handleSendMessage} className="pt-3 border-t border-amber-500/15 flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Write a thoughtful message..."
                        className="flex-1 rounded-xl border border-amber-500/30 bg-purple-950/50 px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="submit"
                        disabled={pending || !newMessage.trim()}
                        className="p-2.5 rounded-xl border border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition-all disabled:opacity-40"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                    <MessageCircle className="w-8 h-8 opacity-40 mb-2" />
                    Select an introduction from the list to chat.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="p-8 rounded-3xl border border-amber-500/20 bg-purple-950/30 backdrop-blur-2xl space-y-6">
          <h2 className="text-base font-bold text-white">Matchmaking Preferences & Safety</h2>

          <div className="divide-y divide-amber-500/15 text-xs">
            <div className="py-4 flex items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-slate-200">Pause Matchmaking</h4>
                <p className="text-slate-400 text-[11px]">
                  Temporarily hide your profile from new recommendations without deleting your data.
                </p>
              </div>
              <button
                onClick={handleTogglePause}
                className={`py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  paused
                    ? "border border-amber-500/50 bg-amber-500 text-slate-950"
                    : "border border-amber-500/30 bg-amber-500/15 text-amber-200"
                }`}
              >
                {paused ? "Resume Matching" : "Pause Matching"}
              </button>
            </div>

            <div className="py-4 flex items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-rose-300">Disable & Leave Matchmaking</h4>
                <p className="text-slate-400 text-[11px]">
                  Opt out completely from the matchmaking discovery pool.
                </p>
              </div>
              <button
                onClick={() => handleConsent(false)}
                className="py-2 px-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
              >
                Disable Matchmaking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      <AnimatePresence>
        {reportingCandidateId && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-3xl border border-rose-500/30 bg-[#0d0218] space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Flag className="w-4 h-4" />
                Report & Block Candidate
              </div>
              <p className="text-xs text-slate-300">
                Reporting immediately blocks this person so you will never see or be matched with them again.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl border border-amber-500/30 bg-purple-950/60 text-white focus:outline-none"
                  >
                    <option value="inappropriate_behavior">Inappropriate Behavior</option>
                    <option value="harassment">Harassment or Abuse</option>
                    <option value="spam">Spam / Bot / Commercial</option>
                    <option value="fake_account">Suspicious / Fake Profile</option>
                    <option value="unwanted_contact">Unwanted Contact</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Additional Details (Optional)</label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Briefly describe what happened..."
                    className="w-full mt-1 p-2.5 rounded-xl border border-amber-500/30 bg-purple-950/60 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleReportAndBlock}
                  className="flex-1 py-2.5 rounded-xl border border-rose-500 bg-rose-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-rose-500 transition-all"
                >
                  Confirm & Block
                </button>
                <button
                  type="button"
                  onClick={() => setReportingCandidateId(null)}
                  className="py-2.5 px-4 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
