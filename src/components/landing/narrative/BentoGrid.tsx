"use client";

import { motion } from "framer-motion";
import {
  Lock,
  Radio,
  Camera,
  Dog,
  MapPin,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    id: "chat",
    title: "Zero-Knowledge Secret Chat",
    icon: Lock,
    accent: "from-sky-500/20 to-blue-600/20",
    border: "group-hover:border-sky-400/50",
    badge: "E2EE Private",
    description:
      "Client-side encrypted messages that only you two can read. No ads, no feeds, zero data shared with third parties.",
    span: "md:col-span-8",
  },
  {
    id: "together",
    title: "Synchronized 4K Theater",
    icon: Radio,
    accent: "from-rose-500/20 to-pink-600/20",
    border: "group-hover:border-rose-400/50",
    badge: "Sub-Second Sync",
    description:
      "Watch movies, listen to music, and react side-by-side with zero audio lag or video desynchronization.",
    span: "md:col-span-4",
  },
  {
    id: "mood",
    title: "Live Mood & Distance",
    icon: MapPin,
    accent: "from-violet-500/20 to-purple-600/20",
    border: "group-hover:border-violet-400/50",
    badge: "Real-Time Vibe",
    description:
      "Broadcast how you feel and see distance shrink in real-time with gentle celestial presence vibrations.",
    span: "md:col-span-4",
  },
  {
    id: "memories",
    title: "Memory Vault & Time Capsules",
    icon: Camera,
    accent: "from-amber-500/20 to-yellow-600/20",
    border: "group-hover:border-amber-400/50",
    badge: "Date-Locked",
    description:
      "Photos, whispered voice letters, and milestone capsules that unlock only when your special anniversary arrives.",
    span: "md:col-span-4",
  },
  {
    id: "pet",
    title: "Shared Spirit Companion",
    icon: Dog,
    accent: "from-emerald-500/20 to-teal-600/20",
    border: "group-hover:border-emerald-400/50",
    badge: "Living Bond",
    description:
      "Raise a digital pet together — a living reflection of your shared connection rituals and daily check-ins.",
    span: "md:col-span-4",
  },
];

export function BentoGrid() {
  return (
    <section id="sanctuary" className="landing-section relative py-20 px-5 md:px-8">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="max-w-2xl mb-12">
          <div className="sanctuary-pill mb-3 inline-flex">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Curated Sanctuary Architecture</span>
          </div>
          <h2 className="display-lg text-[#fbf9f4] tracking-tight">
            Everything Intimate. <br />
            <span className="italic font-light text-sky-400">Nothing Public.</span>
          </h2>
          <p className="mt-3 text-sm md:text-base text-zinc-300 font-sans font-light leading-relaxed">
            Every feature is architected strictly within your private couple boundary — zero cloud training, zero telemetry leak.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: idx * 0.08 }}
                className={`sanctuary-card p-7 flex flex-col justify-between ${f.span} group relative overflow-hidden ${f.border}`}
              >
                {/* Background Ambient Glow */}
                <div
                  className={`absolute -right-16 -top-16 w-52 h-52 rounded-full bg-gradient-to-br ${f.accent} blur-3xl opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none`}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between pb-4">
                    <div className="p-3 rounded-xl bg-white/10 text-white shadow-inner">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-300 bg-white/10 px-3 py-1 rounded-full border border-white/10">
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="mt-4 font-serif text-2xl font-bold text-[#fbf9f4] tracking-wide">
                    {f.title}
                  </h3>

                  <p className="mt-3 text-sm text-zinc-300 font-sans leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
