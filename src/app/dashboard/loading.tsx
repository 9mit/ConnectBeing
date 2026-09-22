export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
      {/* Hero Banner Skeleton */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-3 flex-1">
          <div className="h-3 w-28 bg-white/10 rounded-full" />
          <div className="h-8 w-64 bg-white/10 rounded-xl" />
          <div className="h-4 w-48 bg-white/5 rounded-lg" />
        </div>
        <div className="h-14 w-32 bg-white/10 rounded-2xl shrink-0" />
      </div>

      {/* Grid of Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vibe Check Widget */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-white/10 rounded-lg" />
            <div className="h-4 w-16 bg-white/5 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="h-20 bg-white/5 rounded-2xl" />
            <div className="h-20 bg-white/5 rounded-2xl" />
          </div>
        </div>

        {/* Companion Widget */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-36 bg-white/10 rounded-lg" />
            <div className="h-4 w-20 bg-white/5 rounded-full" />
          </div>
          <div className="h-20 bg-white/5 rounded-2xl" />
        </div>
      </div>

      {/* Resonance & Recent Us */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
        <div className="h-5 w-44 bg-white/10 rounded-lg" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-white/5 rounded-lg" />
          <div className="h-4 w-3/4 bg-white/5 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
