"use client";

import { motion } from "framer-motion";
import { EyeOff, ServerOff, KeyRound, Smartphone } from "lucide-react";
import { BRAND } from "@/lib/brand";

export function SectionTrust() {
  return (
    <section
      id="privacy"
      className="landing-section relative py-20 md:py-28 px-5 text-center overflow-hidden"
      aria-label="Privacy and Cryptographic Solitude"
    >
      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Narrative Chapter Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl mx-auto mb-14 text-center"
        >
          <p className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-zinc-400/80 mb-3">
            Chapter IV · The Cryptographic Boundary
          </p>
          <h2 className="font-serif text-[clamp(2.2rem,5vw,3.6rem)] font-light tracking-[-0.015em] leading-[1.12] text-[#fbf9f4]">
            Trust is not a promise. <br />
            <span className="font-serif italic font-normal text-[#f4efe4]">
              It is mathematics.
            </span>
          </h2>
          <p className="mt-4 text-base md:text-lg text-zinc-300/80 font-sans font-light leading-relaxed">
            Your most intimate thoughts, whispers, and memories deserve absolute confidentiality. {BRAND.name} is engineered so that no third party can read what you send.
          </p>
        </motion.div>

        {/* Editorial Quadrant */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-t border-b border-white/[0.06] max-w-4xl mx-auto text-left">
          {/* Trust 1: ECDH E2EE */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
            className="p-8 md:p-12 md:border-r md:border-b border-white/[0.06] border-b flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-zinc-400 mb-5">
                <KeyRound className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">Protocol · P-256</span>
              </div>
              <h3 className="font-serif text-2xl font-light text-[#fbf9f4]">
                Pairwise ECDH Encryption
              </h3>
              <p className="mt-3 text-xs text-zinc-400 font-sans leading-relaxed">
                Every message, voice letter, and memory is encrypted locally on your device before entering the network. Keys exist exclusively on your two devices.
              </p>
            </div>
            <div className="mt-8 pt-3 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Zero-Knowledge Ciphertext Routing
            </div>
          </motion.div>

          {/* Trust 2: Zero AI Training */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="p-8 md:p-12 md:border-b border-white/[0.06] border-b flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-zinc-400 mb-5">
                <ServerOff className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">Sovereignty · Zero AI</span>
              </div>
              <h3 className="font-serif text-2xl font-light text-[#fbf9f4]">
                Zero Cloud AI Ingestion
              </h3>
              <p className="mt-3 text-xs text-zinc-400 font-sans leading-relaxed">
                Your late-night messages, photos, and emotional moments are never ingested to train machine learning models. Your relationship belongs only to you.
              </p>
            </div>
            <div className="mt-8 pt-3 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Private Memory Vaults Are Off-Limits
            </div>
          </motion.div>

          {/* Trust 3: Zero Ad Trackers */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="p-8 md:p-12 md:border-r border-white/[0.06] border-b md:border-b-0 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-zinc-400 mb-5">
                <EyeOff className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">Sanctity · Zero Ads</span>
              </div>
              <h3 className="font-serif text-2xl font-light text-[#fbf9f4]">
                Zero Telemetry or Ad Profiling
              </h3>
              <p className="mt-3 text-xs text-zinc-400 font-sans leading-relaxed">
                No tracking pixels, no ad beacons, no third-party behavioral telemetry. We do not sell data to advertisers, because we don&apos;t collect it.
              </p>
            </div>
            <div className="mt-8 pt-3 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              No Ad Beacons · No Data Brokers
            </div>
          </motion.div>

          {/* Trust 4: Two-Device Boundary */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="p-8 md:p-12 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-zinc-400 mb-5">
                <Smartphone className="w-4 h-4" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">Topology · Pure Pair</span>
              </div>
              <h3 className="font-serif text-2xl font-light text-[#fbf9f4]">
                Strict Boundary of Two
              </h3>
              <p className="mt-3 text-xs text-zinc-400 font-sans leading-relaxed">
                You cannot accidentally add an acquaintance or forward to a group. The room is cryptographically bound to two authenticated partner tokens.
              </p>
            </div>
            <div className="mt-8 pt-3 border-t border-white/[0.04] text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Strict Mathematical Pairwise Lock
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
