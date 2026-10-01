"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";
import { saveDoodleCanvasAction } from "@/actions/doodle";
import type { DoodleStroke, DoodlePoint } from "./types";

interface UseDoodleRealtimeOptions {
  coupleId: string;
  userId: string;
  getCurrentStrokes: () => DoodleStroke[];
  onPartnerStroke: (stroke: DoodleStroke) => void;
  onPartnerUndo: (strokeId: string) => void;
  onPartnerClear: () => void;
}

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isValidIncomingStroke(s: any): s is DoodleStroke {
  if (!s || typeof s !== "object") return false;
  if (typeof s.id !== "string" || s.id.length === 0 || s.id.length > 64) return false;
  if (typeof s.userId !== "string" || s.userId.length === 0) return false;
  if (!["pen", "highlighter", "eraser"].includes(s.tool)) return false;
  if (typeof s.color !== "string" || !HEX_COLOR_REGEX.test(s.color)) return false;
  if (typeof s.width !== "number" || isNaN(s.width) || s.width <= 0 || s.width > 100) return false;
  if (!Array.isArray(s.points) || s.points.length === 0 || s.points.length > 5000) return false;
  const sampleLimit = Math.min(s.points.length, 30);
  for (let i = 0; i < sampleLimit; i++) {
    const pt = s.points[i];
    if (!pt || typeof pt.x !== "number" || typeof pt.y !== "number" || isNaN(pt.x) || isNaN(pt.y)) return false;
    if (pt.x < 0 || pt.x > 1 || pt.y < 0 || pt.y > 1) return false;
  }
  return true;
}

function isValidIncomingCursor(pt: any): pt is DoodlePoint {
  if (!pt || typeof pt !== "object") return false;
  return (
    typeof pt.x === "number" &&
    typeof pt.y === "number" &&
    !isNaN(pt.x) &&
    !isNaN(pt.y) &&
    pt.x >= 0 &&
    pt.x <= 1 &&
    pt.y >= 0 &&
    pt.y <= 1
  );
}

export function useDoodleRealtime({
  coupleId,
  userId,
  getCurrentStrokes,
  onPartnerStroke,
  onPartnerUndo,
  onPartnerClear,
}: UseDoodleRealtimeOptions) {
  const [partnerPresent, setPartnerPresent] = useState(false);
  const [partnerDrawing, setPartnerDrawing] = useState(false);
  const [partnerCursor, setPartnerCursor] = useState<DoodlePoint | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const partnerDrawingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getCurrentStrokesRef = useRef(getCurrentStrokes);
  getCurrentStrokesRef.current = getCurrentStrokes;

  // Setup Realtime connection
  useEffect(() => {
    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const topic = `couple:${coupleId}:doodle`;
    const channel = supabase.channel(topic, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed || !auth.ok) return;

      channel
        .on("broadcast", { event: "doodle:stroke" }, ({ payload }: { payload: any }) => {
          if (!payload?.stroke || payload.stroke.userId === userId) return;
          if (!isValidIncomingStroke(payload.stroke)) return;
          // Partner completed a stroke
          setPartnerDrawing(false);
          onPartnerStroke(payload.stroke);
        })
        .on("broadcast", { event: "doodle:drawing:start" }, ({ payload }: { payload: any }) => {
          if (payload?.userId === userId) return;
          setPartnerDrawing(true);
          if (partnerDrawingTimerRef.current) clearTimeout(partnerDrawingTimerRef.current);
          // Safety fallback: reset after 8 seconds if no stop received
          partnerDrawingTimerRef.current = setTimeout(() => {
            setPartnerDrawing(false);
          }, 8000);
        })
        .on("broadcast", { event: "doodle:drawing:stop" }, ({ payload }: { payload: any }) => {
          if (payload?.userId === userId) return;
          setPartnerDrawing(false);
          if (partnerDrawingTimerRef.current) clearTimeout(partnerDrawingTimerRef.current);
        })
        .on("broadcast", { event: "doodle:cursor" }, ({ payload }: { payload: any }) => {
          if (payload?.userId === userId) return;
          if (isValidIncomingCursor(payload?.point)) {
            setPartnerCursor(payload.point);
          }
        })
        .on("broadcast", { event: "doodle:undo" }, ({ payload }: { payload: any }) => {
          if (!payload?.strokeId || typeof payload.strokeId !== "string" || payload.userId === userId) return;
          onPartnerUndo(payload.strokeId);
        })
        .on("broadcast", { event: "doodle:clear" }, ({ payload }: { payload: any }) => {
          if (payload?.userId === userId) return;
          onPartnerClear();
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const others = Object.keys(state).filter((k) => k !== userId);
          setPartnerPresent(others.length > 0);
          if (others.length === 0) {
            setPartnerDrawing(false);
            setPartnerCursor(null);
          }
        })
        .subscribe(async (status: string) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            await channel.track({ userId, onlineAt: Date.now() });
          }
        });
    });

    return () => {
      disposed = true;
      if (partnerDrawingTimerRef.current) clearTimeout(partnerDrawingTimerRef.current);
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
        saveDebounceTimerRef.current = null;
        void saveDoodleCanvasAction({ strokes: getCurrentStrokesRef.current() });
      }
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [coupleId, userId, onPartnerStroke, onPartnerUndo, onPartnerClear]);

  // Flush pending save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
        saveDebounceTimerRef.current = null;
        void saveDoodleCanvasAction({ strokes: getCurrentStrokesRef.current() });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Broadcast functions
  const broadcastStroke = useCallback(
    (stroke: DoodleStroke) => {
      const channel = channelRef.current;
      if (!channel) return;
      void channel.send({
        type: "broadcast",
        event: "doodle:stroke",
        payload: { stroke },
      });
    },
    [],
  );

  const broadcastDrawingStart = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "doodle:drawing:start",
      payload: { userId },
    });
  }, [userId]);

  const broadcastDrawingStop = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "doodle:drawing:stop",
      payload: { userId },
    });
  }, [userId]);

  const broadcastCursor = useCallback(
    (point: DoodlePoint) => {
      const channel = channelRef.current;
      if (!channel) return;
      void channel.send({
        type: "broadcast",
        event: "doodle:cursor",
        payload: { userId, point },
      });
    },
    [userId],
  );

  const broadcastUndo = useCallback(
    (strokeId: string) => {
      const channel = channelRef.current;
      if (!channel) return;
      void channel.send({
        type: "broadcast",
        event: "doodle:undo",
        payload: { userId, strokeId },
      });
    },
    [userId],
  );

  const broadcastClear = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "doodle:clear",
      payload: { userId },
    });
  }, [userId]);

  // Debounced server persistence using the freshest strokes ref
  const queueSave = useCallback(() => {
    setSaveStatus("saving");

    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
    }

    saveDebounceTimerRef.current = setTimeout(async () => {
      saveDebounceTimerRef.current = null;
      try {
        const freshStrokes = getCurrentStrokesRef.current();
        const res = await saveDoodleCanvasAction({
          strokes: freshStrokes,
        });
        if (res.ok) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2500);
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    }, 1500);
  }, []);

  return {
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
  };
}

