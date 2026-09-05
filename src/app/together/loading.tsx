export default function TogetherLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
      {/* Theater Top Telemetry Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="h-4 w-40 rounded-full bg-white/[0.05]" />
        <div className="h-4 w-32 rounded-full bg-white/[0.05]" />
      </div>

      {/* Cinematic Frame */}
      <div className="relative aspect-video w-full rounded-3xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/[0.06]" />
      </div>
    </div>
  );
}
