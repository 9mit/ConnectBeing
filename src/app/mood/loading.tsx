export default function MoodLoading() {
  return (
    <div className="space-y-10 max-w-lg mx-auto animate-pulse">
      <div className="text-center space-y-2">
        <div className="h-3 w-28 rounded-full bg-white/[0.05] mx-auto" />
        <div className="h-8 w-48 rounded-xl bg-white/[0.08] mx-auto" />
        <div className="h-4 w-72 max-w-full rounded-md bg-white/[0.04] mx-auto" />
      </div>

      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-8 space-y-6">
        <div className="flex justify-around items-center py-4">
          <div className="space-y-2 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.06] mx-auto" />
            <div className="h-3 w-14 rounded-full bg-white/[0.05] mx-auto" />
          </div>
          <div className="h-8 w-px bg-white/[0.08]" />
          <div className="space-y-2 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.06] mx-auto" />
            <div className="h-3 w-14 rounded-full bg-white/[0.05] mx-auto" />
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 pt-4 border-t border-white/[0.06]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </div>
  );
}
