"use client";

import { useEffect, useState, useTransition } from "react";
import { Key, Download, Trash2, CheckCircle2, Lock, AlertTriangle } from "lucide-react";

import {
  exportCoupleDataAction,
  getPrivacyStatusAction,
  requestCoupleDataDeletionAction,
  type PrivacyStatusDTO,
} from "@/actions/privacy";

export function PrivacyPanel() {
  const [status, setStatus] = useState<PrivacyStatusDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletedMsg, setDeletedMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function loadStatus() {
    const res = await getPrivacyStatusAction();
    if (res.ok) {
      setStatus(res.data);
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  function handleExport() {
    startTransition(async () => {
      setError(null);
      const res = await exportCoupleDataAction();
      if (res.ok) {
        // Create browser download
        const blob = new Blob([res.data.exportPayload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `madlove-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setError(res.error.message);
      }
    });
  }

  function handleDeleteCouple() {
    startTransition(async () => {
      setError(null);
      const res = await requestCoupleDataDeletionAction();
      if (res.ok) {
        setDeletedMsg("Couple data deletion scheduled. Your couple link has been dissolved.");
        setDeleteConfirm(false);
      } else {
        setError(res.error.message);
      }
    });
  }

  if (loading) {
    return <p className="text-sm text-amber-300/70 italic py-12 text-center">Loading privacy status…</p>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Zero-Trust Couple Isolation</span>
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Privacy Center & Keys
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            End-to-end encryption keys, couple boundary guarantees, and data ownership controls.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2 rounded-xl text-center">
          {error}
        </p>
      )}

      {deletedMsg && (
        <p className="text-sm font-semibold text-amber-300 bg-amber-950/70 border border-amber-500/30 px-4 py-2 rounded-xl text-center">
          {deletedMsg}
        </p>
      )}

      {/* Privacy Guarantees Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl glass-panel p-5 border border-amber-500/20 bg-purple-950/40 space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Couple Isolation</span>
          </div>
          <p className="text-xs text-slate-300">
            Strict server-side validation. No other couple or user can read your chats, photos, or data.
          </p>
        </div>

        <div className="rounded-2xl glass-panel p-5 border border-amber-500/20 bg-purple-950/40 space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>On-Device RIE Intelligence</span>
          </div>
          <p className="text-xs text-slate-300">
            Relationship insights compute deterministically on-device and local server. Chats are never sent to third-party LLMs.
          </p>
        </div>

        <div className="rounded-2xl glass-panel p-5 border border-amber-500/20 bg-purple-950/40 space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Zero-Knowledge Media</span>
          </div>
          <p className="text-xs text-slate-300">
            Ephemeral media self-destructs upon viewing. Permanent memories are protected with signed scoped URLs.
          </p>
        </div>
      </div>

      {/* E2EE Keys Section */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 space-y-5 shadow-lg">
        <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
          <Key className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-lg font-bold text-white font-display">End-to-End Cryptographic Keys</h2>
            <p className="text-xs text-slate-300">ECDH P-256 public keys used for encrypting your direct messages.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 text-xs">
          <div className="space-y-1.5">
            <span className="font-bold text-amber-300 uppercase tracking-wider block">
              Your Public Key Fingerprint
            </span>
            <div className="bg-purple-950/60 p-3 rounded-xl border border-amber-500/20 font-mono text-[11px] text-slate-300 break-all select-all">
              {status?.myPublicKey || "Key generated on device"}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="font-bold text-purple-300 uppercase tracking-wider block">
              Partner Public Key Fingerprint
            </span>
            <div className="bg-purple-950/60 p-3 rounded-xl border border-purple-800/30 font-mono text-[11px] text-slate-300 break-all select-all">
              {status?.partnerPublicKey || "Partner key synced"}
            </div>
          </div>
        </div>
      </div>

      {/* Data Ownership & Export */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 space-y-5 shadow-lg">
        <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
          <Download className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-lg font-bold text-white font-display">Data Ownership & Export</h2>
            <p className="text-xs text-slate-300">Download a complete sanitized archive of your memories, stats, and calendar moments.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-300 space-y-1">
            <p>Vault contains: <strong className="text-amber-200">{status?.totalMemories ?? 0} memories</strong> and <strong className="text-amber-200">{status?.totalMoods ?? 0} vibe check-ins</strong>.</p>
            <p className="text-slate-400">Export format: Machine-readable JSON</p>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={handleExport}
            className="btn-madlove-gold px-5 py-2.5 text-xs font-bold flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{pending ? "Exporting…" : "Export Couple Data"}</span>
          </button>
        </div>
      </div>

      {/* Delete / Dissolve Space */}
      <div className="rounded-3xl glass-panel border border-red-500/30 bg-red-950/20 p-6 md:p-8 space-y-4 shadow-md">
        <div className="flex items-center gap-3 border-b border-red-500/20 pb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div>
            <h2 className="text-lg font-bold text-white font-display">Dissolve Couple & Purge Data</h2>
            <p className="text-xs text-slate-300">Permanently delete your couple universe, memories, and shared links.</p>
          </div>
        </div>

        {!deleteConfirm ? (
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="px-5 py-2.5 rounded-xl border border-red-500/40 bg-red-500/10 text-xs font-bold text-red-300 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Request Account & Data Wipe</span>
          </button>
        ) : (
          <div className="p-4 rounded-xl border border-red-500/50 bg-red-950/60 space-y-3">
            <p className="text-xs font-bold text-red-200">
              Are you sure? This action will unlink both partners and permanently mark the couple as dissolved.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleDeleteCouple}
                className="px-4 py-1.5 rounded-lg bg-red-600 text-xs font-bold text-white hover:bg-red-700 transition-all"
              >
                {pending ? "Wiping Data…" : "Yes, Dissolve Space"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
