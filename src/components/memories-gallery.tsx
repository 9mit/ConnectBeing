"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  confirmMemoryUploadAction,
  createPresignedUploadAction,
  listTimelineAction,
} from "@/actions/media";

type TimelineItem = {
  id: string;
  kind: string;
  title: string;
  at: string;
  subtitle: string | null;
  url: string | null;
};

function kindLabel(kind: string): string {
  switch (kind) {
    case "movie":
      return "🍿 Movie Night";
    case "photo":
      return "📷 Photo Memory";
    case "mood":
      return "🎭 Vibe";
    case "quiz":
      return "❓ Quiz";
    case "call":
      return "📞 Call";
    case "watch":
      return "🎬 Together";
    case "challenge":
      return "🎯 Quest";
    case "achievement":
      return "✨ Trophy";
    case "memory":
      return "💝 Memory";
    default:
      return "✦ Moment";
  }
}

export function MemoriesGallery() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function refresh() {
    const result = await listTimelineAction();
    if (result.ok) setItems(result.data.items);
    else setError(result.error.message);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-10">
      {/* Upload Memory Card */}
      <form
        ref={formRef}
        className="space-y-4 rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 shadow-[0_0_35px_rgba(212,175,55,0.12)]"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const file = fd.get("file") as File | null;
          if (!file) return;
          startTransition(async () => {
            const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
            const presign = await createPresignedUploadAction({
              kind: "memory",
              mimeType,
            });
            if (!presign.ok) {
              setError(presign.error.message);
              return;
            }
            const upload = await fetch(presign.data.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": mimeType },
              body: file,
            });
            if (!upload.ok) {
              setError("Upload failed");
              return;
            }
            const confirm = await confirmMemoryUploadAction({
              storageKey: presign.data.storageKey,
              mimeType,
              caption: String(fd.get("caption") || "") || undefined,
              takenAt: new Date(String(fd.get("takenAt") || Date.now())).toISOString(),
              eventLabel: String(fd.get("eventLabel") || "") || undefined,
            });
            if (!confirm.ok) {
              setError(confirm.error.message);
              return;
            }
            await refresh();
            formRef.current?.reset();
          });
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">📸</span>
          <h2 className="text-lg font-bold text-white font-display text-glow-gold">Save a Relationship Memory</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="memory-file" className="text-xs font-semibold uppercase tracking-wider text-amber-300">Photo File</label>
            <input 
              id="memory-file"
              name="file" 
              type="file" 
              accept="image/jpeg,image/png,image/webp" 
              required 
              className="w-full text-xs text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500/20 file:text-amber-200 hover:file:bg-amber-500/30 transition-all cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="memory-taken-at" className="text-xs font-semibold uppercase tracking-wider text-amber-300">Date & Time Taken</label>
            <input
              id="memory-taken-at"
              name="takenAt"
              type="datetime-local"
              required
              className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all font-semibold"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <input
            id="memory-caption"
            name="caption"
            aria-label="Memory caption"
            placeholder="Memory Caption (e.g. Weekend trip to the lake)"
            className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
          />
          <input
            id="memory-event-label"
            name="eventLabel"
            aria-label="Milestone tag"
            placeholder="Milestone Tag (e.g. First Date, Anniversary)"
            className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-6 py-3 text-xs font-extrabold uppercase tracking-wider text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
        >
          {pending ? "Uploading Memory..." : "Save Permanent Memory"}
        </button>
      </form>

      {error ? (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2.5 rounded-xl text-center">
          {error}
        </p>
      ) : null}

      {/* Shared Timeline Display */}
      <section className="space-y-6">
        <h3 className="text-xl font-bold text-white font-display tracking-tight flex items-center gap-2 text-glow-gold">
          <span>✨</span> Shared Memory Timeline
        </h3>

        {items.length === 0 ? (
          <div className="rounded-2xl glass-panel border border-amber-500/20 bg-purple-950/40 p-8 text-center text-slate-300 text-sm font-medium">
            Your timeline is empty. Start adding photo memories or movie night dates above!
          </div>
        ) : null}

        <ol className="relative space-y-6 border-l border-amber-500/30 ml-4 pl-6">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="relative">
              <span className="absolute -left-[1.85rem] top-1.5 h-3.5 w-3.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 shadow-[0_0_10px_#fbbf24]" />
              
              <div className="rounded-2xl glass-panel border border-amber-500/20 bg-purple-950/40 p-5 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                    {kindLabel(item.kind)}
                  </span>
                  <span className="text-xs font-semibold text-amber-400/80">
                    {new Date(item.at).toLocaleString()}
                  </span>
                </div>

                <p className="mt-2 text-lg font-bold text-white font-display tracking-tight">{item.title}</p>
                
                {item.subtitle ? (
                  <p className="text-xs text-slate-300 mt-1 font-medium italic">&ldquo;{item.subtitle}&rdquo;</p>
                ) : null}

                {item.url ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-amber-500/30 bg-purple-950/60 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.title}
                      className="h-64 w-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
