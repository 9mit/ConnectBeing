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
        sanctuary: {
          950: "#07080b",
          900: "#0f1015",
          850: "#161820",
          800: "#1e202b",
          700: "#272a38",
          600: "#3d4255",
          400: "#8a8f9f",
          200: "#dcd8ce",
          100: "#f7f6f2",
        },
        royal: {
          950: "#07080b",
          900: "#0f1015",
          800: "#161820",
          700: "#1e202b",
          600: "#272a38",
          500: "#363a4c",
          glow: "transparent",
        },
        gold: {
          100: "#fcfbf7",
          200: "#f5f1e8",
          300: "#ebdcc4",
          400: "#e6c594",
          500: "#d4a76a",
          600: "#b5874c",
          700: "#8c6433",
          800: "#634421",
          glow: "transparent",
        },
        obsidian: {
          950: "#07080b",
          900: "#0f1015",
          800: "#161820",
        },
        roseGlow: "#f4aab9",
        purpleGlow: "#c084fc",
        skyGlow: "#7dd3fc",
        amberWarm: "#fbbf24",
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

