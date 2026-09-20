"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search, Sparkles, Tv, ShieldCheck, Film, Check } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import {
  createWatchSessionAction,
  searchEntertainmentAction,
} from "@/actions/together";
import { UnifiedContentItem } from "@/features/together/discovery/catalog";
import { getAllProviders } from "@/features/together/providers";

export default function NewWatchSessionPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Discovery search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UnifiedContentItem[]>([]);

  // Selected session state
  const [selectedTitle, setSelectedTitle] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("netflix");
  const [selectedPoster, setSelectedPoster] = useState("");

  const allProviders = getAllProviders();

  // Pre-fill next hour as comfortable default
  const defaultDateTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const res = await searchEntertainmentAction(q);
    setIsSearching(false);
    if (res.ok) {
      setSearchResults(res.data);
    }
  }

  function handleSelectTitle(item: UnifiedContentItem, providerId?: string) {
    setSelectedTitle(item.title);
    setSelectedPoster(item.posterUrl);
    if (providerId) {
      setSelectedProvider(providerId);
    } else if (item.availableOn.length > 0 && item.availableOn[0]) {
      setSelectedProvider(item.availableOn[0].providerId);
    }
    setSearchResults([]);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const titleVal = (selectedTitle || fd.get("title")?.toString() || "").trim();
    const providerVal = (selectedProvider || fd.get("provider")?.toString() || "netflix").trim();
    const rawScheduledFor = fd.get("scheduledFor")?.toString()?.trim();
    const invitationMessageVal = fd.get("invitationMessage")?.toString()?.trim();

    if (!titleVal) {
      setError("Please enter a movie or show title.");
      return;
    }

    let scheduledForIso: string | undefined;
    if (rawScheduledFor) {
      const parsedDate = new Date(rawScheduledFor);
      if (!isNaN(parsedDate.getTime())) {
        scheduledForIso = parsedDate.toISOString();
      } else {
        scheduledForIso = rawScheduledFor;
      }
    }

    const payload = {
      provider: providerVal,
      title: titleVal,
      posterUrl: selectedPoster?.trim() || undefined,
      scheduledFor: scheduledForIso,
      invitationMessage: invitationMessageVal || undefined,
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
      <div className="mx-auto max-w-2xl py-6 space-y-6">
        <Link
          href="/together"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
        >
          ← Back to Theater
        </Link>

        {/* Unified Search & Discovery Card */}
        <div className="relative rounded-3xl glass-panel p-6 border border-sky-500/30 bg-[#0f0a1c]/80 shadow-2xl backdrop-blur-2xl space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
              Universal Entertainment Discovery
            </span>
          </div>

          <p className="text-xs text-zinc-300">
            Search any movie or series across Netflix, Prime, Hotstar, Crunchyroll, SonyLIV, and more:
          </p>

          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => void handleSearch(e.target.value)}
              placeholder="Search title e.g. Interstellar, Brahmāstra, Loki, Stranger Things…"
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-white/15 bg-black/40 text-sm text-white placeholder-zinc-500 outline-none focus:border-sky-400 transition-colors"
            />
            {isSearching && (
              <span className="absolute right-3.5 top-3.5 text-xs text-sky-400 animate-pulse">
                Searching…
              </span>
            )}
          </div>

          {/* Search Results Dropdown / Grid */}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-sky-400/40 transition-colors flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-14 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{item.title}</span>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          ({item.year})
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-1 font-light">
                        {item.genre.join(" · ")} · {item.runtimeMinutes} min
                      </p>
                    </div>
                  </div>

                  {/* Provider Pills */}
                  <div className="flex items-center flex-wrap gap-1.5 self-end sm:self-center">
                    {item.availableOn.map((p) => (
                      <button
                        key={p.providerId}
                        type="button"
                        onClick={() => handleSelectTitle(item, p.providerId)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-white transition-transform hover:scale-105"
                        style={{
                          backgroundColor: `${p.brandColor}44`,
                          border: `1px solid ${p.brandColor}88`,
                        }}
                      >
                        Watch on {p.providerName}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Session Configuration Form */}
        <div className="relative rounded-3xl glass-panel p-6 md:p-8 border border-amber-500/30 bg-purple-950/50 shadow-2xl overflow-hidden backdrop-blur-2xl">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            MadLove Theater
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display tracking-tight mt-1 text-glow-gold">
            Plan Movie Night
          </h1>
          <p className="mt-1 text-xs text-slate-300 font-medium">
            Invite your partner for a synchronized cinematic watch session on any OTT service.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4 relative z-10">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">
                Streaming Provider (18+ Supported)
              </label>
              <select
                name="provider"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                required
                className="w-full rounded-2xl border border-amber-500/30 bg-purple-950/60 px-4 py-3 text-sm text-white outline-none focus:border-amber-400 transition-all"
              >
                {allProviders.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#18092c] text-white">
                    {p.name} {p.capabilityLevel === 1 ? "★ (Full Sync)" : "(Countdown Remote)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">
                Movie / Show Title
              </label>
              <div className="flex items-center gap-3">
                {selectedPoster ? (
                  <div className="w-12 h-14 rounded-xl overflow-hidden shrink-0 border border-amber-500/40 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedPoster} alt="Poster" className="w-full h-full object-cover" />
                  </div>
                ) : null}
                <input
                  name="title"
                  type="text"
                  value={selectedTitle}
                  onChange={(e) => setSelectedTitle(e.target.value)}
                  required
                  placeholder="e.g. Interstellar, Brahmāstra, or custom title"
                  className="w-full rounded-2xl border border-amber-500/30 bg-purple-950/60 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">
                Date &amp; Time
              </label>
              <input
                name="scheduledFor"
                type="datetime-local"
                defaultValue={defaultDateTime}
                required
                className="w-full rounded-2xl border border-amber-500/30 bg-purple-950/60 px-4 py-3 text-sm text-white outline-none focus:border-amber-400 transition-all [color-scheme:dark]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">
                Invitation Message (Optional)
              </label>
              <textarea
                name="invitationMessage"
                rows={3}
                placeholder="Bring warm blankets and popcorn ❤️"
                className="w-full resize-none rounded-2xl border border-amber-500/30 bg-purple-950/60 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400 transition-all"
              />
            </div>

            <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-[11px] text-zinc-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Universal Watch-Party Layer: Synchronizes playback, countdowns, voice, and memories without intercepting DRM video.
              </span>
            </div>

            {error && (
              <p className="text-xs font-semibold text-red-300 bg-red-950/70 border border-red-500/30 p-3 rounded-xl">
                {error}
              </p>
            )}

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
