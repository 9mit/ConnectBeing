export default function NotificationsLoading() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-pulse">
      {/* Header Banner */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-36 bg-amber-400/20 rounded-full" />
          <div className="h-8 w-56 bg-white/10 rounded-xl" />
          <div className="h-4 w-72 max-w-full bg-white/5 rounded-lg" />
        </div>
        <div className="h-9 w-28 bg-white/10 rounded-xl shrink-0" />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <div className="h-7 w-24 rounded-full bg-white/10 shrink-0" />
        <div className="h-7 w-20 rounded-full bg-white/5 shrink-0" />
        <div className="h-7 w-24 rounded-full bg-white/5 shrink-0" />
        <div className="h-7 w-24 rounded-full bg-white/5 shrink-0" />
        <div className="h-7 w-28 rounded-full bg-white/5 shrink-0" />
      </div>

      {/* Notification items */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5 flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-44 bg-white/10 rounded-lg" />
              <div className="h-3 w-3/4 bg-white/5 rounded-lg" />
              <div className="h-2.5 w-24 bg-white/5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
