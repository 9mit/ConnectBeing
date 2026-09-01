"use client";

import { motion } from "framer-motion";
import { Lock, MapPin, Camera, Dog, Radio, Sparkles, Brain, Heart, Shield } from "lucide-react";

import { LANDING_FEATURES } from "@/content/site";

const ICONS = {
  lock: Lock,
  map: MapPin,
  camera: Camera,
  pet: Dog,
  together: Radio,
  radio: Radio,
} as const;

// Define column span configurations for a 6-column layout
const GRID_SPANS = {
  chat: "md:col-span-3",      // Row 1, Left (Half-width)
  mood: "md:col-span-3",      // Row 1, Right (Half-width)
  memories: "md:col-span-2",  // Row 2, Left (Third-width)
  pet: "md:col-span-2",       // Row 2, Center (Third-width)
  together: "md:col-span-2",  // Row 2, Right (Third-width)
} as const;

const ACCENTS = {
  chat: {
    icon: Lock,
    tag: "ECDH P-256 E2EE",
    gradient: "from-amber-400/20 to-purple-600/20",
    border: "group-hover:border-amber-400/50",
    iconBg: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  },
  mood: {
    icon: MapPin,
    tag: "Sub-Second Sync",
    gradient: "from-rose-500/20 to-pink-600/20",
    border: "group-hover:border-rose-400/50",
    iconBg: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  },
  memories: {
    icon: Camera,
    tag: "Time-Locked",
    gradient: "from-amber-500/20 to-yellow-600/20",
    border: "group-hover:border-amber-400/50",
    iconBg: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  },
  pet: {
    icon: Dog,
    tag: "Interactive Bond",
    gradient: "from-purple-500/20 to-pink-500/20",
    border: "group-hover:border-purple-400/50",
    iconBg: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  },
  together: {
    icon: Radio,
    tag: "4K Synchronized",
    gradient: "from-cyan-500/20 to-blue-600/20",
    border: "group-hover:border-cyan-400/50",
    iconBg: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
  },
};

export function BentoGrid() {
  return (
    <section
      className="landing-section relative z-10"
      aria-label="What MadLove holds for you"
    >
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9 }}
          className="max-w-2xl mb-16 md:mb-20 text-left"
        >
          <div className="stardust-pill mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Curated Sanctuary Architecture</span>
          </div>
          <h2 className="display-lg text-white font-serif tracking-tight">
            Everything intimate.
            <br />
            <span className="glow-text-gold italic font-medium">Nothing public.</span>
          </h2>
          <p className="mt-5 text-sm md:text-base text-slate-300 font-sans font-light leading-relaxed max-w-lg">
            Every feature is architected strictly within your private couple boundary — zero cloud training, zero telemetry leak.
          </p>
        </motion.div>

        <ul className="grid grid-cols-1 md:grid-cols-6 gap-6">
          {LANDING_FEATURES.map((f, idx) => {
            const accent = ACCENTS[f.id as keyof typeof ACCENTS] || ACCENTS.chat;
            const Icon = accent.icon;
            const spanClass = GRID_SPANS[f.id as keyof typeof GRID_SPANS] || "md:col-span-3";

            return (
              <motion.li
                key={f.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, delay: idx * 0.08 }}
                className={`group relative overflow-hidden rounded-3xl glass-card-luxury p-8 md:p-10 shadow-2xl transition-all duration-500 ${spanClass} ${accent.border}`}
              >
                {/* Background Ambient Glow */}
                <div
                  className={`absolute -right-16 -top-16 w-48 h-48 rounded-full bg-gradient-to-br ${accent.gradient} blur-3xl opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none`}
                />

                <div className="flex flex-col h-full justify-between items-start gap-8 relative z-10">
                  <div className="flex items-center justify-between w-full">
                    <div className={`p-3.5 rounded-2xl ${accent.iconBg} shadow-inner transition-transform duration-300 group-hover:scale-110`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest font-sans text-amber-200/80 bg-purple-950/80 border border-amber-500/20 px-3 py-1 rounded-full shadow-sm">
                      {accent.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-serif font-bold text-white tracking-wide text-glow-gold">
                      {f.title}
                    </h3>
                    <p className="mt-3 text-sm text-slate-300 font-sans font-light leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
