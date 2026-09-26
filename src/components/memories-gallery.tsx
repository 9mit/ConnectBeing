"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Plus,
  X,
  UploadCloud,
} from "lucide-react";

import {
  confirmMemoryUploadAction,
  createPresignedUploadAction,
  listTimelineAction,
} from "@/actions/media";
import { formatDateLong, formatDateShort } from "@/lib/date";

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
      return "Movie Night";
    case "photo":
      return "Photo Memory";
    case "mood":
      return "Vibe";
    case "quiz":
      return "Quiz";
    case "call":
      return "Voice Call";
    case "watch":
      return "Together";
    case "challenge":
      return "Shared Quest";
    case "achievement":
      return "Trophy";
    case "memory":
      return "Memory";
    default:
      return "Moment";
  }
}

export function MemoriesGallery() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<TimelineItem | null>(null);
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

  const photoItems = items.filter((i) => i.url);
  const featuredItem = photoItems[0] || items[0] || null;
  const secondaryItems = photoItems.length > 0 ? photoItems.slice(1) : items.slice(1);

  return (
    <div className="space-y-10 max-w-5xl mx-auto">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-400">
            Visual Anthology
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-light text-[#f7f6f2] tracking-tight mt-1">
            Our Memories
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Photographs, milestones, and captured moments living in your shared vault.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsUploading(!isUploading)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f7f6f2] text-[#07080b] text-xs font-semibold hover:bg-white transition-all self-start sm:self-auto shadow-sm active:scale-98"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isUploading ? "Close" : "Add Memory"}</span>
        </button>
      </div>

      {error && (
        <p className="p-3 rounded-xl text-xs font-medium text-rose-300 bg-rose-950/40 border border-rose-500/20 text-center">
          {error}
        </p>
      )}

      {/* Collapsible Refined Upload Sheet */}
      <AnimatePresence>
        {isUploading && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            ref={formRef}
            className="rounded-2xl border border-white/[0.08] bg-[#0e1017] p-6 space-y-4 shadow-xl overflow-hidden"
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
                const rawTaken = fd.get("takenAt");
                const parsedTaken = rawTaken ? new Date(String(rawTaken)) : new Date();
                const takenAt = isNaN(parsedTaken.getTime())
                  ? new Date().toISOString()
                  : parsedTaken.toISOString();

                const confirm = await confirmMemoryUploadAction({
                  storageKey: presign.data.storageKey,
                  mimeType,
                  caption: String(fd.get("caption") || "") || undefined,
                  takenAt,
                  eventLabel: String(fd.get("eventLabel") || "") || undefined,
                });
                if (!confirm.ok) {
                  setError(confirm.error.message);
                  return;
                }
                await refresh();
                formRef.current?.reset();
                setIsUploading(false);
              });
            }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h2 className="text-sm font-medium text-[#f7f6f2] flex items-center gap-2">
                <Camera className="w-4 h-4 text-zinc-400" />
                <span>Save New Memory</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsUploading(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="memory-file" className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
                  Select Photograph
                </label>
                <input 
                  id="memory-file"
                  name="file" 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  required 
                  className="w-full text-xs text-zinc-300 file:mr-3 file:py-2.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/[0.06] file:text-zinc-200 hover:file:bg-white/[0.12] transition-colors cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="memory-taken-at" className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">
                  Date Taken
                </label>
                <input
                  id="memory-taken-at"
                  name="takenAt"
                  type="datetime-local"
                  required
                  defaultValue={new Date().toISOString().slice(0, 16)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-base sm:text-xs text-[#f7f6f2] focus:outline-none focus:border-white/20 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <input
                id="memory-caption"
                name="caption"
                placeholder="Caption (e.g. Afternoon walk in the quiet gardens)"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-base sm:text-xs text-[#f7f6f2] placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors"
              />
              <input
                id="memory-event-label"
                name="eventLabel"
                placeholder="Milestone tag (e.g. Anniversary, Road trip)"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-base sm:text-xs text-[#f7f6f2] placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={pending}
                className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-full bg-[#f7f6f2] text-[#07080b] text-xs font-semibold hover:bg-white disabled:opacity-40 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{pending ? "Saving Memory…" : "Save to Vault"}</span>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Empty State: Matching explicit requirement */}
      {items.length === 0 ? (
        <div className="py-20 px-6 rounded-2xl bg-[#0e1015] border border-white/[0.06] text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400">
            <Camera className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-serif font-light text-[#f7f6f2]">
              Your first memory is waiting.
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Preserve a quiet moment, date night, or landmark snapshot together in your private vault.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsUploading(true)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#f7f6f2] text-[#07080b] text-xs font-semibold hover:bg-white transition-all shadow-sm"
          >
            <span>Save something together</span>
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Featured Hero Memory (dominant visual scale) */}
          {featuredItem && featuredItem.url && (
            <section
              role="button"
              tabIndex={0}
              aria-label={`View memory: ${featuredItem.title}`}
              onClick={() => setSelectedPhoto(featuredItem)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedPhoto(featuredItem);
                }
              }}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0c0d12] transition-all hover:border-white/20"
            >
              <div className="relative aspect-[16/9] md:aspect-[21/9] w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredItem.url}
                  alt={featuredItem.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 space-y-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-amber-200/90 font-medium">
                  <span>{kindLabel(featuredItem.kind)}</span>
                  <span>·</span>
                  <time>{formatDateLong(featuredItem.at)}</time>
                </div>
                <h2 className="text-xl sm:text-2xl font-serif text-[#f7f6f2] font-light">
                  {featuredItem.title}
                </h2>
                {featuredItem.subtitle && (
                  <p className="text-xs sm:text-sm text-zinc-300 font-light italic max-w-xl">
                    &ldquo;{featuredItem.subtitle}&rdquo;
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Staggered Gallery Exhibition */}
          {secondaryItems.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-medium tracking-[0.2em] uppercase text-zinc-400">
                Timeline Anthology
              </h3>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {secondaryItems.map((item) => (
                  <div
                    key={`${item.kind}-${item.id}`}
                    role={item.url ? "button" : undefined}
                    tabIndex={item.url ? 0 : undefined}
                    aria-label={item.url ? `View memory: ${item.title}` : undefined}
                    onClick={() => item.url && setSelectedPhoto(item)}
                    onKeyDown={(e) => {
                      if (item.url && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setSelectedPhoto(item);
                      }
                    }}
                    className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0e1017] transition-all hover:border-white/20 ${
                      item.url ? "cursor-pointer" : ""
                    }`}
                  >
                    {item.url ? (
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.url}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                      </div>
                    ) : null}

                    <div className="p-4 sm:p-5 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-wider">
                        <span>{kindLabel(item.kind)}</span>
                        <time>{formatDateShort(item.at)}</time>
                      </div>
                      <h4 className="text-sm font-serif font-light text-[#f7f6f2] group-hover:text-amber-100 transition-colors">
                        {item.title}
                      </h4>
                      {item.subtitle && (
                        <p className="text-xs text-zinc-400 font-light line-clamp-2">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPhoto(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-4 backdrop-blur-md pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0c0d12] max-h-[90dvh] flex flex-col shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-2.5 rounded-full bg-black/70 text-white/90 hover:text-white backdrop-blur-md min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                aria-label="Close photo preview"
              >
                <X className="w-5 h-5" />
              </button>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.url!}
                alt={selectedPhoto.title}
                className="max-h-[55dvh] sm:max-h-[72vh] w-full object-contain bg-black/60 flex-1"
              />

              <div className="p-4 sm:p-6 bg-[#0c0d12] border-t border-white/[0.06] space-y-1 shrink-0">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="uppercase tracking-wider font-medium">{kindLabel(selectedPhoto.kind)}</span>
                  <time>{formatDateLong(selectedPhoto.at)}</time>
                </div>
                <h3 className="text-base sm:text-lg font-serif font-light text-[#f7f6f2]">
                  {selectedPhoto.title}
                </h3>
                {selectedPhoto.subtitle && (
                  <p className="text-xs text-zinc-300 font-light italic">
                    &ldquo;{selectedPhoto.subtitle}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
