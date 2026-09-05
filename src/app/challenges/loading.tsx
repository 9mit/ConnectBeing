export default function ChallengesLoading() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto animate-pulse">
      <div className="space-y-4">
        <div className="h-8 w-44 rounded-xl bg-white/[0.08]" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
          ))}
        </div>
      </div>
    </div>
  );
}
