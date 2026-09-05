export default function ChatLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-3xl mx-auto animate-pulse">
      {/* Chat Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
        <div className="space-y-1.5">
          <div className="h-5 w-36 rounded-md bg-white/[0.08]" />
          <div className="h-3 w-24 rounded-full bg-white/[0.04]" />
        </div>
        <div className="h-8 w-20 rounded-full bg-white/[0.06]" />
      </div>

      {/* Message Stream */}
      <div className="flex-1 space-y-4 py-6">
        <div className="flex justify-start">
          <div className="h-14 w-64 rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
        </div>
        <div className="flex justify-end">
          <div className="h-12 w-56 rounded-2xl bg-white/[0.06] border border-white/[0.08]" />
        </div>
        <div className="flex justify-start">
          <div className="h-16 w-72 rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
        </div>
        <div className="flex justify-end">
          <div className="h-10 w-44 rounded-2xl bg-white/[0.06] border border-white/[0.08]" />
        </div>
      </div>

      {/* Message Input Dock */}
      <div className="h-14 w-full rounded-2xl border border-white/[0.08] bg-white/[0.02]" />
    </div>
  );
}
