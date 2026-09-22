export default function MoodLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <header className="space-y-2">
        <div className="h-3 w-28 bg-amber-400/20 rounded-full" />
        <div className="h-9 w-44 bg-white/10 rounded-xl" />
        <div className="h-4 w-72 max-w-full bg-white/5 rounded-lg" />
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
        ))}
      </div>
    </div>
  );
}
