export default function BillingLoading() {
  return (
    <div className="space-y-10 max-w-4xl mx-auto animate-pulse">
      <div className="text-center space-y-2">
        <div className="h-3 w-32 rounded-full bg-white/[0.05] mx-auto" />
        <div className="h-8 w-56 rounded-xl bg-white/[0.08] mx-auto" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-72 rounded-3xl border border-white/[0.08] bg-white/[0.02]" />
        <div className="h-72 rounded-3xl border border-white/[0.08] bg-white/[0.02]" />
      </div>
    </div>
  );
}
