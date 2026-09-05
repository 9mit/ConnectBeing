export default function VerifyLoading() {
  return (
    <div className="space-y-8 max-w-lg mx-auto animate-pulse">
      <div className="text-center space-y-2">
        <div className="h-3 w-28 rounded-full bg-white/[0.05] mx-auto" />
        <div className="h-8 w-48 rounded-xl bg-white/[0.08] mx-auto" />
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-white/[0.06] mx-auto" />
        <div className="h-12 w-full max-w-xs rounded-xl bg-white/[0.04] mx-auto" />
        <div className="h-10 w-full max-w-xs rounded-xl bg-white/[0.08] mx-auto" />
      </div>
    </div>
  );
}
