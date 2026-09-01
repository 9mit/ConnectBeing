"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Play, Pause, Music } from "lucide-react";

/**
 * High-Fidelity Audio Soundtrack Controller.
 * Plays Sunlight_Through_Stained_Glass.mp3 with smooth volume fades,
 * real-time frequency animations, and a floating luxury controller.
 */
export function AudioController() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hint, setHint] = useState(true);
  const [volume, setVolume] = useState(0.7);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const initAudio = () => {
    if (audioRef.current) return;

    const audio = new Audio("/Sunlight_Through_Stained_Glass.mp3");
    audio.loop = true;
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (AudioContextClass) {
      try {
        const ctx = new AudioContextClass();
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();

        gain.gain.setValueAtTime(0, ctx.currentTime);
        source.connect(gain);
        gain.connect(ctx.destination);

        audioCtxRef.current = ctx;
        gainNodeRef.current = gain;
        sourceNodeRef.current = source;
      } catch {
        // Fallback to direct element volume if Web Audio fails
        audio.volume = volume;
      }
    }
  };

  const playSound = async () => {
    initAudio();
    const audio = audioRef.current;
    const ctx = audioCtxRef.current;
    const gain = gainNodeRef.current;

    if (!audio) return;

    try {
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
      }

      await audio.play();
      setIsPlaying(true);

      if (ctx && gain) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.8);
      } else {
        audio.volume = volume;
      }
    } catch (err) {
      console.warn("Audio playback gesture required or failed:", err);
      setIsPlaying(false);
    }
  };

  const pauseSound = () => {
    const audio = audioRef.current;
    const ctx = audioCtxRef.current;
    const gain = gainNodeRef.current;

    if (!audio) return;

    if (ctx && gain) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      window.setTimeout(() => {
        audio.pause();
        setIsPlaying(false);
      }, 850);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    setHint(false);
    if (isPlaying) {
      pauseSound();
    } else {
      void playSound();
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 8000);
    return () => {
      window.clearTimeout(t);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
      }
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5">
      {/* Interactive Hint Notification */}
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#0c081a]/85 px-4 py-2 text-xs font-sans tracking-wide text-amber-200 backdrop-blur-xl shadow-[0_4px_25px_rgba(212,175,55,0.2)]"
          >
            <Music className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Soundtrack: Sunlight Through Stained Glass</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Sound Capsule Button */}
      <motion.div
        className="flex items-center gap-2 p-1.5 rounded-full border border-amber-500/30 bg-[#0f051c]/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:border-amber-500/60 transition-all group"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        {/* Track Info Badge (Expands on Hover or Playing) */}
        <div
          onClick={togglePlay}
          className="cursor-pointer flex items-center gap-2.5 pl-3 pr-2 py-1 select-none"
          title={isPlaying ? "Pause soundtrack" : "Play Sunlight Through Stained Glass"}
        >
          {/* Animated Equalizer Waveform */}
          <div className="flex items-end gap-0.5 h-3.5 w-4" aria-hidden>
            {[0.4, 0.8, 0.6, 1.0, 0.5].map((scale, i) => (
              <motion.span
                key={i}
                className="w-0.5 bg-gradient-to-t from-amber-400 to-amber-200 rounded-full"
                animate={
                  isPlaying
                    ? {
                        height: ["20%", `${scale * 100}%`, "30%"],
                      }
                    : { height: "20%" }
                }
                transition={
                  isPlaying
                    ? {
                        duration: 0.6 + i * 0.15,
                        repeat: Infinity,
                        repeatType: "reverse",
                        ease: "easeInOut",
                      }
                    : { duration: 0.2 }
                }
              />
            ))}
          </div>

          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 font-sans leading-tight">
              {isPlaying ? "Now Playing" : "Soundtrack"}
            </span>
            <span className="text-[11px] text-slate-200 font-serif italic truncate max-w-[130px] sm:max-w-[180px]">
              Sunlight Through Stained Glass
            </span>
          </div>
        </div>

        {/* Play / Pause Toggle Circle Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-purple-950 shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-95 transition-all"
          aria-pressed={isPlaying}
          aria-label={
            isPlaying
              ? "Pause Sunlight Through Stained Glass"
              : "Play Sunlight Through Stained Glass"
          }
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-purple-950" />
          ) : (
            <Play className="w-4 h-4 fill-purple-950 ml-0.5" />
          )}
        </button>
      </motion.div>
    </div>
  );
}
