export default function MemoriesLoading() {
  return (
    <div className="space-y-10 max-w-5xl mx-auto animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded-full bg-white/[0.05]" />
          <div className="h-8 w-56 rounded-xl bg-white/[0.08]" />
        </div>
        <div className="h-9 w-32 rounded-full bg-white/[0.06]" />
      </div>

      {/* Featured Memory */}
      <div className="w-full aspect-[21/9] rounded-3xl border border-white/[0.08] bg-white/[0.02]" />

      {/* Grid of Memories */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square rounded-2xl border border-white/[0.05] bg-white/[0.015]" />
        ))}
      </div>
    </div>
  );
}
