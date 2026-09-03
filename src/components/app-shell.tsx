"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Bell, Search, User } from "lucide-react";

import { PresenceProvider, usePresence } from "@/components/presence-provider";

const primaryLinks = [
  { href: "/dashboard", label: "Home", icon: "✦" },
  { href: "/together", label: "Together", icon: "🍿" },
  { href: "/chat", label: "Chat", icon: "💬" },
  { href: "/memories", label: "Memories", icon: "📸" },
  { href: "/timeline", label: "Timeline", icon: "⏳" },
];

const moreGroups: Array<{
  title: string;
  links: Array<{ href: string; label: string; icon: string }>;
}> = [
  {
    title: "Connection Rituals",
    links: [
      { href: "/mood", label: "Vibe", icon: "🎭" },
      { href: "/quiz", label: "Quiz", icon: "❓" },
      { href: "/challenges", label: "Quests", icon: "🎯" },
      { href: "/pet", label: "Pet", icon: "🐹" },
      { href: "/calendar", label: "Calendar", icon: "📅" },
      { href: "/insights", label: "Insights", icon: "✨" },
      { href: "/achievements", label: "Trophies", icon: "🏆" },
    ],
  },
  {
    title: "Shared Space & Tools",
    links: [
      { href: "/call", label: "Call", icon: "📞" },
      { href: "/location", label: "Location", icon: "📍" },
      { href: "/search", label: "Search", icon: "🔍" },
    ],
  },
  {
    title: "Couple & Security",
    links: [
      { href: "/profile", label: "Profile", icon: "👤" },
      { href: "/settings", label: "Settings", icon: "⚙️" },
      { href: "/notifications", label: "Alerts", icon: "🔔" },
      { href: "/privacy", label: "Privacy", icon: "🔒" },
      { href: "/security", label: "Security", icon: "🛡️" },
      { href: "/verify", label: "Verify", icon: "✓" },
      { href: "/billing", label: "Support", icon: "♡" },
    ],
  },
];

const allMoreLinks = moreGroups.flatMap((g) => g.links);

