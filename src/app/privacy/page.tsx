import Link from "next/link";
import { ArrowLeft, Lock, Shield, Key, EyeOff, HardDriveDownload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PrivacyPanel } from "@/components/privacy-panel";
import { getAuthenticatedUserContext } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Privacy & Data Protection"),
  description: "End-to-end encryption keys, couple isolation guarantees, and complete data ownership.",
};

export default async function PrivacyPage() {
  const ctx = await getAuthenticatedUserContext();

  if (ctx.activeCouple && ctx.user) {
    return (
      <AppShell coupleId={ctx.activeCouple.id} userId={ctx.user.id}>
        <PrivacyPanel />
      </AppShell>
    );
  }

  // Public Privacy Policy view
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400/20 selection:text-amber-200">
      <header className="border-b border-amber-500/20 bg-slate-950/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to {BRAND.name}</span>
          </Link>
          <div className="text-right">
            <span className="font-display font-extrabold tracking-widest text-amber-300 text-sm">{BRAND.mark}</span>
            <span className="block text-[9px] uppercase tracking-[0.2em] text-slate-400">Sanctuary For Two</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-purple-950/50 text-[11px] font-bold text-amber-300 uppercase tracking-widest">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Cryptographic Privacy Commitment</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold font-display tracking-tight text-white">
            Privacy & Data Sovereignty Policy
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            {BRAND.name} is engineered around a radical principle: an audience of exactly one. Your conversations, photos, time capsules, and watch sessions are strictly pair-isolated and never commodified.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-amber-500/20 bg-purple-950/30 p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Shield className="w-5 h-5" />
              <h2 className="text-base font-semibold text-white">Strict Zero-Knowledge Routing</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every message and media transmission is bound strictly to your two authenticated partner identities. No other couple or user can access your room, data, or stream.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-purple-950/30 p-6 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <EyeOff className="w-5 h-5" />
              <h2 className="text-base font-semibold text-white">Zero Telemetry & Zero Ads</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              We do not run ad networks, data brokers, or behavioral tracking pixels. Your intimacy is not monetized, mined, or sold.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-purple-950/30 p-6 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <Key className="w-5 h-5" />
              <h2 className="text-base font-semibold text-white">Pairwise ECDH P-256 E2EE</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Whisper chat messages utilize ECDH P-256 key exchange derived locally on user devices. Private keys never leave your device storage.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-purple-950/30 p-6 space-y-3">
            <div className="flex items-center gap-2 text-purple-400 font-bold">
              <HardDriveDownload className="w-5 h-5" />
              <h2 className="text-base font-semibold text-white">Complete Data Portability & Deletion</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Both partners possess full sovereignty: export your complete shared archive at any time or trigger cryptographic dissolution with one click.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Last updated: September 2026 · {BRAND.name} Platform
          </p>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs tracking-wider uppercase transition-colors"
          >
            Sign In to Sanctuary
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        {BRAND.name} · Two lights. One sky.
      </footer>
    </div>
  );
}
