export default function PetLoading() {
  return (
    <div className="space-y-10 max-w-lg mx-auto animate-pulse">
      <div className="text-center space-y-1">
        <div className="h-3 w-28 rounded-full bg-white/[0.05] mx-auto" />
        <div className="h-8 w-44 rounded-xl bg-white/[0.08] mx-auto" />
        <div className="h-4 w-72 max-w-full rounded-md bg-white/[0.04] mx-auto" />
      </div>

      <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 flex flex-col items-center justify-center min-h-[300px] space-y-6">
        <div className="w-32 h-32 rounded-full bg-white/[0.06]" />
        <div className="space-y-2 text-center w-full max-w-xs">
          <div className="h-5 w-32 rounded-md bg-white/[0.08] mx-auto" />
          <div className="h-2 w-full rounded-full bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
