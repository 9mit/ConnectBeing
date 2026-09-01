"use client";

import { useEffect, useState, useTransition } from "react";
import { Shield, Key, CheckCircle2, Save, Laptop } from "lucide-react";

import {
  getSecurityStatusAction,
  updatePasswordAction,
  type SecurityStatusDTO,
} from "@/actions/security";

export function SecurityPanel() {
  const [status, setStatus] = useState<SecurityStatusDTO | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function loadStatus() {
    const res = await getSecurityStatusAction();
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

  function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const res = await updatePasswordAction({
        password: newPassword,
      });

      if (res.ok) {
        setNewPassword("");
        setConfirmPassword("");
        setSuccess("Password updated successfully across all sessions.");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(res.error.message);
      }
    });
  }

  if (loading) {
    return <p className="text-sm text-amber-300/70 italic py-12 text-center">Loading security posture…</p>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Account Hardening & Protection</span>
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Security Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            Session management, password updates, and brute-force protection status.
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

      {/* Security Status Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl glass-panel p-5 border border-amber-500/20 bg-purple-950/40 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
            Account Status
          </span>
          <span className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>Active & Protected</span>
          </span>
          <p className="text-[11px] text-slate-300">
            Registered: {status?.createdAt ? new Date(status.createdAt).toLocaleDateString() : "Active"}
          </p>
        </div>

        <div className="rounded-2xl glass-panel p-5 border border-amber-500/20 bg-purple-950/40 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
            Failed Logins (24h)
          </span>
          <span className="text-base font-bold text-amber-300">
            {status?.failedLoginAttempts ?? 0} Attempts
          </span>
          <p className="text-[11px] text-slate-300">
            Automatic rate limiting & lockout active.
          </p>
        </div>

        <div className="rounded-2xl glass-panel p-5 border border-amber-500/20 bg-purple-950/40 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
            Session Security
          </span>
          <span className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>HttpOnly JWT Cookie</span>
          </span>
          <p className="text-[11px] text-slate-300">
            Encrypted session, Strict SameSite.
          </p>
        </div>
      </div>

      {/* Password Update Card */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 space-y-5 shadow-lg">
        <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
          <Key className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-lg font-bold text-white font-display">Update Password</h2>
            <p className="text-xs text-slate-300">Choose a strong, unique password for your MadLove account.</p>
          </div>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-amber-500/30 bg-purple-950/60 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-amber-500/30 bg-purple-950/60 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={pending || !newPassword}
            className="btn-madlove-gold px-6 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{pending ? "Updating…" : "Update Password"}</span>
          </button>
        </form>
      </div>

      {/* Active Device Sessions Card */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 space-y-4 shadow-lg">
        <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
          <Laptop className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-lg font-bold text-white font-display">Active Session Details</h2>
            <p className="text-xs text-slate-300">Current device logged into {status?.email}.</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-amber-500/20 bg-purple-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Current Device Session</span>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active Now
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-purple-950/80 px-2.5 py-1 rounded-full border border-purple-800/40">
            Secure SSR Session
          </span>
        </div>
      </div>
    </div>
  );
}
