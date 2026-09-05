export default function InsightsLoading() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded-full bg-white/[0.05]" />
          <div className="h-8 w-56 rounded-xl bg-white/[0.08]" />
          <div className="h-4 w-80 max-w-full rounded-md bg-white/[0.04]" />
        </div>
        <div className="h-9 w-28 rounded-full bg-white/[0.06]" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-48 rounded-3xl border border-white/[0.06] bg-white/[0.02]" />
        <div className="h-48 rounded-3xl border border-white/[0.06] bg-white/[0.02]" />
      </div>

      <div className="h-64 rounded-3xl border border-white/[0.06] bg-white/[0.02]" />
    </div>
  );
}
