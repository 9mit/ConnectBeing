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

  const memory = await db.query.movieMemories.findFirst({
    where: and(
      eq(movieMemories.sessionId, params.sessionId),
      eq(movieMemories.coupleId, couple.id),
    ),
  });

  if (!memory) {
    redirect("/together");
  }

  const aiSummary = memory.aiSummary as {
    recap?: string;
    bestMoments?: string[];
    questions?: string[];
  } | null;

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
            <div className="mt-6 flex justify-center gap-4">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-200">
                ⏱️ {memory.watchDuration} minutes together
              </span>
            </div>
          </div>

          <div className="p-8 md:p-10 space-y-8">
            {aiSummary ? (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400/80 mb-2">The Vibe</h2>
                  <p className="italic text-slate-200 text-base md:text-lg leading-relaxed bg-purple-950/60 border border-amber-500/20 p-6 rounded-2xl">
                    &ldquo;{aiSummary.recap}&rdquo;
                  </p>
                </div>
                
                {aiSummary.bestMoments && aiSummary.bestMoments.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400/80 mb-3">Best Moments</h2>
                    <ul className="space-y-2.5 text-sm text-slate-300 font-medium">
                      {aiSummary.bestMoments.map((m: string, i: number) => (
                        <li key={i} className="flex items-center gap-3 bg-purple-950/40 px-4 py-3 rounded-xl border border-amber-500/15">
                          <span className="text-amber-400">✨</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSummary.questions && aiSummary.questions.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400/80 mb-3">Conversation Starters</h2>
                    <div className="space-y-3">
                      {aiSummary.questions.map((q: string, i: number) => (
                        <div key={i} className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm text-slate-200 font-medium italic">
                          💬 &ldquo;{q}&rdquo;
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-400 text-sm py-8">
                No AI summary available for this watch session.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
