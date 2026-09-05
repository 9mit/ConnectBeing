export default function NotificationsLoading() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-pulse">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-6">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded-full bg-white/[0.05]" />
          <div className="h-8 w-44 rounded-xl bg-white/[0.08]" />
        </div>
        <div className="h-4 w-24 rounded-full bg-white/[0.04]" />
      </div>

      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-white/[0.04]" />
        ))}
      </div>

      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
        ))}
      </div>
    </div>
  );
}
