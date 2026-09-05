export default function QuizLoading() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-white/[0.06] pb-6">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded-full bg-white/[0.05]" />
          <div className="h-8 w-44 rounded-xl bg-white/[0.08]" />
          <div className="h-4 w-72 rounded-md bg-white/[0.04]" />
        </div>
        <div className="h-4 w-28 rounded-full bg-white/[0.04]" />
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded-full bg-white/[0.06]" />
          <div className="h-6 w-full max-w-md rounded-lg bg-white/[0.08]" />
        </div>

        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-2xl border border-white/[0.05] bg-white/[0.015]" />
          ))}
        </div>
      </div>
    </div>
  );
}
