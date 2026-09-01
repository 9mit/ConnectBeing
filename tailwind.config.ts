import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        royal: {
          950: "#07020f",
          900: "#0f051c",
          800: "#18092c",
          700: "#270f44",
          600: "#3d186a",
          500: "#5c24a0",
          glow: "#9333ea",
        },
        gold: {
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d4af37",
          700: "#b45309",
          800: "#92400e",
          glow: "rgba(212, 175, 55, 0.4)",
        },
        obsidian: {
          950: "#07020f",
          900: "#0f051c",
          800: "#18092c",
        },
        roseGlow: "#f43f5e",
        purpleGlow: "#a855f7",
        skyGlow: "#38bdf8",
        amberWarm: "#f59e0b",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "serif"],
        serif: ["var(--font-landing-display)", "serif"],
      },
      animation: {
        "ambient-pulse": "ambientPulse 6s ease-in-out infinite alternate",
        "float-slow": "floatSlow 4s ease-in-out infinite",
        "glow-border": "glowBorder 3s infinite alternate",
        "gold-shimmer": "goldShimmer 3s ease-in-out infinite alternate",
        "particle-rise": "particleRise 2s ease-out forwards",
      },
      keyframes: {
        ambientPulse: {
          "0%": { opacity: "0.2", transform: "scale(1)" },
          "100%": { opacity: "0.45", transform: "scale(1.08)" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        glowBorder: {
          "0%": { borderColor: "rgba(212, 175, 55, 0.2)", boxShadow: "0 0 15px -5px rgba(212, 175, 55, 0.2)" },
          "100%": { borderColor: "rgba(212, 175, 55, 0.5)", boxShadow: "0 0 25px 0px rgba(212, 175, 55, 0.4)" },
        },
        goldShimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
        particleRise: {
          "0%": { opacity: "1", transform: "translateY(0px) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(-60px) scale(1.4)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

