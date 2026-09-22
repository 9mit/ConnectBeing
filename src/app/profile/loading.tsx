export default function ProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <header className="space-y-2">
        <div className="h-3 w-28 bg-amber-400/20 rounded-full" />
        <div className="h-9 w-52 bg-white/10 rounded-xl" />
        <div className="h-4 w-80 max-w-full bg-white/5 rounded-lg" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Your Profile Card */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/10 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-36 bg-white/10 rounded-lg" />
              <div className="h-3 w-24 bg-white/5 rounded-full" />
            </div>
          </div>
          <div className="space-y-3 pt-3">
            <div className="h-4 w-full bg-white/5 rounded-lg" />
            <div className="h-4 w-5/6 bg-white/5 rounded-lg" />
          </div>
        </div>

        {/* Partner Profile Card */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/10 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-36 bg-white/10 rounded-lg" />
              <div className="h-3 w-24 bg-white/5 rounded-full" />
            </div>
          </div>
          <div className="space-y-3 pt-3">
            <div className="h-4 w-full bg-white/5 rounded-lg" />
            <div className="h-4 w-5/6 bg-white/5 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
