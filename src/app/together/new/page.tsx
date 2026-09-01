"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { createWatchSessionAction } from "@/actions/together";

export default function NewWatchSessionPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      provider: fd.get("provider"),
      title: fd.get("title"),
      scheduledFor: fd.get("scheduledFor"),
      invitationMessage: fd.get("invitationMessage"),
    };

    startTransition(async () => {
      const result = await createWatchSessionAction(payload);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push("/together");
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-lg py-6 space-y-6">
        <Link href="/together" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
          ← Back to Theater
        </Link>

        <div className="relative rounded-3xl glass-panel p-6 md:p-8 border border-amber-500/30 bg-purple-950/50 shadow-2xl overflow-hidden backdrop-blur-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            MadLove Theater
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display tracking-tight mt-1 text-glow-gold">
            Plan Movie Night
          </h1>
          <p className="mt-1 text-xs text-slate-300 font-medium">Invite your partner for a synchronized cinematic watch session.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4 relative z-10">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">Streaming Provider</label>
              <select
                name="provider"
                required
                className="w-full rounded-2xl border border-amber-500/30 bg-purple-950/60 px-4 py-3 text-sm text-white outline-none focus:border-amber-400 transition-all"
              >
                <option value="netflix" className="bg-[#18092c] text-white">Netflix</option>
                <option value="prime" className="bg-[#18092c] text-white">Prime Video</option>
                <option value="youtube" className="bg-[#18092c] text-white">YouTube</option>
                <option value="disney" className="bg-[#18092c] text-white">Disney+</option>
                <option value="apple" className="bg-[#18092c] text-white">Apple TV+</option>
                <option value="jiohotstar" className="bg-[#18092c] text-white">JioHotstar</option>
                <option value="other" className="bg-[#18092c] text-white">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">Movie / Show Title</label>
              <input
                name="title"
                type="text"
                required
                placeholder="e.g. Interstellar"
                className="w-full rounded-2xl border border-amber-500/30 bg-purple-950/60 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">Date & Time</label>
              <input
                name="scheduledFor"
                type="datetime-local"
                required
                className="w-full rounded-2xl border border-amber-500/30 bg-purple-950/60 px-4 py-3 text-sm text-white outline-none focus:border-amber-400 transition-all [color-scheme:dark]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">Invitation Message (Optional)</label>
              <textarea
                name="invitationMessage"
                rows={3}
                placeholder="Bring warm blankets and popcorn ❤️"
                className="w-full resize-none rounded-2xl border border-amber-500/30 bg-purple-950/60 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 transition-all"
              />
            </div>

            {error && <p className="text-xs font-semibold text-red-300 bg-red-950/70 border border-red-500/30 p-3 rounded-xl">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="mt-6 w-full btn-madlove-gold py-3.5 text-xs font-bold disabled:opacity-50"
            >
              {pending ? "Creating Session..." : "Send Invitation 🍿"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
