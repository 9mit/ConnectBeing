"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import {
  recordAudioMinutesAction,
  recordCallEventAction,
} from "@/actions/realtime";
import {
  clearCallInviteAction,
  getIncomingCallAction,
  ringPartnerAction,
} from "@/actions/call-invite";
import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "calling" | "connected" | "reconnecting" | "failed";
type Quality = "good" | "fair" | "poor" | "unknown";

function qualityFromStats(loss: number, rtt: number): Quality {
  if (loss > 0.08 || rtt > 400) return "poor";
  if (loss > 0.03 || rtt > 200) return "fair";
  return "good";
}

export function CallPanel({
  coupleId,
  userId,
  partnerId,
}: {
  coupleId: string;
  userId: string;
  partnerId: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [cameraOn, setCameraOn] = useState(true);
  const [pttHeld, setPttHeld] = useState(false);
  const [quality, setQuality] = useState<Quality>("unknown");
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([
    { urls: "stun:stun.l.google.com:19302" },
  ]);
  const [subscribed, setSubscribed] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const callIdRef = useRef<string>(crypto.randomUUID());
  const connectedAt = useRef<number | null>(null);
  const restartAttempts = useRef(0);
  const polite = useRef(false);

  const setMicEnabled = useCallback((enabled: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }, []);

  const sendSignal = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      void channelRef.current?.send({
        type: "broadcast",
        event,
        payload: { ...payload, userId, callId: callIdRef.current },
      });
    },
    [userId],
  );

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingIceRef.current = [];
    if (connectedAt.current) {
      const mins = Math.max(
        1,
        Math.round((Date.now() - connectedAt.current) / 60000),
      );
      void recordAudioMinutesAction({ minutes: mins });
      void recordCallEventAction({ kind: "ended" });
      connectedAt.current = null;
    }
  }, []);

  const attachLocalMedia = useCallback(
    async (pc: RTCPeerConnection) => {
      let stream: MediaStream | null = null;
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        console.warn("getUserMedia is not supported in this browser environment");
        return null;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        // Fall back gracefully to audio-only if camera is unavailable or denied
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          setCameraOn(false);
        } catch {
          console.warn("Microphone access denied or unavailable");
          setCameraOn(false);
          stream = null;
        }
      }
      if (!stream) return null;
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      stream.getTracks().forEach((t) => pc.addTrack(t, stream!));
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setMicEnabled(false);
      return stream;
    },
    [setMicEnabled],
  );

  const applyBitrateCap = useCallback(async (pc: RTCPeerConnection, maxKbps: number) => {
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;
    const params = sender.getParameters();
    if (!params.encodings?.length) {
      params.encodings = [{}];
    }
    params.encodings[0]!.maxBitrate = maxKbps * 1000;
    await sender.setParameters(params);
  }, []);

  const createPc = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendSignal("call:ice-candidate", { candidate: ev.candidate });
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setStatus("connected");
        connectedAt.current = Date.now();
        restartAttempts.current = 0;
        void applyBitrateCap(pc, 1200);
      }
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        setStatus("reconnecting");
        void (async () => {
          if (restartAttempts.current >= 4) {
            setStatus("failed");
            cleanup();
            return;
          }
          restartAttempts.current += 1;
          try {
            pc.restartIce();
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            sendSignal("call:offer", { sdp: offer, iceRestart: true });
          } catch {
            setStatus("failed");
            cleanup();
          }
        })();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [iceServers, sendSignal, cleanup, applyBitrateCap]);

  const [incomingCallId, setIncomingCallId] = useState<string | null>(null);
  const isLeaderRef = useRef(false);
  const lockAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    lockAbortRef.current = ac;
    if ("locks" in navigator) {
      void navigator.locks.request(
        `madlove-call-${coupleId}`,
        { signal: ac.signal, mode: "exclusive" },
        async () => {
          isLeaderRef.current = true;
          await new Promise<void>((resolve) => {
            ac.signal.addEventListener("abort", () => resolve(), { once: true });
          });
        },
      ).catch(() => {
        isLeaderRef.current = false;
      });
    } else {
      isLeaderRef.current = true;
    }
    return () => {
      isLeaderRef.current = false;
      ac.abort();
    };
  }, [coupleId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!isLeaderRef.current || status !== "idle") return;
      void getIncomingCallAction().then((res) => {
        if (res.ok && res.data) setIncomingCallId(res.data.callId);
        else setIncomingCallId(null);
      });
    }, 2500);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    let timerId: number | null = null;
    let disposed = false;
    void import("@/actions/realtime-ice").then(async ({ getTurnCredentialsAction }) => {
      if (disposed) return;
      const res = await getTurnCredentialsAction();
      if (res.ok && !disposed) {
        setIceServers(res.data.iceServers);
        const expiresAt = res.data.expiresAt;
        const refreshIn = Math.max(30_000, expiresAt - Date.now() - 120_000);
        timerId = window.setTimeout(() => {
          if (disposed) return;
          void getTurnCredentialsAction().then((r) => {
            if (r.ok && !disposed) setIceServers(r.data.iceServers);
          });
        }, refreshIn);
      }
    });
    return () => {
      disposed = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    polite.current = userId < partnerId;
    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const topic = `couple:${coupleId}:call`;
    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (!auth.ok) setSubscribed(false);
    });

    const channel = supabase.channel(topic, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    const flushIce = async (pc: RTCPeerConnection) => {
      const queued = pendingIceRef.current.splice(0);
      for (const c of queued) {
        try {
          await pc.addIceCandidate(c);
        } catch {
          /* ignore */
        }
      }
    };

    channel
      .on("broadcast", { event: "call:offer" }, async ({ payload }: { payload: any }) => {
        if (payload.userId === userId) return;
        if (!isLeaderRef.current) return;
        if (payload.callId && payload.callId === callIdRef.current && !payload.iceRestart) {
          return;
        }
        const offerCollision =
          makingOfferRef.current ||
          pcRef.current?.signalingState !== "stable";
        ignoreOfferRef.current = !polite.current && offerCollision;
        if (ignoreOfferRef.current) return;

        let pc = pcRef.current;
        if (!pc) {
          pc = createPc();
          await attachLocalMedia(pc);
        }
        await pc.setRemoteDescription(payload.sdp);
        await flushIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal("call:answer", { sdp: answer });
        setStatus("calling");
      })
      .on("broadcast", { event: "call:answer" }, async ({ payload }: { payload: any }) => {
        if (payload.userId === userId) return;
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(payload.sdp);
        await flushIce(pc);
      })
      .on("broadcast", { event: "call:ice-candidate" }, async ({ payload }: { payload: any }) => {
        if (payload.userId === userId) return;
        const pc = pcRef.current;
        if (!pc?.remoteDescription) {
          pendingIceRef.current.push(payload.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch {
          /* ignore */
        }
      })
      .on("broadcast", { event: "call:end" }, ({ payload }: { payload: any }) => {
        if (payload.userId !== userId) {
          cleanup();
          setStatus("idle");
          callIdRef.current = crypto.randomUUID();
        }
      })
      .subscribe((status: string) => {
        if (disposed) return;
        setSubscribed(status === "SUBSCRIBED");
      });

    return () => {
      disposed = true;
      channelRef.current = null;
      void supabase.removeChannel(channel);
      cleanup();
    };
  }, [coupleId, userId, partnerId, createPc, attachLocalMedia, sendSignal, cleanup]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      const pc = pcRef.current;
      if (!pc || status !== "connected") {
        setQuality("unknown");
        return;
      }
      try {
        const stats = await pc.getStats();
        let loss = 0;
        let rtt = 0;
        stats.forEach((r) => {
          if (r.type === "inbound-rtp" && r.kind === "video") {
            const packets = Number(r.packetsReceived ?? 0);
            const lost = Number(r.packetsLost ?? 0);
            if (packets + lost > 0) loss = lost / (packets + lost);
          }
          if (r.type === "candidate-pair" && r.state === "succeeded") {
            rtt = Number(r.currentRoundTripTime ?? 0) * 1000;
          }
        });
        const q = qualityFromStats(loss, rtt);
        setQuality(q);
        if (q === "poor") await applyBitrateCap(pc, 400);
        else if (q === "fair") await applyBitrateCap(pc, 700);
        else await applyBitrateCap(pc, 1200);
      } catch {
        setQuality("unknown");
      }
    }, 3000);
    return () => clearInterval(id);
  }, [status, applyBitrateCap]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      e.preventDefault();
      setPttHeld(true);
      setMicEnabled(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      setPttHeld(false);
      setMicEnabled(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [setMicEnabled]);

  async function startCall() {
    if (!subscribed) {
      setStatus("reconnecting");
      return;
    }
    if (!isLeaderRef.current) {
      setStatus("failed");
      return;
    }
    callIdRef.current = crypto.randomUUID();
    setStatus("calling");
    void recordCallEventAction({ kind: "started" });
    void ringPartnerAction({ callId: callIdRef.current });
    const pc = createPc();
    await attachLocalMedia(pc);
    try {
      makingOfferRef.current = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal("call:offer", { sdp: offer });
    } finally {
      makingOfferRef.current = false;
    }
  }

  function endCall() {
    sendSignal("call:end", {});
    void clearCallInviteAction();
    cleanup();
    setStatus("idle");
    setIncomingCallId(null);
    callIdRef.current = crypto.randomUUID();
  }

  function toggleCamera() {
    const next = !cameraOn;
    setCameraOn(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
  }

  return (
    <div className="space-y-5 sm:space-y-6 rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-4 sm:p-6 md:p-8 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
      <div className="flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-2 text-xs sm:text-sm text-amber-300/80 border-b border-amber-500/20 pb-3 sm:pb-4 font-medium">
        <div>
          Status: <strong className="text-amber-200 capitalize">{status}</strong>
        </div>
        <div>
          Signal: <strong className="text-amber-200 capitalize">{subscribed ? "ready" : "connecting…"}</strong>
        </div>
        <div>
          Network: <strong className="text-amber-200 capitalize">{quality}</strong>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline">Hold <kbd className="rounded bg-purple-900 text-amber-200 px-1.5 py-0.5 border border-amber-500/30 text-[10px] font-bold">Space</kbd> or </span>
          <span>PTT:</span>
          <span className="text-amber-400/80 font-bold">{pttHeld ? " (live)" : " (muted)"}</span>
        </div>
      </div>
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-purple-950/80 border border-amber-500/30 shadow-inner">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3 bg-purple-950/80 backdrop-blur-md px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest text-amber-300 border border-amber-500/30 shadow-md">
            You
          </div>
        </div>
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-purple-950/80 border border-amber-500/30 shadow-inner">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3 bg-purple-950/80 backdrop-blur-md px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest text-amber-300 border border-amber-500/30 shadow-md">
            Partner
          </div>
        </div>
      </div>
      <audio ref={remoteAudioRef} autoPlay playsInline />
      
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 sm:gap-3 pt-2">
        <button
          type="button"
          onClick={() => void startCall()}
          disabled={!subscribed || status === "calling"}
          aria-label="Start video call"
          className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-4 sm:px-6 py-3.5 min-h-[46px] text-xs font-extrabold uppercase tracking-wider text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(212,175,55,0.35)] active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          {status === "calling" ? "Calling…" : "📞 Start Call"}
        </button>
        <button
          type="button"
          aria-label="Push to talk"
          onMouseDown={() => {
            setPttHeld(true);
            setMicEnabled(true);
          }}
          onMouseUp={() => {
            setPttHeld(false);
            setMicEnabled(false);
          }}
          onMouseLeave={() => {
            setPttHeld(false);
            setMicEnabled(false);
          }}
          onTouchStart={() => {
            setPttHeld(true);
            setMicEnabled(true);
          }}
          onTouchEnd={() => {
            setPttHeld(false);
            setMicEnabled(false);
          }}
          className={`rounded-xl px-4 sm:px-5 py-3.5 min-h-[46px] text-xs font-bold uppercase tracking-wider transition-all select-none touch-none touch-manipulation active:scale-[0.98] flex items-center justify-center gap-1.5 ${
            pttHeld
              ? "bg-amber-400 text-purple-950 shadow-[0_0_15px_#fbbf24]"
              : "border border-amber-500/30 bg-purple-950/40 text-amber-300 hover:bg-purple-900/60"
          }`}
        >
          🎤 Push to talk
        </button>
        <button
          type="button"
          onClick={toggleCamera}
          aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
          className="rounded-xl border border-amber-500/30 bg-purple-950/40 text-amber-200 hover:bg-purple-900/60 px-4 sm:px-5 py-3.5 min-h-[46px] text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          📷 {cameraOn ? "Cam off" : "Cam on"}
        </button>
        <button
          type="button"
          onClick={endCall}
          aria-label="End call"
          className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 sm:px-5 py-3.5 min-h-[46px] text-xs font-bold uppercase tracking-wider text-red-300 hover:bg-red-900 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          🛑 End call
        </button>
      </div>

      {incomingCallId && status === "idle" ? (
        <p className="text-xs font-bold text-amber-200 bg-amber-500/20 border border-amber-500/40 px-4 py-3 rounded-2xl text-center shadow-[0_0_15px_rgba(212,175,55,0.2)]">
          🔔 Incoming call — stay on this page. Call will connect automatically.
        </p>
      ) : null}
      {status === "failed" ? (
        <p className="text-xs font-bold text-red-300 bg-red-950/80 border border-red-500/40 px-4 py-3 rounded-2xl text-center">
          ⚠️ Connection failed or another tab owns the call. Please close other open call tabs.
        </p>
      ) : null}
      {quality === "poor" ? (
        <p className="text-xs font-bold text-amber-300 bg-purple-950/90 border border-amber-500/40 px-4 py-3 rounded-2xl text-center">
          📶 Poor connection — lowering video bitrate dynamically.
        </p>
      ) : null}
    </div>
  );
}
