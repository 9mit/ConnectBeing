import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { movieMemories } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { redirectPathForAuthError, requireActiveCouple } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { formatDateMedium } from "@/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: BRAND.formatTitle("Movie Memory & Recap"),
  description: "Watch party memories, best moments, and conversation starters.",
};

export default async function MovieMemoryPage({
  params,
}: {
  params: { sessionId: string };
}) {
  let user, couple;
  try {
    const auth = await requireActiveCouple();
    user = auth.user;
    couple = auth.couple;
  } catch (error) {
    redirect(redirectPathForAuthError(error));
  }

  const now = new Date();
  const memory = await db.query.movieMemories.findFirst({
    where: and(
      eq(movieMemories.sessionId, params.sessionId),
      eq(movieMemories.coupleId, couple.id),
    ),
  });

  if (!memory || memory.expiresAt <= now) {
    redirect("/together");
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(memory.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <AppShell coupleId={couple.id} userId={user.id}>
      <div className="mx-auto max-w-3xl space-y-6 py-6">
        <Link href="/together" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
          ← Back to Theater
        </Link>
        
        <div className="relative rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 shadow-2xl overflow-hidden backdrop-blur-2xl">
          <div className="p-8 md:p-10 text-center border-b border-amber-500/20 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400 bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/20">
              Watch Memory
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight text-glow-gold">
              {memory.title}
            </h1>
            <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Watched Together on {formatDateMedium(memory.date)}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-200">
                ⏱️ {memory.watchDuration} minutes together
              </span>
              {memory.provider && (
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold text-slate-300 uppercase">
                  📺 {memory.provider}
                </span>
              )}
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs font-bold text-rose-300">
                ⏳ {daysRemaining} days left in Vault
              </span>
            </div>
          </div>

          <div className="p-8 md:p-10 flex flex-col items-center justify-center text-center space-y-4">
            {memory.posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={memory.posterUrl}
                alt={memory.title}
                className="max-h-72 rounded-2xl shadow-xl border border-white/10 object-cover"
              />
            )}
            <p className="text-sm text-slate-300 max-w-md">
              A shared memory of your movie date. Kept in your private vault for 7 days before being automatically cleaned up.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
