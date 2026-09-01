"use client";

import { motion, Variants } from "framer-motion";
import Link from "next/link";
import { useEffect } from "react";

type TogetherProps = {
  activeSessions: { id: string; provider: string; status: string; title: string; scheduledFor: string | Date; invitationMessage?: string | null }[];
  pastSessions: { id: string; title: string; scheduledFor: string | Date }[];
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 25 }
  }
};

export function TogetherClient({ activeSessions, pastSessions }: TogetherProps) {
  useEffect(() => {
    // Force a "movie night" theme on this specific page
    document.documentElement.setAttribute("data-theme", "movie-night");
    return () => document.documentElement.removeAttribute("data-theme");
  }, []);

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-5xl space-y-12"
    >
      <motion.header variants={itemVariants} className="relative rounded-[32px] glass-panel p-12 text-center border-t border-white/[0.08] overflow-hidden group">
        {/* Cinematic Backdrop */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-screen group-hover:scale-105 transition-transform duration-[2s] ease-out" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020104] via-black/40 to-transparent" />
        
        {/* Glow Effects */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[100px] opacity-30 bg-amber-500/50 ambient-pulse" />
        
        <div className="relative z-10 flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400/80 mb-4 bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20 shadow-[0_0_20px_rgba(251,191,36,0.15)]">
            Virtual Theater
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 font-display tracking-tight text-glow">
            MadLove Together
          </h1>
          <p className="mt-4 text-sm md:text-base text-slate-300 font-medium max-w-lg mx-auto leading-relaxed">
            Your private cinematic space. Sync movies, share reactions, and build a digital film library of your memories together.
          </p>
          <div className="mt-8 flex justify-center gap-6">
            <Link
              href="/together/new"
              className="group relative inline-flex items-center gap-2 rounded-full bg-white text-black px-8 py-3.5 font-extrabold text-[11px] uppercase tracking-widest shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:scale-105 transition-all duration-300"
            >
              <span>Plan Movie Night</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </motion.header>

      <div className="space-y-6">
        <motion.h2 variants={itemVariants} className="text-sm font-bold text-white font-display tracking-[0.1em] uppercase flex items-center gap-3">
          <span className="w-8 h-px bg-white/20" />
          Up Next
          <span className="w-8 h-px bg-white/20" />
        </motion.h2>

        {activeSessions.length === 0 ? (
          <motion.div variants={itemVariants} className="rounded-3xl glass-panel border border-white/[0.04] bg-white/[0.01] p-12 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-2xl text-slate-600">
              🍿
            </div>
            <div>
              <p className="text-slate-400 font-medium text-sm">The theater is currently empty.</p>
              <p className="text-slate-500 text-xs mt-1">Set up a movie date to see it here.</p>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {activeSessions.map((session) => (
              <motion.div variants={itemVariants} key={session.id} className="group relative overflow-hidden rounded-3xl glass-panel border border-white/[0.04] bg-white/[0.02] p-8 shadow-2xl interactive">
                {/* Poster Mock Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-purple-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <span className="rounded-full bg-black/40 border border-white/[0.08] px-3 py-1 text-[9px] font-bold text-slate-300 uppercase tracking-widest backdrop-blur-md">
                        {session.provider}
                      </span>
                      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        {session.status}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-white font-display tracking-tight leading-tight group-hover:text-amber-100 transition-colors">
                      {session.title}
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-400 mt-2 uppercase tracking-widest">
                      {new Date(session.scheduledFor).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {session.invitationMessage && (
                      <p className="mt-4 text-xs italic text-slate-300 bg-black/20 border-l-2 border-amber-500/30 p-3 rounded-r-xl">
                        &ldquo;{session.invitationMessage}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="mt-8">
                    <Link
                      href={`/together/room/${session.id}`}
                      className="inline-flex w-full justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-3 text-[10px] font-extrabold uppercase tracking-widest text-white transition-all duration-300 backdrop-blur-sm"
                    >
                      Enter Room
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {pastSessions.length > 0 && (
        <div className="space-y-6 pt-8">
          <motion.h2 variants={itemVariants} className="text-sm font-bold text-white font-display tracking-[0.1em] uppercase flex items-center gap-3">
            <span className="w-8 h-px bg-white/20" />
            Watch Memory Vault
            <span className="w-8 h-px bg-white/20" />
          </motion.h2>
          
          {/* Filmstrip Layout */}
          <motion.div variants={itemVariants} className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
            {pastSessions.map((session) => (
              <Link
                href={`/together/memory/${session.id}`}
                key={session.id}
                className="snap-start flex-none w-[280px] rounded-2xl glass-panel border border-white/[0.04] bg-white/[0.01] p-6 hover:border-white/[0.15] hover:bg-white/[0.04] opacity-80 hover:opacity-100 transition-all duration-500 group"
              >
                <div className="aspect-video w-full rounded-lg bg-[#050208] border border-white/5 mb-4 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                  <span className="text-3xl opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">🎞️</span>
                </div>
                <h3 className="font-bold text-slate-100 font-display text-sm tracking-tight truncate">{session.title}</h3>
                <p className="text-[10px] font-semibold text-slate-500 mt-1 uppercase tracking-widest">
                  {new Date(session.scheduledFor).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
