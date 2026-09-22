export default function SettingsLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <header className="space-y-2">
        <div className="h-3 w-32 bg-amber-400/20 rounded-full" />
        <div className="h-9 w-48 bg-white/10 rounded-xl" />
        <div className="h-4 w-72 max-w-full bg-white/5 rounded-lg" />
      </header>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <div className="h-5 w-40 bg-white/10 rounded-lg" />
            <div className="h-4 w-64 bg-white/5 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
