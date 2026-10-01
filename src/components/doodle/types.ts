export type DoodleTool = "pen" | "highlighter" | "eraser";

export interface DoodlePoint {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
}

export interface DoodleStroke {
  id: string;
  userId: string;
  tool: DoodleTool;
  color: string;
  width: number;
  points: DoodlePoint[];
  createdAt?: number;
}

export interface DoodlePresenceState {
  partnerPresent: boolean;
  partnerDrawing: boolean;
  partnerCursor: DoodlePoint | null;
}

export const DOODLE_PALETTE = [
  { name: "Cream", hex: "#f7f6f2" },
  { name: "Amber", hex: "#fbbf24" },
  { name: "Rose", hex: "#fb7185" },
  { name: "Sky", hex: "#38bdf8" },
  { name: "Emerald", hex: "#34d399" },
  { name: "Lilac", hex: "#a78bfa" },
  { name: "Coral", hex: "#f97316" },
] as const;

export const DOODLE_STROKE_SIZES = [
  { label: "Fine", width: 3 },
  { label: "Medium", width: 6 },
  { label: "Bold", width: 12 },
  { label: "Broad", width: 24 },
] as const;
