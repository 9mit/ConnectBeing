export const ROOM_THEMES = [
  "rose-dusk",
  "midnight-violet",
  "imperial-gold",
  "celestial-sky",
  "violet-night",
  "amber-glow",
  "sky-dawn",
] as const;

export type RoomTheme = (typeof ROOM_THEMES)[number];
