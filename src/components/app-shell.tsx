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
      <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-white/[0.02] border border-white/[0.08] text-[10px] font-medium uppercase tracking-[0.14em]">
        <span
          className={`h-1.5 w-1.5 rounded-full transition-all ${
            partnerOnline
              ? "bg-amber-300 shadow-[0_0_8px_#fde68a]"
              : "bg-white/30"
          }`}
        />
        <span className={partnerOnline ? "text-[#fbf9f4]" : "text-white/40"}>
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
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium uppercase tracking-[0.14em] transition-all active:scale-95 ${
          myStatus === "online"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-white/10 bg-white/[0.02] text-white/40 hover:text-white/70"
        }`}
      >
        <span className="text-[9px] opacity-60">You:</span>
        <span
          className={`h-1.5 w-1.5 rounded-full transition-all ${
            myStatus === "online" ? "bg-emerald-400" : "bg-white/30"
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
        className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full border border-amber-400/25 bg-amber-400/5 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-200/90 hover:bg-amber-400/15 hover:border-amber-400/40 transition-all active:scale-95 disabled:opacity-50"
      >
        <span className="text-xs">✧</span>
        <span>{nudgePending ? "Pinging…" : "Nudge"}</span>
      </button>

      {toast && (
        <span className="absolute top-full mt-2 right-0 whitespace-nowrap text-[10px] font-medium tracking-wider text-amber-200 bg-[#08060f] border border-white/15 px-3 py-1 rounded-full shadow-xl z-50 animate-fade-in">
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
      <div className="min-h-screen bg-[#050409] text-[#e8e6e1] flex flex-col font-sans select-none pb-24 md:pb-12 overflow-x-hidden selection:bg-amber-400/20 selection:text-amber-200">
        
        {/* Subtle Ambient Cosmic Background (Restrained GPU Composited) */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-[15%] -left-[10%] w-[50%] h-[50%] rounded-full bg-violet-950/15 blur-[140px] pointer-events-none" />
          <div className="absolute top-[45%] -right-[10%] w-[45%] h-[55%] rounded-full bg-amber-500/[0.04] blur-[150px] pointer-events-none" />
        </div>

        {/* Minimalist Editorial Top Navigation */}
        <motion.header 
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#050409]/80 backdrop-blur-2xl"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
            
            {/* Brand */}
            <Link 
              href="/dashboard" 
              className="group relative flex items-center gap-2.5"
              aria-label="MadLove home"
            >
              <span className="font-serif text-xl tracking-[0.2em] font-light text-[#fbf9f4] group-hover:text-amber-200/90 transition-colors duration-300">
                MADLOVE
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" aria-hidden />
            </Link>
            
            {/* Main Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl" aria-label="Primary">
              {primaryLinks.map((l) => {
                const isActive = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(`${l.href}/`));
                return (
                  <Link 
                    key={l.href} 
                    href={l.href} 
                    className="relative px-3.5 py-1.5 text-[11px] font-medium tracking-[0.14em] uppercase transition-colors duration-200 group"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-full bg-white/[0.08] border border-white/15"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    <span className={`relative z-10 flex items-center gap-1.5 ${isActive ? 'text-[#fbf9f4]' : 'text-white/60 group-hover:text-white/90'}`}>
                      <span className="opacity-70 text-xs" aria-hidden>{l.icon}</span>
                      {l.label}
                    </span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                className={`relative px-3.5 py-1.5 text-[11px] font-medium tracking-[0.14em] uppercase transition-colors ${
                  moreOpen || allMoreLinks.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
                    ? "text-amber-200"
                    : "text-white/60 hover:text-white/90"
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
                  <div className="hidden sm:flex items-center gap-2">
                    <Link
                      href="/search"
                      aria-label="Search"
                      className="p-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white hover:border-white/20 transition-all"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href="/notifications"
                      aria-label="Notifications"
                      className="p-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white hover:border-white/20 transition-all"
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href="/profile"
                      aria-label="Couple Profile"
                      className="p-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white hover:border-white/20 transition-all"
                    >
                      <User className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : null}

              <form action="/api/auth/logout" method="POST" className="hidden md:block">
                <button 
                  type="submit" 
                  className="px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-[10px] font-medium uppercase tracking-[0.16em] text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-all duration-200"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </motion.header>

        {/* Main Content Area with Subtle Transitions */}
        <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 md:py-10 flex-1 flex flex-col justify-start relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Floating Bottom Navigation Bar for Mobile */}
        <div 
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#050409]/92 backdrop-blur-2xl border-t border-white/[0.08] px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl"
          aria-label="Bottom Navigation"
        >
          {primaryLinks.map((l) => {
            const isActive = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(`${l.href}/`));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all relative ${
                  isActive ? "text-[#fbf9f4]" : "text-white/50 hover:text-white/80"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-glow"
                    className="absolute inset-0 bg-white/[0.08] rounded-xl border border-white/15"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="text-base relative z-10" aria-hidden>{l.icon}</span>
                <span className="text-[9px] font-medium tracking-wider uppercase relative z-10">{l.label}</span>
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
              moreOpen ? "text-amber-200" : "text-white/50 hover:text-white/80"
            }`}
          >
            {moreOpen && (
              <div className="absolute inset-0 bg-white/[0.08] rounded-xl border border-white/15" />
            )}
            <span className="text-base relative z-10" aria-hidden>✦</span>
            <span className="text-[9px] font-medium tracking-wider uppercase relative z-10">Menu</span>
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
                className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] border-t border-white/15 bg-[#08060f]/95 backdrop-blur-3xl px-6 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto shadow-2xl md:left-1/2 md:right-auto md:bottom-auto md:top-20 md:w-full md:max-w-2xl md:-translate-x-1/2 md:rounded-[24px] md:border md:border-white/15 md:max-h-[75vh]"
              >
                {/* Drag Indicator */}
                <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" aria-hidden />
                
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif text-sm font-light text-[#fbf9f4] tracking-[0.2em] uppercase">
                    Sanctuary Universe
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(false)}
                    className="text-xs text-white/50 hover:text-white px-3 py-1 rounded-full border border-white/10 hover:border-white/20 transition-colors"
                  >
                    Close ✕
                  </button>
                </div>

                <div className="space-y-6 mb-8">
                  {moreGroups.map((group) => (
                    <div key={group.title}>
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 mb-3 border-b border-white/[0.06] pb-1.5">
                        {group.title}
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {group.links.map((l) => {
                          const isActive =
                            pathname === l.href || pathname.startsWith(`${l.href}/`);
                          return (
                            <Link
                              key={l.href}
                              href={l.href}
                              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                                isActive
                                  ? "border-amber-400/40 bg-amber-400/10 text-amber-200 shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                                  : "border-white/[0.06] bg-white/[0.02] text-white/70 hover:bg-white/[0.05] hover:border-white/15 hover:text-[#fbf9f4]"
                              }`}
                            >
                              <span className="text-xl opacity-80" aria-hidden>
                                {l.icon}
                              </span>
                              <span className="text-[11px] font-medium text-center truncate w-full tracking-wider">
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
                <div className="border-t border-white/[0.08] pt-4 flex gap-3">
                  <form action="/api/auth/logout" method="POST" className="w-full">
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-medium uppercase tracking-[0.18em] text-white/70 hover:bg-rose-500/10 hover:text-rose-200 hover:border-rose-400/30 transition-all flex items-center justify-center gap-2"
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