function HeaderPresenceControl() {
  const { partnerOnline, myStatus, toggleMyStatus, nudgePartner, nudgePending } = usePresence();
  const [toast, setToast] = useState<string | null>(null);

  async function handleNudge() {
    const res = await nudgePartner();
    setToast(res.message || (res.ok ? "🔔 Ping sent!" : "Failed"));
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="flex items-center gap-2 relative flex-wrap">
      {/* Partner Presence Badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-purple-950/40 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider shadow-inner">
        <span
          className={`h-2 w-2 rounded-full transition-all ${
            partnerOnline
              ? "bg-amber-400 animate-pulse shadow-[0_0_10px_#fbbf24]"
              : "bg-slate-500"
          }`}
        />
        <span className={partnerOnline ? "text-amber-300 font-semibold" : "text-slate-400"}>
          {partnerOnline ? "Partner Online" : "Partner Away"}
        </span>
      </div>

      {/* Manual On / Off Toggle Switch */}
      <button
        type="button"
        onClick={toggleMyStatus}
        title={
          myStatus === "online"
            ? "Your status is ONLINE. Click to turn OFF (appear offline)"
            : "Your status is OFFLINE. Click to turn ON (appear online)"
        }
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
          myStatus === "online"
            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
            : "border-slate-700 bg-slate-900/80 text-slate-400"
        }`}
      >
        <span className="text-[9px] opacity-75">You:</span>
        <span
          className={`h-2 w-2 rounded-full transition-all ${
            myStatus === "online" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
          }`}
        />
        <span>{myStatus === "online" ? "ON" : "OFF"}</span>
      </button>

      {/* Ping / Nudge Button */}
      <button
        type="button"
        disabled={nudgePending}
        onClick={handleNudge}
        title="Ping your partner to connect"
        className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-[10px] font-bold uppercase tracking-widest text-amber-300 hover:bg-amber-500 hover:text-purple-950 transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_12px_rgba(212,175,55,0.2)]"
      >
        <span>🔔</span>
        <span>{nudgePending ? "Pinging…" : "Nudge"}</span>
      </button>

      {toast && (
        <span className="absolute top-full mt-2 right-0 whitespace-nowrap text-[10px] font-bold text-amber-300 bg-purple-950/95 border border-amber-500/40 px-3 py-1 rounded-full shadow-lg z-50 animate-bounce">
          {toast}
        </span>
      )}
    </div>
  );
}

export function AppShell({
  coupleId,
  userId,
  children,
}: {
  coupleId?: string | null;
  userId?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <PresenceProvider coupleId={coupleId} userId={userId}>
      <div className="min-h-screen bg-[#07020f] text-slate-100 flex flex-col font-sans select-none pb-24 md:pb-12 overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200">
        
        {/* Background Ambient Glows (Optimized CSS GPU Compositing — Zero Lag) */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[55%] h-[55%] rounded-full bg-purple-900/20 blur-[120px] opacity-75 transform-gpu pointer-events-none" />
          <div className="absolute top-[40%] -right-[10%] w-[45%] h-[60%] rounded-full bg-amber-500/10 blur-[130px] opacity-75 transform-gpu pointer-events-none" />
        </div>

        {/* Cinematic Top Navigation */}
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="sticky top-0 z-40 border-b border-amber-500/15 bg-[#07020f]/80 backdrop-blur-3xl"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
            
            {/* Brand */}
            <Link 
              href="/dashboard" 
              className="group relative flex items-center gap-2"
              aria-label="MadLove home"
            >
              <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <span className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 font-display relative z-10 text-glow-gold">
                MadLove
              </span>
            </Link>
            
            {/* Main Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1 p-1.5 rounded-[24px] border border-amber-500/20 bg-purple-950/30 shadow-inner shadow-amber-500/10" aria-label="Primary">
              {primaryLinks.map((l) => {
                const isActive = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(`${l.href}/`));
                return (
                  <Link 
                    key={l.href} 
                    href={l.href} 
                    className="relative px-3.5 py-2 text-[10px] font-bold tracking-widest uppercase transition-colors duration-300 group"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-full bg-amber-500/15 border border-amber-500/30 shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className={`relative z-10 flex items-center gap-1.5 ${isActive ? 'text-amber-200' : 'text-slate-300 group-hover:text-amber-100'}`}>
                      <span className="opacity-80 text-xs" aria-hidden>{l.icon}</span>
                      {l.label}
                    </span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                className={`relative px-3.5 py-2 text-[10px] font-bold tracking-widest uppercase transition-colors ${
                  moreOpen || allMoreLinks.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
                    ? "text-amber-200"
                    : "text-slate-300 hover:text-amber-100"
                }`}
              >
                More ▾
              </button>
            </nav>
            
            {/* Tools & Auth Controls */}
            <div className="flex items-center gap-3 relative z-10">
              {coupleId && userId ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <HeaderPresenceControl />
                  <div className="hidden sm:flex items-center gap-3">
                    <Link
                      href="/search"
                      aria-label="Search"
                    className="p-2 rounded-full border border-amber-500/20 bg-purple-950/40 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 transition-all"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href="/notifications"
                    aria-label="Notifications"
                    className="p-2 rounded-full border border-amber-500/20 bg-purple-950/40 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 transition-all"
                  >
                    <Bell className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href="/profile"
                    aria-label="Couple Profile"
                    className="p-2 rounded-full border border-amber-500/20 bg-purple-950/40 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 transition-all"
                  >
                    <User className="w-3.5 h-3.5" />
                  </Link>
                  </div>
                </div>
              ) : null}

              <form action="/api/auth/logout" method="POST" className="hidden md:block">
                <button 
                  type="submit" 
                  className="px-3.5 py-1.5 rounded-full border border-amber-500/20 bg-purple-950/40 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-amber-300 hover:bg-amber-500/15 hover:border-amber-500/40 transition-all duration-300"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </motion.header>

        {/* Main Content Area with Page Transitions */}
        <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 md:py-10 flex-1 flex flex-col justify-start relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Floating Bottom Navigation Bar for Mobile */}
        <div 
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#07020f]/95 backdrop-blur-2xl border-t border-amber-500/20 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl"
          aria-label="Bottom Navigation"
        >
          {primaryLinks.map((l) => {
            const isActive = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(`${l.href}/`));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all relative ${
                  isActive ? "text-amber-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-glow"
                    className="absolute inset-0 bg-amber-500/15 rounded-xl border border-amber-500/30 shadow-[0_0_12px_rgba(212,175,55,0.25)]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="text-lg relative z-10" aria-hidden>{l.icon}</span>
                <span className="text-[8.5px] font-bold tracking-wider uppercase relative z-10">{l.label}</span>
              </Link>
            );
          })}
          
          {/* Mobile "More" Trigger */}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            aria-label="Open features menu"
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all relative ${
              moreOpen ? "text-amber-300" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {moreOpen && (
              <div className="absolute inset-0 bg-amber-500/15 rounded-xl border border-amber-500/30" />
            )}
            <span className="text-lg relative z-10" aria-hidden>🌌</span>
            <span className="text-[8.5px] font-bold tracking-wider uppercase relative z-10">Menu</span>
          </button>
        </div>

        {/* Universal Smooth Drawer / Dialog */}
        <AnimatePresence>
          {moreOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMoreOpen(false)}
                className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md"
              />
              
              {/* Drawer Sheet */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 220 }}
                className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[32px] border-t border-amber-500/30 bg-[#0f051c]/95 backdrop-blur-3xl px-6 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto shadow-2xl md:left-1/2 md:right-auto md:bottom-auto md:top-20 md:w-full md:max-w-2xl md:-translate-x-1/2 md:rounded-[28px] md:border md:border-amber-500/30 md:max-h-[75vh]"
              >
                {/* Drag Indicator */}
                <div className="w-12 h-1.5 rounded-full bg-amber-500/30 mx-auto mb-6" aria-hidden />
                
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold text-amber-300 font-display tracking-[0.2em] uppercase text-glow-gold">
                    MadLove Universe
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(false)}
                    className="text-xs text-slate-400 hover:text-amber-200 px-2.5 py-1 rounded-full border border-amber-500/20"
                  >
                    Close ✕
                  </button>
                </div>

                <div className="space-y-6 mb-8">
                  {moreGroups.map((group) => (
                    <div key={group.title}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70 mb-3 border-b border-amber-500/10 pb-1">
                        {group.title}
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                        {group.links.map((l) => {
                          const isActive =
                            pathname === l.href || pathname.startsWith(`${l.href}/`);
                          return (
                            <Link
                              key={l.href}
                              href={l.href}
                              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
                                isActive
                                  ? "border-amber-500/50 bg-amber-500/20 text-amber-200 shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                                  : "border-purple-900/40 bg-purple-950/40 text-slate-300 hover:bg-purple-900/50 hover:border-amber-500/30 hover:text-amber-100"
                              }`}
                            >
                              <span className="text-2xl" aria-hidden>
                                {l.icon}
                              </span>
                              <span className="text-[11px] font-bold text-center truncate w-full">
                                {l.label}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Drawer Footer Actions */}
                <div className="border-t border-amber-500/20 pt-4 flex gap-3">
                  <form action="/api/auth/logout" method="POST" className="w-full">
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500 hover:text-purple-950 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.15)]"
                    >
                      <span>🚪</span> Sign Out
                    </button>
                  </form>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </PresenceProvider>
  );
}
