export default function MemoriesLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <header className="space-y-2">
        <div className="h-3 w-28 bg-amber-400/20 rounded-full" />
        <div className="h-9 w-64 bg-white/10 rounded-xl" />
        <div className="h-4 w-96 max-w-full bg-white/5 rounded-lg" />
      </header>

      {/* Action / Filter bar */}
      <div className="flex items-center justify-between gap-4 py-2">
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-white/10" />
          <div className="h-8 w-24 rounded-full bg-white/5" />
          <div className="h-8 w-20 rounded-full bg-white/5" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-amber-400/20 shrink-0" />
      </div>

      {/* Masonry / Photo Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="h-56 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
        <div className="h-64 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
        <div className="h-48 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
        <div className="h-52 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
        <div className="h-60 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
        <div className="h-44 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
      </div>
    </div>
  );
}
