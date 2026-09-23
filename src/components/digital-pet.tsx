"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useTransition } from "react";
import { Heart, Sparkles, Edit2, Check } from "lucide-react";

import { getPetStateAction, renamePetAction } from "@/actions/pet";

const animations: Record<string, { y: number[]; scale: number[] }> = {
  thriving: { y: [0, -8, 0], scale: [1, 1.05, 1] },
  happy: { y: [0, -5, 0], scale: [1, 1.03, 1] },
  neutral: { y: [0, -2, 0], scale: [1, 1.01, 1] },
  sad: { y: [0, 3, 0], scale: [1, 0.98, 1] },
  neglected: { y: [0, 5, 0], scale: [1, 0.95, 1] },
};

const petFaces: Record<string, string> = {
  thriving: "((っ˵•́▽•̀˵)っ♥",
  happy: "(✿◠‿◠)",
  neutral: "◉‿◉",
  sad: "(っ- ﹏ - c)",
  neglected: "(｡•́︿•̀｡)",
};

function getVitalityLabel(score: number): string {
  if (score >= 80) return "Flourishing Harmony";
  if (score >= 50) return "Warm Connection";
  if (score >= 25) return "Quiet Rhythm";
  return "Needs Shared Time";
}

export function DigitalPet({
  initialPet,
}: {
  initialPet?: { petName: string; petState: string; score: number; moodNote: string };
}) {
  const [petName, setPetName] = useState(initialPet?.petName ?? "Buddy");
  const [petState, setPetState] = useState(initialPet?.petState ?? "neutral");
  const [score, setScore] = useState(initialPet?.score ?? 0);
  const [nameInput, setNameInput] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [moodNote, setMoodNote] = useState(initialPet?.moodNote ?? "");
  const [petInteracted, setPetInteracted] = useState(false);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const result = await getPetStateAction();
    if (result.ok) {
      setPetName(result.data.petName);
      setPetState(result.data.petState);
      setScore(result.data.score);
      setMoodNote(result.data.moodNote);
    }
  }

  useEffect(() => {
    if (!initialPet) {
      void refresh();
    }
    const id = setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [initialPet]);

  const anim = animations[petState] ?? animations.neutral;
  const face = petFaces[petState] ?? petFaces.neutral;

  function handlePetInteraction() {
    setPetInteracted(true);
    setTimeout(() => setPetInteracted(false), 2400);
  }

  return (
    <div className="space-y-10 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center space-y-1">
        <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-zinc-400">
          Shared Companion
        </span>
        <h1 className="text-3xl font-serif font-light text-[#f7f6f2] tracking-tight">
          Our Little World
        </h1>
        <p className="text-xs text-zinc-400">
          A living expression of your couple vitality and shared rituals.
        </p>
      </div>

      {/* Main Living Companion Habitat */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0c0d12] p-8 sm:p-10 text-center relative overflow-hidden shadow-2xl space-y-6">
        {/* Soft Ambient Light (restrained, no neon glow) */}
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 bg-amber-200/10 pointer-events-none"
          aria-hidden
        />

        {/* Pet Creature Sphere */}
        <div className="relative inline-block">
          <motion.div
            animate={{
              y: petInteracted ? [0, -16, 0] : anim.y,
              scale: petInteracted ? [1, 1.15, 1] : anim.scale,
            }}
            transition={{
              repeat: petInteracted ? 1 : Infinity,
              duration: petInteracted ? 0.6 : 3,
              ease: "easeInOut",
            }}
            onClick={handlePetInteraction}
            className="cursor-pointer flex h-40 w-40 sm:h-44 sm:w-44 items-center justify-center rounded-full bg-[#141620] border border-white/10 shadow-lg relative mx-auto group hover:border-white/25 transition-all touch-manipulation select-none active:scale-95"
            title="Tap to comfort Buddy"
          >
            <span className="text-2xl font-serif font-medium text-amber-100 select-none drop-shadow-sm transition-transform group-hover:scale-105">
              {face}
            </span>

            {petInteracted && (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: -24 }}
                exit={{ opacity: 0 }}
                className="absolute text-xl pointer-events-none select-none"
              >
                ❤️
              </motion.span>
            )}
          </motion.div>
        </div>

        {/* Pet Name & Rename */}
        <div className="space-y-1 relative z-10">
          {isEditingName ? (
            <form
              className="flex items-center justify-center gap-2 max-w-xs mx-auto"
              onSubmit={(e) => {
                e.preventDefault();
                if (!nameInput.trim()) return;
                startTransition(async () => {
                  const result = await renamePetAction({ petName: nameInput });
                  if (result.ok) {
                    setPetName(result.data.petName);
                    setIsEditingName(false);
                    setNameInput("");
                  }
                });
              }}
            >
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="New name…"
                className="rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-base sm:text-xs text-[#f7f6f2] outline-none focus:border-white/30 text-center"
              />
              <button
                type="submit"
                disabled={pending}
                className="p-2.5 min-h-[38px] min-w-[38px] rounded-full bg-[#f7f6f2] text-[#07080b] hover:bg-white flex items-center justify-center touch-manipulation"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-2xl font-serif font-light text-[#f7f6f2]">
                {petName}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setNameInput(petName);
                  setIsEditingName(true);
                }}
                className="text-zinc-500 hover:text-zinc-300 p-1.5 touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label="Rename companion"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
            <span className="capitalize font-medium text-zinc-300">{petState}</span>
            <span>·</span>
            <span className="text-zinc-400">{getVitalityLabel(score)}</span>
          </div>
        </div>

        {/* Contextual thought or mood reflection */}
        <div className="max-w-xs mx-auto text-xs text-zinc-400 font-light leading-relaxed italic bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
          {moodNote ? `“${moodNote}”` : `“${petName} feels peaceful and grounded in your private sanctuary.”`}
        </div>

        {/* Soft Organic Connection Vitality (Not a cold numerical SaaS metric) */}
        <div className="space-y-2 pt-2 max-w-xs mx-auto text-left">
          <div className="flex justify-between items-center text-[11px] text-zinc-400">
            <span>Connection Vitality</span>
            <span className="font-mono text-zinc-300">{score}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.06]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-amber-200/90 to-rose-200/90"
            />
          </div>
        </div>

        {/* Quick Comfort Touch Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handlePetInteraction}
            className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-full border border-white/[0.08] bg-white/[0.03] text-xs sm:text-sm font-medium text-zinc-200 hover:text-white hover:bg-white/[0.06] transition-all touch-manipulation active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Comfort {petName}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
