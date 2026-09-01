import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#070305] text-slate-100 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-[0.15] bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-md text-center space-y-6">
        <Link href="/" className="group flex flex-col items-center mb-2">
          <h1 className="text-5xl font-extrabold tracking-tight text-white font-display select-none group-hover:text-rose-100 transition-colors">
            MadLove
          </h1>
          <span className="text-[10px] uppercase tracking-[0.3em] text-rose-400/80 font-bold mt-1">
            universe for two
          </span>
        </Link>

        <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-8 backdrop-blur-xl shadow-2xl space-y-4 w-full">
          <span className="text-4xl font-extrabold text-rose-400 font-display">404</span>
          <h2 className="text-lg font-bold text-white">Page Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3 text-xs font-bold text-white hover:from-rose-600 hover:to-pink-700 transition-all shadow-lg shadow-rose-500/20"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
