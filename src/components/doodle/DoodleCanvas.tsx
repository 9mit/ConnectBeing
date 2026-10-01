"use client";

import { useEffect, useRef, useCallback } from "react";
import { Sparkles, Heart } from "lucide-react";
import { createId } from "@/lib/ids";
import type { DoodlePoint, DoodleStroke, DoodleTool } from "./types";

interface DoodleCanvasProps {
  userId: string;
  strokes: DoodleStroke[];
  activeTool: DoodleTool;
  activeColor: string;
  activeWidth: number;
  partnerDrawing: boolean;
  partnerCursor: DoodlePoint | null;
  onStrokeComplete: (stroke: DoodleStroke) => void;
  onDrawingStart: () => void;
  onDrawingStop: () => void;
  onCursorMove: (point: DoodlePoint) => void;
}

export function DoodleCanvas({
  userId,
  strokes,
  activeTool,
  activeColor,
  activeWidth,
  partnerDrawing,
  partnerCursor,
  onStrokeComplete,
  onDrawingStart,
  onDrawingStop,
  onCursorMove,
}: DoodleCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<DoodleStroke | null>(null);
  const lastCursorBroadcastRef = useRef<number>(0);
  const sizeRef = useRef<{ width: number; height: number; dpr: number }>({
    width: 800,
    height: 600,
    dpr: 1,
  });

  // Scale stroke width relative to canvas dimensions (reference dimension 800px)
  const getScaledWidth = useCallback((strokeWidth: number, tool: DoodleTool, canvasMin: number) => {
    const scale = Math.max(0.6, canvasMin / 800);
    let base = strokeWidth * scale;
    if (tool === "highlighter") base *= 2.4;
    if (tool === "eraser") base *= 2.6;
    return Math.max(2, base);
  }, []);

  // Render a single stroke onto a Canvas 2D context
  const renderStroke = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      stroke: DoodleStroke,
      width: number,
      height: number,
      isOverlay = false,
    ) => {
      const points = stroke.points;
      if (!points || points.length === 0) return;

      const canvasMin = Math.min(width, height);
      const scaledWidth = getScaledWidth(stroke.width, stroke.tool, canvasMin);

      ctx.save();
      ctx.lineWidth = scaledWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.tool === "eraser") {
        if (isOverlay) {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
          ctx.globalAlpha = 0.8;
        } else {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0, 0, 0, 1)";
          ctx.globalAlpha = 1.0;
        }
      } else if (stroke.tool === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 0.38;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 1.0;
      }

      if (points.length === 1) {
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(
          points[0].x * width,
          points[0].y * height,
          scaledWidth / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(points[0].x * width, points[0].y * height);

      if (points.length === 2) {
        ctx.lineTo(points[1].x * width, points[1].y * height);
      } else {
        // Smooth quadratic Bezier curves through points
        for (let i = 1; i < points.length - 1; i++) {
          const xc = ((points[i].x + points[i + 1].x) / 2) * width;
          const yc = ((points[i].y + points[i + 1].y) / 2) * height;
          ctx.quadraticCurveTo(
            points[i].x * width,
            points[i].y * height,
            xc,
            yc,
          );
        }
        ctx.lineTo(
          points[points.length - 1].x * width,
          points[points.length - 1].y * height,
        );
      }

      ctx.stroke();
      ctx.restore();
    },
    [getScaledWidth],
  );

  // Redraw all completed strokes onto the base canvas using clean compositing
  const redrawBaseCanvas = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    ctx.clearRect(0, 0, width, height);

    // Draw all committed strokes in sequential order
    for (const stroke of strokes) {
      renderStroke(ctx, stroke, width, height, false);
    }
  }, [strokes, renderStroke]);

  // Redraw active stroke and partner cursor onto overlay canvas
  const redrawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    ctx.clearRect(0, 0, width, height);

    // Render active local stroke
    if (currentStrokeRef.current) {
      renderStroke(ctx, currentStrokeRef.current, width, height, true);

      // If active tool is eraser, draw a brush cursor ring around current pointer tip
      if (currentStrokeRef.current.tool === "eraser") {
        const pts = currentStrokeRef.current.points;
        const lastPt = pts[pts.length - 1];
        if (lastPt) {
          const scaledWidth = getScaledWidth(currentStrokeRef.current.width, "eraser", Math.min(width, height));
          ctx.save();
          ctx.beginPath();
          ctx.arc(lastPt.x * width, lastPt.y * height, scaledWidth / 2, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Render partner cursor indicator
    if (partnerCursor) {
      const px = partnerCursor.x * width;
      const py = partnerCursor.y * height;

      ctx.save();
      // Outer pulse ring
      ctx.beginPath();
      ctx.arc(px, py, partnerDrawing ? 14 : 9, 0, Math.PI * 2);
      ctx.fillStyle = partnerDrawing
        ? "rgba(251, 191, 36, 0.25)"
        : "rgba(244, 114, 182, 0.2)";
      ctx.fill();
      ctx.strokeStyle = partnerDrawing ? "#fbbf24" : "#f472b6";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = partnerDrawing ? "#fbbf24" : "#f472b6";
      ctx.fill();

      // Partner label tag
      ctx.font = "10px sans-serif";
      ctx.fillStyle = partnerDrawing ? "#fde68a" : "#fbcfe8";
      ctx.fillText(partnerDrawing ? "Partner ✏️" : "Partner", px + 12, py - 6);
      ctx.restore();
    }
  }, [partnerCursor, partnerDrawing, renderStroke, getScaledWidth]);

  // ResizeObserver to ensure crisp Retina rendering & dynamic responsiveness
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(280, Math.floor(rect.width));
      const height = Math.max(300, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;

      sizeRef.current = { width, height, dpr };

      [baseCanvasRef.current, overlayCanvasRef.current].forEach((canvas) => {
        if (!canvas) return;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
        }
      });

      redrawBaseCanvas();
      redrawOverlay();
    };

    updateDimensions();

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [redrawBaseCanvas, redrawOverlay]);

  // Prevent unwanted mobile scrolling/gestures on iOS while drawing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventTouchScroll = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
      }
    };

    container.addEventListener("touchmove", preventTouchScroll, { passive: false });
    return () => {
      container.removeEventListener("touchmove", preventTouchScroll);
    };
  }, []);

  // Redraw when strokes change
  useEffect(() => {
    redrawBaseCanvas();
  }, [redrawBaseCanvas]);

  // Redraw overlay when partner cursor or drawing state changes
  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay]);

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const rect = canvas.getBoundingClientRect();
    const nx = rect.width > 0 ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : 0;
    const ny = rect.height > 0 ? Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) : 0;

    isDrawingRef.current = true;
    currentStrokeRef.current = {
      id: createId(),
      userId,
      tool: activeTool,
      color: activeColor,
      width: activeWidth,
      points: [{ x: nx, y: ny }],
      createdAt: Date.now(),
    };

    onDrawingStart();
    onCursorMove({ x: nx, y: ny });
    redrawOverlay();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const nx = rect.width > 0 ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : 0;
    const ny = rect.height > 0 ? Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) : 0;

    // Only broadcast cursor position while actively drawing to prevent idle mouse hover traffic
    if (isDrawingRef.current) {
      const now = Date.now();
      if (now - lastCursorBroadcastRef.current > 120) {
        lastCursorBroadcastRef.current = now;
        onCursorMove({ x: nx, y: ny });
      }
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    const points = currentStrokeRef.current.points;
    const lastPoint = points[points.length - 1];

    // Point simplification: skip if closer than ~2px on screen
    const dx = (nx - lastPoint.x) * rect.width;
    const dy = (ny - lastPoint.y) * rect.height;
    if (dx * dx + dy * dy < 5) return;

    points.push({ x: nx, y: ny });
    redrawOverlay();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    isDrawingRef.current = false;
    const finishedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    onDrawingStop();
    redrawOverlay();

    if (finishedStroke && finishedStroke.points.length > 0) {
      onStrokeComplete(finishedStroke);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    isDrawingRef.current = false;
    currentStrokeRef.current = null;
    onDrawingStop();
    redrawOverlay();
  };

  const hasNoDoodles = strokes.length === 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[460px] sm:min-h-[560px] rounded-3xl overflow-hidden bg-[#0d0f14] bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:28px_28px] border border-white/[0.08] shadow-2xl touch-none select-none"
    >
      {/* Base Canvas (Committed Strokes) */}
      <canvas
        ref={baseCanvasRef}
        className="absolute inset-0 block pointer-events-none"
        aria-hidden="true"
      />

      {/* Overlay Canvas (Active Stroke & Pointer Events) */}
      <canvas
        ref={overlayCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="absolute inset-0 block cursor-crosshair touch-none"
        style={{ touchAction: "none" }}
        role="img"
        aria-label="Shared collaborative couple doodle canvas"
      />

      {/* Warm Empty Canvas State */}
      {hasNoDoodles && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-amber-200/80 mb-3 shadow-inner">
            <Heart className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-base sm:text-lg font-serif font-light text-[#f7f6f2] tracking-wide mb-1">
            Our little canvas is waiting.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 font-light max-w-xs mb-4">
            Draw something cute, leave a midnight note, or sketch a smile for each other.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.1] text-xs text-amber-200/90 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tap &amp; draw anywhere</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * High-resolution PNG exporter for the shared sketchbook.
 * Renders full canvas composite with paper texture, dot grid, and all strokes.
 */
export function exportDoodleCanvasPng(strokes: DoodleStroke[]) {
  if (typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  const width = 1600;
  const height = 1200;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Fill dark paper background
  ctx.fillStyle = "#0d0f14";
  ctx.fillRect(0, 0, width, height);

  // Draw subtle sketchbook dot grid
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  const dotSpacing = 32;
  for (let x = dotSpacing; x < width; x += dotSpacing) {
    for (let y = dotSpacing; y < height; y += dotSpacing) {
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  const getScaledWidth = (strokeWidth: number, tool: DoodleTool, canvasMin: number) => {
    const scale = Math.max(0.6, canvasMin / 800);
    let base = strokeWidth * scale;
    if (tool === "highlighter") base *= 2.4;
    if (tool === "eraser") base *= 2.6;
    return Math.max(2, base);
  };

  // Render each stroke
  for (const stroke of strokes) {
    const points = stroke.points;
    if (!points || points.length === 0) continue;

    const scaledWidth = getScaledWidth(stroke.width, stroke.tool, Math.min(width, height));
    ctx.save();
    ctx.lineWidth = scaledWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0, 0, 0, 1)";
      ctx.globalAlpha = 1.0;
    } else if (stroke.tool === "highlighter") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = 0.38;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = 1.0;
    }

    if (points.length === 1) {
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(points[0].x * width, points[0].y * height, scaledWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x * width, points[0].y * height);
    if (points.length === 2) {
      ctx.lineTo(points[1].x * width, points[1].y * height);
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const xc = ((points[i].x + points[i + 1].x) / 2) * width;
        const yc = ((points[i].y + points[i + 1].y) / 2) * height;
        ctx.quadraticCurveTo(points[i].x * width, points[i].y * height, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x * width, points[points.length - 1].y * height);
    }
    ctx.stroke();
    ctx.restore();
  }

  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `soulnest-doodle-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
}
