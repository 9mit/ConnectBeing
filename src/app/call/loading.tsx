export default function CallLoading() {
  return (
    <div className="space-y-8 max-w-xl mx-auto animate-pulse">
      <div className="text-center space-y-2">
        <div className="h-3 w-28 rounded-full bg-white/[0.05] mx-auto" />
        <div className="h-8 w-44 rounded-xl bg-white/[0.08] mx-auto" />
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-12 flex flex-col items-center justify-center space-y-8">
        <div className="w-24 h-24 rounded-full bg-white/[0.06]" />
        <div className="h-4 w-40 rounded-full bg-white/[0.04]" />
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-full bg-white/[0.08]" />
          <div className="w-12 h-12 rounded-full bg-white/[0.08]" />
        </div>
      </div>
    </div>
  );
}
