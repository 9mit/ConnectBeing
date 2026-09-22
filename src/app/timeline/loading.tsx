export default function TimelineLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
      <header className="space-y-2">
        <div className="h-3 w-32 bg-amber-400/20 rounded-full" />
        <div className="h-9 w-60 bg-white/10 rounded-xl" />
        <div className="h-4 w-80 max-w-full bg-white/5 rounded-lg" />
      </header>

      {/* Timeline track with nodes */}
      <div className="relative pl-8 space-y-8 border-l border-white/10 ml-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="relative space-y-2">
            <div className="absolute -left-[41px] top-1.5 w-4 h-4 rounded-full bg-white/10 border-2 border-[#07080b]" />
            <div className="h-3 w-28 bg-amber-400/15 rounded-full" />
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-2">
              <div className="h-5 w-48 bg-white/10 rounded-lg" />
              <div className="h-4 w-full bg-white/5 rounded-lg" />
              <div className="h-4 w-2/3 bg-white/5 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
