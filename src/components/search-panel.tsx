"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Search, Camera, Film, Calendar, Clock, ArrowRight, Sparkles } from "lucide-react";

import { searchCoupleDataAction, type SearchResultItemDTO } from "@/actions/search";
import { formatDateMedium } from "@/lib/date";

const CATEGORIES = [
  { value: "all", label: "All Vault" },
  { value: "memories", label: "📷 Photos" },
  { value: "movies", label: "🍿 Movies" },
  { value: "calendar", label: "📅 Calendar" },
  { value: "capsules", label: "⏳ Capsules" },
] as const;

function getCategoryIcon(cat: string) {
  switch (cat) {
    case "memories":
      return <Camera className="w-4 h-4 text-pink-400" />;
    case "movies":
      return <Film className="w-4 h-4 text-amber-400" />;
    case "calendar":
      return <Calendar className="w-4 h-4 text-sky-400" />;
    case "capsules":
      return <Clock className="w-4 h-4 text-purple-400" />;
    default:
      return <Sparkles className="w-4 h-4 text-amber-300" />;
  }
}

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | "memories" | "movies" | "calendar" | "capsules">("all");
  const [results, setResults] = useState<SearchResultItemDTO[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    startTransition(async () => {
      setError(null);
      const res = await searchCoupleDataAction({
        query: query.trim(),
        category,
      });

      if (res.ok) {
        setResults(res.data.results);
        setSearched(true);
      } else {
        setError(res.error.message);
      }
    });
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Search Header */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 space-y-4 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            Global Couple Search
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Search Your Universe
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            Instantly locate cherished photo memories, movie nights, scheduled rituals, and sealed love letters.
          </p>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearch} className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400/70" />
            <input
              type="text"
              required
              placeholder="Search by keyword, movie title, caption, or place…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-2xl border border-amber-500/30 bg-purple-950/60 pl-12 pr-4 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={pending || !query.trim()}
            className="btn-madlove-gold px-6 py-3.5 text-xs font-bold shrink-0 disabled:opacity-50"
          >
            {pending ? "Searching…" : "Search"}
          </button>
        </form>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 scrollbar-none">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                setCategory(c.value);
                if (query.trim()) {
                  startTransition(async () => {
                    const res = await searchCoupleDataAction({
                      query: query.trim(),
                      category: c.value,
                    });
                    if (res.ok) setResults(res.data.results);
                  });
                }
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all whitespace-nowrap ${
                category === c.value
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(212,175,55,0.2)]"
                  : "bg-purple-950/40 text-slate-400 border border-purple-900/30 hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center">
          {error}
        </p>
      )}

      {/* Results Section */}
      {searched && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-white font-display tracking-wider uppercase flex items-center justify-between border-b border-amber-500/20 pb-2">
            <span>Results Found ({results.length})</span>
            <span className="text-xs text-slate-400 capitalize">Category: {category}</span>
          </h2>

          {results.length === 0 ? (
            <div className="rounded-2xl glass-panel p-8 text-center border border-amber-500/15">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm font-semibold text-slate-300">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-1">Try another keyword or search across all categories.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map((item) => {
                const d = new Date(item.date);
                return (
                  <Link
                    key={item.id}
                    href={item.link}
                    className="rounded-2xl glass-panel p-5 border border-amber-500/20 bg-purple-950/40 hover:border-amber-500/40 hover:-translate-y-0.5 transition-all shadow-md flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-purple-950 border border-amber-500/20 flex items-center justify-center">
                            {getCategoryIcon(item.category)}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {formatDateMedium(d)}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-base group-hover:text-amber-200 transition-colors">
                        {item.title}
                      </h3>

                      {item.snippet && (
                        <p className="text-xs text-slate-300 font-medium line-clamp-2">
                          {item.snippet}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-amber-300 font-bold group-hover:translate-x-1 transition-transform">
                      <span>View in {item.category}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
