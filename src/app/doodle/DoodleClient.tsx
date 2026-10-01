"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { clearDoodleCanvasAction } from "@/actions/doodle";
import { DoodleCanvas, exportDoodleCanvasPng } from "@/components/doodle/DoodleCanvas";
import { DoodleToolbar } from "@/components/doodle/DoodleToolbar";
import { DoodleHeader } from "@/components/doodle/DoodleHeader";
import { useDoodleRealtime } from "@/components/doodle/useDoodleRealtime";
import type { DoodleStroke, DoodleTool } from "@/components/doodle/types";

interface DoodleClientProps {
  coupleId: string;
  userId: string;
  initialStrokes: DoodleStroke[];
  partnerName?: string;
}

export function DoodleClient({
  coupleId,
  userId,
  initialStrokes,
  partnerName,
}: DoodleClientProps) {
  const [strokes, setStrokes] = useState<DoodleStroke[]>(initialStrokes);
  const [redoStack, setRedoStack] = useState<DoodleStroke[]>([]);
  const [activeTool, setActiveTool] = useState<DoodleTool>("pen");
  const [activeColor, setActiveColor] = useState<string>("#f7f6f2");
  const [activeWidth, setActiveWidth] = useState<number>(6);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  const strokesRef = useRef<DoodleStroke[]>(strokes);
  strokesRef.current = strokes;

  const redoStackRef = useRef<DoodleStroke[]>(redoStack);
  redoStackRef.current = redoStack;

  // Realtime hook callbacks
  const handlePartnerStroke = useCallback((stroke: DoodleStroke) => {
    setStrokes((prev) => {
      const next = [...prev, stroke];
      strokesRef.current = next;
      return next;
    });
  }, []);

  const handlePartnerUndo = useCallback((strokeId: string) => {
    setStrokes((prev) => {
      const next = prev.filter((s) => s.id !== strokeId);
      strokesRef.current = next;
      return next;
    });
  }, []);

  const handlePartnerClear = useCallback(() => {
    strokesRef.current = [];
    setStrokes([]);
    setRedoStack([]);
  }, []);

  const {
    partnerPresent,
    partnerDrawing,
    partnerCursor,
    saveStatus,
    broadcastStroke,
    broadcastDrawingStart,
    broadcastDrawingStop,
    broadcastCursor,
    broadcastUndo,
    broadcastClear,
    queueSave,
  } = useDoodleRealtime({
    coupleId,
    userId,
    getCurrentStrokes: () => strokesRef.current,
    onPartnerStroke: handlePartnerStroke,
    onPartnerUndo: handlePartnerUndo,
    onPartnerClear: handlePartnerClear,
  });

  // Local stroke completed by current user
  const handleStrokeComplete = useCallback(
    (stroke: DoodleStroke) => {
      const updated = [...strokesRef.current, stroke];
      strokesRef.current = updated;
      setStrokes(updated);
      setRedoStack([]); // New drawing action resets local redo stack
      broadcastStroke(stroke);
      queueSave();
    },
    [broadcastStroke, queueSave],
  );

  // Intelligent Undo: undoes the current user's most recent stroke
  const handleUndo = useCallback(() => {
    const current = strokesRef.current;
    // Find last stroke drawn by this user
    let targetIdx = -1;
    for (let i = current.length - 1; i >= 0; i--) {
      if (current[i].userId === userId) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx === -1) return;

    const targetStroke = current[targetIdx];
    const updated = current.filter((_, idx) => idx !== targetIdx);
    strokesRef.current = updated;

    setStrokes(updated);
    setRedoStack((prev) => [...prev, targetStroke]);
    broadcastUndo(targetStroke.id);
    queueSave();
  }, [userId, broadcastUndo, queueSave]);

  // Redo: restores the most recently undone stroke by this user
  const handleRedo = useCallback(() => {
    const currentRedo = redoStackRef.current;
    if (currentRedo.length === 0) return;

    const strokeToRestore = currentRedo[currentRedo.length - 1];
    const updated = [...strokesRef.current, strokeToRestore];
    strokesRef.current = updated;

    setStrokes(updated);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    broadcastStroke(strokeToRestore);
    queueSave();
  }, [broadcastStroke, queueSave]);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Cmd+Z, Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (
        (modKey && e.shiftKey && e.key.toLowerCase() === "z") ||
        (modKey && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Clear Canvas Confirmation
  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      await clearDoodleCanvasAction({ confirmed: true });
      strokesRef.current = [];
      setStrokes([]);
      setRedoStack([]);
      broadcastClear();
      setShowClearModal(false);
    } finally {
      setIsClearing(false);
    }
  };

  // Export canvas as PNG
  const handleDownload = () => {
    exportDoodleCanvasPng(strokesRef.current);
  };


  const userCanUndo = strokes.some((s) => s.userId === userId);
  const userCanRedo = redoStack.length > 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] sm:h-[calc(100dvh-7rem)] max-w-5xl mx-auto w-full gap-2 sm:gap-3 relative">
      {/* Editorial Header */}
      <DoodleHeader
        partnerPresent={partnerPresent}
        partnerDrawing={partnerDrawing}
        partnerName={partnerName}
        onDownloadClick={strokes.length > 0 ? handleDownload : undefined}
      />

      {/* Hero Canvas Area */}
      <div className="flex-1 w-full min-h-0 relative flex flex-col">
        <DoodleCanvas
          userId={userId}
          strokes={strokes}
          activeTool={activeTool}
          activeColor={activeColor}
          activeWidth={activeWidth}
          partnerDrawing={partnerDrawing}
          partnerCursor={partnerCursor}
          onStrokeComplete={handleStrokeComplete}
          onDrawingStart={broadcastDrawingStart}
          onDrawingStop={broadcastDrawingStop}
          onCursorMove={broadcastCursor}
        />
      </div>

      {/* Floating Ergonomic Toolbar */}
      <div className="pt-1 pb-1 sm:pb-2">
        <DoodleToolbar
          activeTool={activeTool}
          activeColor={activeColor}
          activeWidth={activeWidth}
          canUndo={userCanUndo}
          canRedo={userCanRedo}
          saveStatus={saveStatus}
          onSelectTool={setActiveTool}
          onSelectColor={setActiveColor}
          onSelectWidth={setActiveWidth}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClearClick={() => setShowClearModal(true)}
        />
      </div>

      {/* Clear Confirmation Modal */}
      <AnimatePresence>
        {showClearModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-[#12141d] border border-white/[0.1] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-300">
                  <Trash2 className="w-5 h-5" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  disabled={isClearing}
                  className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-base font-serif font-light text-[#f7f6f2]">
                  Clear our doodles?
                </h3>
                <p className="text-xs text-zinc-400 font-light mt-1.5 leading-relaxed">
                  This will clear the sketchbook for both of you. You can always start fresh with a new drawing.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  disabled={isClearing}
                  className="px-4 py-2.5 rounded-full border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  disabled={isClearing}
                  className="px-5 py-2.5 rounded-full bg-rose-500/90 text-white text-xs font-medium hover:bg-rose-500 transition-colors disabled:opacity-50 min-h-[44px] flex items-center gap-1.5"
                >
                  {isClearing ? "Clearing…" : "Clear Canvas"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
