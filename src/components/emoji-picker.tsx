"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  EMOJI_CATEGORIES,
  loadRecentEmojis,
  rememberEmoji,
  type EmojiCategoryId,
} from "@/lib/chat/emoji-data";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
};

export function EmojiPicker({ open, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EmojiCategoryId>("smileys");
  const [recent, setRecent] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setRecent(loadRecentEmojis());
    setQuery("");
    const t = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const tabs = useMemo(() => {
    const base = EMOJI_CATEGORIES.map((c) => ({
      id: c.id,
      icon: c.icon,
      label: c.label,
    }));
    return [{ id: "recent" as const, icon: "🕒", label: "Recent" }, ...base];
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      // Search across all categories by substring match on the glyph itself
      // (Unicode search by keyword would need a large map; keep local & private)
      const all = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
      const uniq = Array.from(new Set(all));
      // Filter: if query is short, show matches containing that codepoint sequence
      // Also allow searching category labels
      const fromCats = EMOJI_CATEGORIES.filter((c) =>
        c.label.toLowerCase().includes(q),
      ).flatMap((c) => c.emojis);
      if (fromCats.length) return Array.from(new Set(fromCats));
      return uniq.filter((e) => e.includes(q)).slice(0, 80);
    }
    if (category === "recent") return recent;
    return (
      EMOJI_CATEGORIES.find((c) => c.id === category)?.emojis ?? []
    );
  }, [query, category, recent]);

  if (!open) return null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Emoji picker"
      className="absolute bottom-full left-0 z-30 mb-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#12080e]/95 shadow-2xl backdrop-blur-xl"
    >
      <div className="border-b border-white/10 p-2">
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search category (hearts, food…)"
          aria-label="Search emoji categories"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-rose-400/40"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5 scrollbar-thin">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={category === t.id && !query}
            onClick={() => {
              setCategory(t.id);
              setQuery("");
            }}
            className={`shrink-0 rounded-lg px-2 py-1 text-lg transition ${
              category === t.id && !query
                ? "bg-rose-500/20 ring-1 ring-rose-400/30"
                : "hover:bg-white/5"
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-2 scrollbar-thin">
        {visible.length === 0 ? (
          <p className="col-span-8 py-6 text-center text-xs text-slate-500">
            {category === "recent"
              ? "No recent emoji yet"
              : "No matches"}
          </p>
        ) : (
          visible.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              aria-label={`Select emoji ${emoji}`}
              className="rounded-lg p-1.5 text-xl leading-none transition hover:bg-white/10 active:scale-95 touch-manipulation"
              onClick={() => {
                setRecent(rememberEmoji(emoji));
                onPick(emoji);
              }}
            >
              {emoji}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
