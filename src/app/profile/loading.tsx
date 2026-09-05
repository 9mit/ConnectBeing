export default function ProfileLoading() {
  return (
    <div className="space-y-10 max-w-2xl mx-auto animate-pulse">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-6">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded-full bg-white/[0.05]" />
          <div className="h-8 w-48 rounded-xl bg-white/[0.08]" />
        </div>
        <div className="h-9 w-24 rounded-full bg-white/[0.06]" />
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/[0.08]" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded-md bg-white/[0.08]" />
            <div className="h-3 w-28 rounded-full bg-white/[0.04]" />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-white/[0.06]">
          <div className="h-12 w-full rounded-xl bg-white/[0.03]" />
          <div className="h-12 w-full rounded-xl bg-white/[0.03]" />
          <div className="h-20 w-full rounded-xl bg-white/[0.03]" />
        </div>
      </div>
    </div>
  );
}
