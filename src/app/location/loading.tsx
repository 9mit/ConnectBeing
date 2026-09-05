export default function LocationLoading() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-pulse">
      <div className="text-center space-y-2">
        <div className="h-3 w-28 rounded-full bg-white/[0.05] mx-auto" />
        <div className="h-8 w-52 rounded-xl bg-white/[0.08] mx-auto" />
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 h-80 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/[0.08]" />
      </div>
    </div>
  );
}
