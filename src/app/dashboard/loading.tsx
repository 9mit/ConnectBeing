export default function DashboardLoading() {
  return (
    <div className="space-y-12 max-w-5xl mx-auto animate-pulse">
      {/* Editorial Salutation Skeleton */}
      <div className="space-y-3 pt-2">
        <div className="h-3 w-36 rounded-full bg-white/[0.05]" />
        <div className="h-10 w-72 rounded-xl bg-white/[0.08]" />
        <div className="h-4 w-96 max-w-full rounded-md bg-white/[0.04]" />
      </div>

      {/* Narrative Section 1: Today's Journey */}
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-2.5 w-24 rounded-full bg-white/[0.05]" />
            <div className="h-5 w-48 rounded-md bg-white/[0.08]" />
          </div>
          <div className="h-8 w-24 rounded-full bg-white/[0.05]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-32 rounded-2xl border border-white/[0.04] bg-white/[0.015]" />
          <div className="h-32 rounded-2xl border border-white/[0.04] bg-white/[0.015]" />
        </div>
      </div>

      {/* Narrative Section 2: Shared World */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-48 rounded-3xl border border-white/[0.06] bg-white/[0.02]" />
        <div className="h-48 rounded-3xl border border-white/[0.06] bg-white/[0.02]" />
      </div>
    </div>
  );
}
