import Link from "next/link";
import { ArrowLeft, ShieldCheck, Database, KeyRound, Cpu, Terminal } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SecurityPanel } from "@/components/security-panel";
import { getAuthenticatedUserContext } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Security Center"),
  description: "Account protection, cryptographic architecture, and session security.",
};

export default async function SecurityPage() {
  const ctx = await getAuthenticatedUserContext();

  if (ctx.activeCouple && ctx.user) {
    return (
      <AppShell coupleId={ctx.activeCouple.id} userId={ctx.user.id}>
        <SecurityPanel />
      </AppShell>
    );
  }

  // Public Security Architecture Overview
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
            <span className="block text-[9px] uppercase tracking-[0.2em] text-slate-400">Security Architecture</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-purple-950/50 text-[11px] font-bold text-amber-300 uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Security Architecture & Threat Model</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold font-display tracking-tight text-white">
            Security Overview
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            {BRAND.name} implements defense-in-depth: strict server-side authorization, cryptographic session signing, PostgreSQL Row Level Security (RLS), and isolated real-time channel topics.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-amber-500/20 bg-purple-950/30 p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Database className="w-5 h-5" />
              <h2 className="text-base font-semibold text-white">Database Row-Level Security (RLS)</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every database query enforces PostgreSQL tenant isolation. PostgreSQL functions verify active couple membership at the engine level, preventing cross-tenant leakage.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-purple-950/30 p-6 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <KeyRound className="w-5 h-5" />
              <h2 className="text-base font-semibold text-white">HMAC Signed Session Tokens</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Session state uses cryptographically signed, HTTP-only, SameSite=Lax cookies with minimal claims. Tokens cannot be forged or tampered with on the client.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-purple-950/30 p-6 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Cpu className="w-5 h-5" />
              <h2 className="text-base font-semibold text-white">Deterministic Authorization</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Authorization derives strictly from authenticated server identity: Auth User → User Record → Couple Membership. Client-supplied IDs are never trusted as authority.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-purple-950/30 p-6 space-y-3">
            <div className="flex items-center gap-2 text-purple-400 font-bold">
              <Terminal className="w-5 h-5" />
              <h2 className="text-base font-semibold text-white">Scoring & Audit Integrity</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Server actions and APIs validate all inputs with strict schemas. Realtime WebSockets are scoped exclusively to authenticated couple channels.
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
