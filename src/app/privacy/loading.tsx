export default function PrivacyLoading() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-pulse">
      <div className="border-b border-white/[0.06] pb-6 space-y-2">
        <div className="h-3 w-32 rounded-full bg-white/[0.05]" />
        <div className="h-8 w-48 rounded-xl bg-white/[0.08]" />
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 space-y-6">
        <div className="h-24 rounded-2xl border border-white/[0.05] bg-white/[0.015]" />
        <div className="h-24 rounded-2xl border border-white/[0.05] bg-white/[0.015]" />
      </div>
    </div>
  );
}
