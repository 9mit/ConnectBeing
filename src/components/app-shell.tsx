"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Home,
  Film,
  MessageSquare,
  Image as ImageIcon,
  Clock,
  LayoutGrid,
  Bell,
  Search,
  User,
  Smile,
  HelpCircle,
  Target,
  Heart,
  Calendar,
  Sparkles,
  Trophy,
  Phone,
  MapPin,
  Settings,
  Lock,
  Shield,
  CheckCircle,
  CreditCard,
  Radio,
  LogOut,
  X,
} from "lucide-react";

import { PresenceProvider, usePresence } from "@/components/presence-provider";

const primaryNavItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/together", label: "Together", icon: Film },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/memories", label: "Memories", icon: ImageIcon },
  { href: "/timeline", label: "Timeline", icon: Clock },
];

const sanctuaryMenuGroups = [
  {
    title: "Daily Rituals",
    links: [
      { href: "/mood", label: "Vibe Check", icon: Smile },
      { href: "/quiz", label: "Couple Quiz", icon: HelpCircle },
      { href: "/challenges", label: "Shared Quests", icon: Target },
      { href: "/pet", label: "Companion", icon: Heart },
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/insights", label: "Resonance", icon: Sparkles },
      { href: "/achievements", label: "Milestones", icon: Trophy },
    ],
  },
  {
    title: "Shared Space & Tools",
    links: [
      { href: "/call", label: "Voice Room", icon: Phone },
      { href: "/location", label: "Location", icon: MapPin },
      { href: "/search", label: "Archive Search", icon: Search },
    ],
  },
  {
    title: "Sanctuary & Privacy",
    links: [
      { href: "/profile", label: "Profile", icon: User },
      { href: "/settings", label: "Preferences", icon: Settings },
      { href: "/notifications", label: "Alerts", icon: Bell },
      { href: "/privacy", label: "Privacy Vault", icon: Lock },
      { href: "/security", label: "Encryption", icon: Shield },
      { href: "/verify", label: "Couple Seal", icon: CheckCircle },
      { href: "/billing", label: "Membership", icon: CreditCard },
    ],
  },
];

const allSecondaryLinks = sanctuaryMenuGroups.flatMap((g) => g.links);

