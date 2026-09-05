export default function SearchLoading() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto animate-pulse">
      <div className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.02]" />

      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-white/[0.04]" />
        ))}
      </div>

      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl border border-white/[0.05] bg-white/[0.015]" />
        ))}
      </div>
    </div>
  );
}
