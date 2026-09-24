import { BRAND } from "@/lib/brand";

/** Brand + product copy — connected to centralized BRAND system. */
export const SITE = {
  brand: BRAND.name,
  brandMark: BRAND.mark,
  tagline: "Some people become your universe",
  privacyLine: "Private space · end-to-end encrypted",
  defaultPetName: "Buddy",
  parentCompany: {
    name: "Ninegalaxies",
    tagline: "A Product by Ninegalaxies",
    logo: "/images/ninegalaxies.png",
    description:
      "Crafting intentional digital universes, sacred connection spaces, and high-craft software experiences.",
  },
  sisterProduct: {
    name: "CodeSamjho",
    url: "https://codesamjho.online/",
    badge: "Sister Product",
    tagline: "Interactive Code Execution & Algorithm Visualizer",
    description:
      "Step through complex algorithms line-by-line across Python, Java, C++, and JavaScript with real-time memory and call stack visualization.",
  },
} as const;

export const LANDING_HERO = {
  line1: "Some people change your life.",
  line2: "Some become your universe.",
  support:
    "A private space for two — chat, memories, moods, and a shared world that stays between you.",
  cta: "Begin Our Story",
  signIn: "Already together? Sign in",
  scrollHint: "Scroll to enter the universe",
} as const;

export const LANDING_FEATURES = [
  {
    id: "chat",
    title: "Secret chat",
    description:
      "End-to-end encrypted messages that stay between you two — no ads, no feed, no audience.",
    accent: "text-rose-300",
    icon: "lock" as const,
  },
  {
    id: "mood",
    title: "Mood & distance",
    description:
      "Share how you feel and how far you are in real time, so the quiet distance feels smaller.",
    accent: "text-violet-300",
    icon: "map" as const,
  },
  {
    id: "memories",
    title: "Memory vault",
    description:
      "Photos, milestones, and capsules that open only when you both decide the moment is right.",
    accent: "text-amber-300",
    icon: "camera" as const,
  },
  {
    id: "pet",
    title: "Shared spirit",
    description:
      "Raise a digital pet together — a living reminder that you are building something as a pair.",
    accent: "text-pink-300",
    icon: "pet" as const,
  },
  {
    id: "together",
    title: "Together room",
    description:
      "Watch, call, and play in a room that syncs — presence without performing for anyone else.",
    accent: "text-cyan-300",
    icon: "radio" as const,
  },
] as const;

export const LANDING_CHAPTERS = {
  distance: {
    aria: "The distance between two hearts",
    words: ["Love", "isn't", "found.", "It's", "built."] as const,
  },
  memories: {
    aria: "Shared memories",
    lines: [
      "Fragments float.",
      "Letters. Light. The sound of a voice.",
      "Everything you keep.",
    ] as const,
  },
  sync: {
    aria: "Invisible connection",
    lines: ["When one moves…", "the other already knows."] as const,
  },
  intelligence: {
    aria: "Quiet intelligence",
    lines: [
      "Intelligence without a face.",
      "A constellation that learns your story.",
    ] as const,
  },
  spirit: {
    aria: "A living spirit",
    lines: [
      "Something small wakes between you.",
      "It breathes when you do.",
    ] as const,
  },
  cta: {
    aria: "Begin your story",
    line1: "You found your person.",
    line2Prefix: "Now build your",
    line2Em: "universe",
  },
  footer: {
    whisper: "Two lights. One sky.",
  },
} as const;

/** In-app quick links — labels hardcoded; stats injected at runtime. */
export const DASHBOARD_LINKS = [
  {
    href: "/chat",
    icon: "💬",
    title: "Secret Chat",
    desc: "Private messaging and view-once photos.",
    action: "Open",
    kind: "static" as const,
  },
  {
    href: "/mood",
    icon: "🎭",
    title: "Vibe Sync",
    desc: "Log your emotional state in real time.",
    action: "Update",
    kind: "mood" as const,
  },
  {
    href: "/pet",
    icon: "🐹",
    title: "Pet",
    desc: "Nurture your shared virtual pet.",
    action: "Play",
    kind: "pet" as const,
  },
  {
    href: "/challenges",
    icon: "🏆",
    title: "Challenges",
    desc: "Complete relationship milestones.",
    action: "Explore",
    kind: "static" as const,
  },
] as const;
