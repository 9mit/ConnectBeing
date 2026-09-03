"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { completeOnboardingAction } from "@/actions/onboarding";

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await completeOnboardingAction({
        name: String(fd.get("name") ?? ""),
        age: Number(fd.get("age")),
        gender: String(fd.get("gender") ?? ""),
        countryCode: String(fd.get("countryCode") ?? "IN").toUpperCase(),
        hobbies: String(fd.get("hobbies") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        selfDescription: String(fd.get("selfDescription") ?? ""),
        partnerExpectation: String(fd.get("partnerExpectation") ?? ""),
        loveLanguages: String(fd.get("loveLanguages") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(result.data.redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-6 rounded-3xl glass-panel p-8 border border-amber-500/30 bg-purple-950/50 shadow-[0_0_35px_rgba(212,175,55,0.15)]">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-300">Name</label>
          <input
            name="name"
            type="text"
            required
            placeholder="Your name"
            className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-300">Country (ISO)</label>
          <select
            name="countryCode"
            defaultValue="IN"
            className="w-full rounded-xl border border-amber-500/30 bg-purple-950/80 px-4 py-3 text-base text-slate-100 focus:outline-none focus:border-amber-400 focus:bg-purple-900/90 transition-all"
          >
            <option value="IN">India (IN)</option>
            <option value="US">United States (US)</option>
            <option value="GB">United Kingdom (GB)</option>
            <option value="CA">Canada (CA)</option>
            <option value="AU">Australia (AU)</option>
            <option value="DE">Germany (DE)</option>
            <option value="FR">France (FR)</option>
            <option value="SG">Singapore (SG)</option>
            <option value="AE">United Arab Emirates (AE)</option>
            <option value="JP">Japan (JP)</option>
            <option value="WW">Other / Global</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-300">Age (18+)</label>
          <input
            name="age"
            type="number"
            min={18}
            max={120}
            required
            placeholder="24"
            className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-300">Gender</label>
          <input
            name="gender"
            type="text"
            required
            placeholder="female / male / non-binary"
            className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-amber-300">Hobbies (comma-separated)</label>
        <input
          name="hobbies"
          type="text"
          required
          placeholder="reading, cooking, movies"
          className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-amber-300">Love Languages (comma-separated)</label>
        <input
          name="loveLanguages"
          type="text"
          required
          placeholder="quality time, words of affirmation"
          className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-amber-300">About you</label>
        <textarea
          name="selfDescription"
          required
          maxLength={500}
          rows={3}
          placeholder="Describe your personality, what gets you excited, and how you show affection..."
          className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-amber-300">What you value in a partner</label>
        <textarea
          name="partnerExpectation"
          required
          maxLength={500}
          rows={3}
          placeholder="Describe what traits you cherish most in your partner..."
          className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all resize-none"
        />
      </div>

      {error ? (
        <p className="text-xs font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full mt-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 py-3.5 text-sm font-extrabold text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 transition-all shadow-[0_0_20px_rgba(212,175,55,0.35)]"
      >
        {pending ? "Creating Profile..." : "Save and Continue"}
      </button>
    </form>
  );
}
