export default function GlobalLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto py-10 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-white/10 rounded-xl" />
      <div className="h-4 w-72 bg-white/5 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <div className="h-48 rounded-3xl bg-white/[0.02] border border-white/[0.06]" />
        <div className="h-48 rounded-3xl bg-white/[0.02] border border-white/[0.06]" />
      </div>
    </div>
  );
}
