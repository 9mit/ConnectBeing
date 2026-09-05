export default function CalendarLoading() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-pulse">
      {/* Editorial Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded-full bg-white/[0.05]" />
          <div className="h-8 w-56 rounded-xl bg-white/[0.08]" />
          <div className="h-4 w-80 max-w-full rounded-md bg-white/[0.04]" />
        </div>
        <div className="h-9 w-32 rounded-full bg-white/[0.06]" />
      </div>

      {/* Grid of Ritual / Event Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded-full bg-white/[0.06]" />
              <div className="h-3 w-16 rounded-full bg-white/[0.04]" />
            </div>
            <div className="h-5 w-48 rounded-md bg-white/[0.08]" />
            <div className="h-3 w-64 max-w-full rounded-md bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
