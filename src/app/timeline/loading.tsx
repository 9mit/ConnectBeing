export default function TimelineLoading() {
  return (
    <div className="space-y-10 max-w-3xl mx-auto animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded-full bg-white/[0.05]" />
          <div className="h-8 w-56 rounded-xl bg-white/[0.08]" />
        </div>
        <div className="h-9 w-32 rounded-full bg-white/[0.06]" />
      </div>

      {/* Storyline Timeline Skeleton */}
      <div className="relative pl-8 space-y-8 border-l border-white/[0.08]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="relative space-y-3">
            <div className="absolute -left-[37px] top-1 w-4 h-4 rounded-full border border-white/20 bg-[#07080b]" />
            <div className="h-3 w-28 rounded-full bg-white/[0.05]" />
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-2">
              <div className="h-5 w-48 rounded-md bg-white/[0.08]" />
              <div className="h-3 w-72 rounded-md bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