function HeaderPresenceControl() {
  const { partnerOnline, myStatus, toggleMyStatus, nudgePartner, nudgePending } = usePresence();
  const [toast, setToast] = useState<string | null>(null);

  async function handleNudge() {
    const res = await nudgePartner();
    setToast(res.message || (res.ok ? "Ping sent" : "Failed"));
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <div className="flex items-center gap-2 relative">
      {/* Unified Relationship Presence Indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs font-normal">
        <span
          className={`h-2 w-2 rounded-full transition-all duration-300 ${
            partnerOnline
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
              : "bg-zinc-600"
          }`}
          aria-hidden
        />
        <span className={partnerOnline ? "text-[#f7f6f2] font-medium" : "text-zinc-400"}>
          {partnerOnline ? "Partner is here" : "Partner away"}
        </span>

        <span className="text-zinc-600 font-light mx-0.5">·</span>

        {/* User toggle button */}
        <button
          type="button"
          onClick={toggleMyStatus}
          title={
            myStatus === "online"
              ? "You appear online. Click to set quiet mode."
              : "You appear offline. Click to set active mode."
          }
          className="text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
        >
          <span className="text-[11px]">
            {myStatus === "online" ? "Active" : "Quiet"}
          </span>
        </button>
      </div>

      {/* Gentle Nudge Button */}
      <button
        type="button"
        disabled={nudgePending}
        onClick={handleNudge}
        title="Send a quiet thinking-of-you ping"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-xs text-zinc-300 hover:text-white hover:border-white/[0.18] hover:bg-white/[0.05] transition-all active:scale-95 disabled:opacity-50"
      >
        <Radio className={`w-3 h-3 text-amber-300/80 ${nudgePending ? "animate-pulse" : ""}`} />
        <span className="text-[11px] font-medium">{nudgePending ? "Pinging…" : "Ping"}</span>
      </button>

      {toast && (
        <span className="absolute top-full mt-2 right-0 whitespace-nowrap text-xs font-medium text-[#f7f6f2] bg-[#12131a] border border-white/10 px-3 py-1 rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-top-1 duration-200">
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
  const [menuOpen, setMenuOpen] = useState(false);

  // Close drawer when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <PresenceProvider coupleId={coupleId} userId={userId}>
      <div className="min-h-screen bg-[#07080b] text-[#f7f6f2] flex flex-col font-sans select-none pb-24 md:pb-10 overflow-x-hidden selection:bg-amber-400/20 selection:text-amber-100">
        
        {/* Subtle Ambient Background Gradient */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-[20%] left-[20%] w-[60%] h-[45%] rounded-full bg-white/[0.015] blur-[160px] pointer-events-none" />
        </div>

        {/* Minimalist Editorial Top Navigation */}
        <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07080b]/85 backdrop-blur-xl transition-all">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
            
            {/* Brand Mark */}
            <Link 
              href="/dashboard" 
              className="group relative flex items-center gap-2"
              aria-label="MadLove Sanctuary"
            >
              <span className="font-serif text-lg tracking-[0.22em] font-light text-[#f7f6f2] group-hover:text-amber-100/90 transition-colors">
                MADLOVE
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" aria-hidden />
            </Link>
            
            {/* Primary Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 p-1 rounded-full border border-white/[0.07] bg-white/[0.02]" aria-label="Primary">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                return (
                  <Link 
                    key={item.href} 
                    href={item.href} 
                    prefetch={true}
                    className={`relative px-3.5 py-1.5 text-xs font-medium tracking-wide transition-colors rounded-full ${
                      isActive ? "text-[#f7f6f2]" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="desktop-nav-active"
                        className="absolute inset-0 rounded-full bg-white/[0.08] border border-white/[0.12]"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 opacity-80" />
                      <span>{item.label}</span>
                    </span>
                  </Link>
                );
              })}
              
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className={`relative px-3 py-1.5 text-xs font-medium tracking-wide transition-colors rounded-full flex items-center gap-1.5 ${
                  menuOpen || allSecondaryLinks.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
                    ? "text-amber-200 bg-white/[0.05]"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                aria-expanded={menuOpen}
              >
                <LayoutGrid className="w-3.5 h-3.5 opacity-80" />
                <span>More</span>
              </button>
            </nav>
            
            {/* Presence & Quick User Actions */}
            <div className="flex items-center gap-2.5 relative z-10">
              {coupleId && userId ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <HeaderPresenceControl />

                  <div className="hidden lg:flex items-center gap-1.5 border-l border-white/[0.08] pl-2.5">
                    <Link
                      href="/search"
                      prefetch={true}
                      aria-label="Search sanctuary"
                      className="p-2 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-colors"
                    >
                      <Search className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/notifications"
                      prefetch={true}
                      aria-label="Alerts"
                      className="p-2 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-colors"
                    >
                      <Bell className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/profile"
                      prefetch={true}
                      aria-label="Couple profile"
                      className="p-2 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-colors"
                    >
                      <User className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ) : null}

              <form action="/api/auth/logout" method="POST" className="hidden lg:block">
                <button 
                  type="submit" 
                  className="p-2 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-colors"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 md:py-10 flex-1 flex flex-col justify-start relative z-10">
          <motion.div
            key={pathname}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="w-full"
          >
            {children}
          </motion.div>
        </main>

        {/* Mobile Ergonomic Bottom Navigation */}
        <nav 
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#07080b]/90 backdrop-blur-2xl border-t border-white/[0.07] px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl"
          aria-label="Mobile Navigation"
        >
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all relative min-h-[44px] justify-center ${
                  isActive ? "text-[#f7f6f2]" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-pill"
                    className="absolute inset-0 bg-white/[0.08] rounded-2xl border border-white/[0.12]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className="w-4 h-4 relative z-10" />
                <span className="text-[10px] font-medium tracking-wide relative z-10">{item.label}</span>
              </Link>
            );
          })}
          
          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Open sanctuary menu"
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all relative min-h-[44px] justify-center ${
              menuOpen ? "text-amber-200" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {menuOpen && (
              <div className="absolute inset-0 bg-white/[0.08] rounded-2xl border border-white/[0.12]" />
            )}
            <LayoutGrid className="w-4 h-4 relative z-10" />
            <span className="text-[10px] font-medium tracking-wide relative z-10">Menu</span>
          </button>
        </nav>

        {/* Sanctuary Universe Drawer */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
              />
              
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 240 }}
                className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-white/[0.12] bg-[#0c0d12]/95 backdrop-blur-2xl px-6 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto shadow-2xl md:left-1/2 md:right-auto md:bottom-auto md:top-16 md:w-full md:max-w-xl md:-translate-x-1/2 md:rounded-2xl md:border md:border-white/[0.12] md:max-h-[78vh]"
              >
                {/* Pull Bar */}
                <div className="w-8 h-1 rounded-full bg-white/20 mx-auto mb-5 md:hidden" aria-hidden />
                
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base font-light text-[#f7f6f2] tracking-wider">
                      Sanctuary Menu
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/[0.06] transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-6 mb-6">
                  {sanctuaryMenuGroups.map((group) => (
                    <div key={group.title}>
                      <p className="text-[11px] font-medium tracking-wider uppercase text-zinc-400 mb-2.5">
                        {group.title}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {group.links.map((item) => {
                          const Icon = item.icon;
                          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              prefetch={true}
                              onClick={() => setMenuOpen(false)}
                              className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                                isActive
                                  ? "border-amber-400/40 bg-amber-400/[0.08] text-amber-100"
                                  : "border-white/[0.05] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                              }`}
                            >
                              <Icon className="w-4 h-4 opacity-75 shrink-0" />
                              <span className="text-xs font-medium truncate">
                                {item.label}
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
                      className="w-full py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-xs font-medium text-zinc-300 hover:text-rose-200 hover:border-rose-400/30 hover:bg-rose-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
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
