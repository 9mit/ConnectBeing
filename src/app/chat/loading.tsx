export default function ChatLoading() {
  return (
    <div className="max-w-4xl mx-auto h-[calc(100dvh-12rem)] md:h-[calc(100dvh-10rem)] flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] overflow-hidden animate-pulse">
      {/* Chat Header */}
      <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-white/10 rounded-lg" />
            <div className="h-3 w-20 bg-white/5 rounded-full" />
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-white/5" />
      </div>

      {/* Message Bubbles Area */}
      <div className="flex-1 p-5 space-y-4 overflow-hidden flex flex-col justify-end">
        <div className="flex justify-start">
          <div className="h-12 w-48 rounded-2xl bg-white/5 rounded-bl-sm" />
        </div>
        <div className="flex justify-end">
          <div className="h-14 w-60 rounded-2xl bg-amber-400/10 rounded-br-sm" />
        </div>
        <div className="flex justify-start">
          <div className="h-10 w-36 rounded-2xl bg-white/5 rounded-bl-sm" />
        </div>
        <div className="flex justify-end">
          <div className="h-10 w-44 rounded-2xl bg-amber-400/10 rounded-br-sm" />
        </div>
      </div>

      {/* Input Composer */}
      <div className="p-4 border-t border-white/[0.08] flex items-center gap-3">
        <div className="h-11 flex-1 bg-white/5 rounded-2xl" />
        <div className="h-11 w-11 bg-white/10 rounded-2xl shrink-0" />
      </div>
    </div>
  );
}
