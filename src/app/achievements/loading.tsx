export default function AchievementsLoading() {
  return (
    <div className="space-y-10 max-w-4xl mx-auto animate-pulse">
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 space-y-4">
        <div className="h-3 w-32 rounded-full bg-white/[0.05]" />
        <div className="h-8 w-48 rounded-xl bg-white/[0.08]" />
        <div className="h-2 w-full max-w-md rounded-full bg-white/[0.04]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-white/[0.05] bg-white/[0.015]" />
        ))}
      </div>
    </div>
  );
}
