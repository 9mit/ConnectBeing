"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useTransition } from "react";

import { getPetStateAction, renamePetAction } from "@/actions/pet";

const animations: Record<string, { y: number[]; scale: number[] }> = {
  thriving: { y: [0, -10, 0], scale: [1, 1.08, 1] },
  happy: { y: [0, -6, 0], scale: [1, 1.04, 1] },
  neutral: { y: [0, -2, 0], scale: [1, 1.01, 1] },
  sad: { y: [0, 4, 0], scale: [1, 0.96, 1] },
  neglected: { y: [0, 8, 0], scale: [1, 0.9, 1] },
};

const petFaces: Record<string, string> = {
  thriving: "((っ˵•́▽•̀˵)っ♥",
  happy: "(✿◠‿◠)",
  neutral: "◉‿◉",
  sad: "(っ- ﹏ - c)",
  neglected: "(｡•́︿•̀｡)",
};

export function DigitalPet() {
  const [petName, setPetName] = useState("Buddy");
  const [petState, setPetState] = useState("neutral");
  const [score, setScore] = useState(0);
  const [nameInput, setNameInput] = useState("");
  const [moodNote, setMoodNote] = useState("");
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
    void refresh();
    const id = setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const anim = animations[petState] ?? animations.neutral;
  const face = petFaces[petState] ?? petFaces.neutral;

  // Dynamic glow and gradient borders depending on petState
  const getAvatarGradient = () => {
    if (petState === "thriving") return "from-amber-400/40 via-amber-500/30 to-purple-600/40 border-amber-400 shadow-[0_0_25px_rgba(212,175,55,0.4)]";
    if (petState === "happy") return "from-amber-500/30 to-purple-800/40 border-amber-500/40 shadow-[0_0_15px_rgba(212,175,55,0.2)]";
    if (petState === "sad") return "from-purple-900/30 to-slate-900/30 border-purple-800/30 shadow-purple-950/10";
    if (petState === "neglected") return "from-zinc-900 to-purple-950 border-zinc-800 shadow-zinc-950";
    return "from-purple-950/40 to-slate-900/40 border-purple-800/30 shadow-purple-900/10";
  };

  return (
    <div className="space-y-8 max-w-md mx-auto">
      <div className="flex flex-col items-center rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-8 text-center relative overflow-hidden shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        {/* Glow overlay */}
        <div className={`absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-30 bg-gradient-to-br ${
          petState === "thriving" || petState === "happy" ? "from-amber-400 to-purple-600" : "from-purple-900 to-blue-900"
        }`} />

        <motion.div
          animate={{ y: anim.y, scale: anim.scale }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className={`flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br border shadow-xl ${getAvatarGradient()} z-10`}
        >
          <span className="text-xl font-bold tracking-tight text-amber-200 font-display select-none filter drop-shadow-md text-glow-gold">
            {face}
          </span>
        </motion.div>

        <motion.h2
          key={petState}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="mt-6 text-3xl font-extrabold text-white font-display tracking-tight z-10 text-glow-gold"
        >
          {petName}
        </motion.h2>

        <span className="mt-1 text-xs font-bold uppercase tracking-widest text-amber-400/80 z-10">
          State: <span className="text-amber-300 capitalize font-bold">{petState}</span>
        </span>

        {moodNote ? (
          <p className="mt-3.5 text-sm text-slate-300 max-w-xs z-10 italic">
            &ldquo;{moodNote}&rdquo;
          </p>
        ) : null}

        {/* Health/Score Progress Bar */}
        <div className="w-full mt-8 space-y-2 z-10">
          <div className="flex justify-between text-xs font-semibold tracking-wider uppercase text-amber-400/80">
            <span>Engagement Score</span>
            <span className="text-amber-300 font-bold">{score}/100</span>
          </div>
          <div className="h-2.5 w-full bg-purple-950/60 rounded-full overflow-hidden border border-amber-500/20">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${
                score > 75 
                  ? "from-amber-400 via-amber-500 to-amber-600 shadow-[0_0_10px_#fbbf24]" 
                  : score > 40 
                  ? "from-purple-500 to-amber-500" 
                  : "from-purple-800 to-purple-900"
              }`}
            />
          </div>
        </div>
      </div>

      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await renamePetAction({ petName: nameInput });
            if (result.ok) {
              setPetName(result.data.petName);
              setNameInput("");
            }
          });
        }}
      >
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Enter new name..."
          className="flex-1 rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
        />
        <button
          type="submit"
          disabled={pending || !nameInput.trim()}
          className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-5 py-3 text-sm font-extrabold text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)]"
        >
          Rename
        </button>
      </form>
    </div>
  );
}
