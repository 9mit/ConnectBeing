"use client";

import { useState } from "react";
import {
  PenTool,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  DOODLE_PALETTE,
  DOODLE_STROKE_SIZES,
  type DoodleTool,
} from "./types";

interface DoodleToolbarProps {
  activeTool: DoodleTool;
  activeColor: string;
  activeWidth: number;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onSelectTool: (tool: DoodleTool) => void;
  onSelectColor: (color: string) => void;
  onSelectWidth: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearClick: () => void;
}

export function DoodleToolbar({
  activeTool,
  activeColor,
  activeWidth,
  canUndo,
  canRedo,
  saveStatus,
  onSelectTool,
  onSelectColor,
  onSelectWidth,
  onUndo,
  onRedo,
  onClearClick,
}: DoodleToolbarProps) {
  const [showPalette, setShowPalette] = useState(false);
  const [showSizes, setShowSizes] = useState(false);

  return (
    <div className="relative flex flex-col items-center gap-2 w-full max-w-2xl mx-auto z-20">
      {/* Floating Popovers: Palette or Sizes */}
      {showPalette && (
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-[#12141c]/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          {DOODLE_PALETTE.map((c) => {
            const isSelected = activeColor === c.hex;
            return (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  onSelectColor(c.hex);
                  setShowPalette(false);
                }}
                title={c.name}
                aria-label={`Color ${c.name}`}
                className="w-8 h-8 rounded-full transition-transform hover:scale-110 active:scale-95 flex items-center justify-center relative min-w-[32px] min-h-[32px]"
                style={{ backgroundColor: c.hex }}
              >
                {isSelected && (
                  <Check
                    className={`w-4 h-4 ${
                      c.hex === "#f7f6f2" ? "text-zinc-900" : "text-white"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {showSizes && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#12141c]/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          {DOODLE_STROKE_SIZES.map((s) => {
            const isSelected = activeWidth === s.width;
            return (
              <button
                key={s.width}
                type="button"
                onClick={() => {
                  onSelectWidth(s.width);
                  setShowSizes(false);
                }}
                title={s.label}
                aria-label={`Size ${s.label}`}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all min-h-[44px] min-w-[44px] justify-center ${
                  isSelected
                    ? "bg-white/[0.1] text-amber-200"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{
                    width: Math.min(22, Math.max(4, s.width)),
                    height: Math.min(22, Math.max(4, s.width)),
                  }}
                />
                <span className="text-[10px] font-medium">{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Ergonomic Toolbar Pill */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 px-3 py-2 rounded-full bg-[#10121a]/90 backdrop-blur-2xl border border-white/[0.1] shadow-2xl w-full">
        {/* Tool Selector */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-full border border-white/[0.06]">
          <button
            type="button"
            onClick={() => {
              onSelectTool("pen");
              setShowPalette(false);
              setShowSizes(false);
            }}
            title="Pen"
            aria-label="Pen tool"
            className={`p-2.5 rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
              activeTool === "pen"
                ? "bg-amber-400/20 text-amber-200 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
            }`}
          >
            <PenTool className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTool("highlighter");
              setShowPalette(false);
              setShowSizes(false);
            }}
            title="Highlighter"
            aria-label="Highlighter tool"
            className={`p-2.5 rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
              activeTool === "highlighter"
                ? "bg-amber-400/20 text-amber-200 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
            }`}
          >
            <Highlighter className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTool("eraser");
              setShowPalette(false);
              setShowSizes(false);
            }}
            title="Eraser"
            aria-label="Eraser tool"
            className={`p-2.5 rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
              activeTool === "eraser"
                ? "bg-amber-400/20 text-amber-200 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
            }`}
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Color & Size Toggles */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Color preview trigger */}
          <button
            type="button"
            onClick={() => {
              setShowPalette((v) => !v);
              setShowSizes(false);
            }}
            title="Choose Color"
            aria-label="Choose color"
            className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all min-h-[44px] min-w-[44px] justify-center"
          >
            <div
              className="w-5 h-5 rounded-full shadow-inner border border-white/20"
              style={{ backgroundColor: activeColor }}
            />
            <span className="text-[11px] text-zinc-300 font-medium hidden sm:inline">
              Color
            </span>
          </button>

          {/* Stroke size trigger */}
          <button
            type="button"
            onClick={() => {
              setShowSizes((v) => !v);
              setShowPalette(false);
            }}
            title="Stroke Size"
            aria-label="Stroke size"
            className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all min-h-[44px] min-w-[44px] justify-center text-zinc-300"
          >
            <div
              className="rounded-full bg-current"
              style={{
                width: Math.min(16, Math.max(4, activeWidth)),
                height: Math.min(16, Math.max(4, activeWidth)),
              }}
            />
            <span className="text-[11px] font-medium hidden sm:inline">
              Size
            </span>
          </button>
        </div>

        {/* Undo, Redo, Clear & Status */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="p-2 sm:p-2.5 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:pointer-events-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            className="p-2 sm:p-2.5 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:pointer-events-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClearClick}
            title="Clear Canvas"
            aria-label="Clear canvas"
            className="p-2 sm:p-2.5 rounded-full text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Cloud save indicator */}
          <div className="pl-1 sm:pl-2 border-l border-white/[0.08] hidden sm:flex items-center text-zinc-500" title={`Canvas save status: ${saveStatus}`}>
            {saveStatus === "saving" && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300/80" />
            )}
            {saveStatus === "saved" && (
              <span className="text-[10px] text-emerald-400 font-medium">Saved</span>
            )}
            {saveStatus === "error" && (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            )}
            {saveStatus === "idle" && (
              <span className="text-[10px] text-zinc-500">Synced</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
