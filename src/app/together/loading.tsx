export default function TogetherLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
      {/* Header Banner */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2.5">
          <div className="h-3 w-32 bg-amber-400/20 rounded-full" />
          <div className="h-8 w-56 bg-white/10 rounded-xl" />
          <div className="h-4 w-72 bg-white/5 rounded-lg" />
        </div>
        <div className="h-10 w-36 bg-amber-400/20 rounded-full shrink-0" />
      </div>

      {/* Sessions Grid */}
      <div className="space-y-4">
        <div className="h-4 w-40 bg-white/10 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <div className="h-5 w-48 bg-white/10 rounded-lg" />
            <div className="h-4 w-32 bg-white/5 rounded-lg" />
            <div className="h-8 w-24 bg-white/10 rounded-xl mt-4" />
          </div>
          <div className="h-40 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <div className="h-5 w-44 bg-white/10 rounded-lg" />
            <div className="h-4 w-28 bg-white/5 rounded-lg" />
            <div className="h-8 w-24 bg-white/10 rounded-xl mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
