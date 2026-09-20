"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { getTurnCredentialsAction } from "@/actions/realtime-ice";
import { updateWatchSessionStreamAction } from "@/actions/together";
import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";
import { createClient } from "@/lib/supabase/client";

export type TheaterRoomState =
  | "IDLE"
  | "PREPARING"
  | "OTT_OPEN"
  | "AWAITING_SCREEN_SHARE"
  | "STREAM_CONNECTING"
  | "LIVE"
  | "RECONNECTING"
  | "STREAM_ENDED"
  | "FALLBACK_MODE"
  | "ENDED";

export interface TheaterWebRTCProps {
  sessionId: string;
  userId: string;
  isHost: boolean;
  onStateChange?: (state: TheaterRoomState) => void;
  onDriftCorrect?: (remotePos: number) => void;
}

export function useTheaterWebRTC({
  sessionId,
  userId,
  isHost,
  onStateChange,
}: TheaterWebRTCProps) {
  const [roomState, setRoomState] = useState<TheaterRoomState>("IDLE");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [partnerVoiceActive, setPartnerVoiceActive] = useState(false);
  const [partnerPresence, setPartnerPresence] = useState<
    "online" | "watching" | "paused" | "reconnecting" | "offline"
  >("offline");
  const [streamSourceType, setStreamSourceType] = useState<"tab" | "window" | "screen" | "none">("none");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const restartAttemptsRef = useRef(0);
  const makingOfferRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVoiceRef = useRef<MediaStream | null>(null);
  const remoteVoiceAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync state ref for safe callbacks
  const roomStateRef = useRef<TheaterRoomState>(roomState);
  roomStateRef.current = roomState;

  const updateState = useCallback(
    (next: TheaterRoomState) => {
      setRoomState(next);
      roomStateRef.current = next;
      onStateChange?.(next);
    },
    [onStateChange],
  );

  // Send signaling message via Supabase Realtime broadcast
  const sendSignal = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!channelRef.current) return;
    void channelRef.current.send({
      type: "broadcast",
      event,
      payload: { ...payload, senderUserId: userId },
    });
  }, [userId]);

  // Apply bitrate optimization for movie screen sharing
  const applyBitrateCap = useCallback(async (pc: RTCPeerConnection, maxKbps = 3500) => {
    try {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (!sender) return;
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0]!.maxBitrate = maxKbps * 1000;
      await sender.setParameters(params);
    } catch {
      // Bitrate parameter setting unsupported or renegotiating
    }
  }, []);

  // Flush queued ICE candidates after remote description is set
  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    while (pendingIceRef.current.length > 0) {
      const cand = pendingIceRef.current.shift();
      if (cand) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {
          // ignore stale candidate
        }
      }
    }
  }, []);

  // Initialize or re-create PeerConnection
  const getOrCreatePc = useCallback(() => {
    if (pcRef.current && pcRef.current.signalingState !== "closed") {
      return pcRef.current;
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      bundlePolicy: "max-bundle",
      iceCandidatePoolSize: 2,
    });
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendSignal("theater:ice-candidate", { candidate: ev.candidate.toJSON() });
      }
    };

    pc.ontrack = (ev) => {
      if (ev.track.kind === "video") {
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        setRemoteStream(stream);
        updateState("LIVE");
        ev.track.onended = () => {
          setRemoteStream(null);
          updateState("STREAM_ENDED");
        };
      } else if (ev.track.kind === "audio") {
        // Tab audio or voice audio
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        if (ev.track.label.includes("mic") || !remoteVoiceAudioRef.current?.srcObject) {
          if (remoteVoiceAudioRef.current) {
            remoteVoiceAudioRef.current.srcObject = stream;
            void remoteVoiceAudioRef.current.play().catch(() => {});
          }
        }
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        restartAttemptsRef.current = 0;
        void applyBitrateCap(pc);
        if (isHost && localStreamRef.current) {
          updateState("LIVE");
        }
      } else if (state === "disconnected" || state === "failed") {
        if (roomStateRef.current === "LIVE") {
          updateState("RECONNECTING");
          if (isHost && restartAttemptsRef.current < 3) {
            restartAttemptsRef.current += 1;
            void (async () => {
              try {
                pc.restartIce();
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);
                sendSignal("theater:offer", { sdp: offer });
              } catch {
                updateState("FALLBACK_MODE");
              }
            })();
          } else if (restartAttemptsRef.current >= 3) {
            updateState("FALLBACK_MODE");
          }
        }
      }
    };

    return pc;
  }, [applyBitrateCap, isHost, sendSignal, updateState]);

  // Stop screen sharing cleanly
  const stopScreenShare = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.onended = null;
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (pcRef.current) {
      // Remove screen tracks from PC
      const senders = pcRef.current.getSenders();
      senders.forEach((s) => {
        if (s.track && s.track.kind === "video") {
          try {
            pcRef.current?.removeTrack(s);
          } catch {
            // ignore
          }
        }
      });
    }

    setStreamSourceType("none");
    updateState("STREAM_ENDED");
    sendSignal("theater:stream-state", { state: "STREAM_ENDED" });
    void updateWatchSessionStreamAction(sessionId, {
      hostStreamActive: false,
      hostStreamType: "none",
    });
  }, [sendSignal, sessionId, updateState]);

  // Start browser-approved screen/tab share (User Gesture Triggered)
  const startScreenShare = useCallback(async () => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("Your browser does not support tab/screen sharing. Switching to Companion Mode.");
      }

      updateState("AWAITING_SCREEN_SHARE");

      // Prefer tab sharing with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          frameRate: { ideal: 30, max: 60 },
        },
        audio: true,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        throw new Error("Captured stream does not contain a live video track.");
      }

      // Detect display surface type if available
      const settings = videoTrack.getSettings() as { displaySurface?: "browser" | "window" | "monitor" };
      const detectedSurface: "tab" | "window" | "screen" =
        settings.displaySurface === "browser"
          ? "tab"
          : settings.displaySurface === "window"
            ? "window"
            : "screen";

      setStreamSourceType(detectedSurface);
      localStreamRef.current = stream;
      setLocalStream(stream);
      updateState("STREAM_CONNECTING");

      // Listen for browser native 'Stop sharing' button click
      videoTrack.onended = () => {
        stopScreenShare();
      };

      // Set up WebRTC transport
      const pc = getOrCreatePc();

      // Add all tracks to PC
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create offer
      makingOfferRef.current = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal("theater:offer", { sdp: offer, surface: detectedSurface });
      } finally {
        makingOfferRef.current = false;
      }

      updateState("LIVE");
      sendSignal("theater:stream-state", { state: "LIVE", surface: detectedSurface });

      void updateWatchSessionStreamAction(sessionId, {
        hostStreamActive: true,
        hostStreamType: detectedSurface,
        playbackState: "playing",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Screen sharing cancelled or permission denied.";
      setErrorMessage(msg);
      if (msg.includes("not support") || msg.includes("Permission denied")) {
        updateState("FALLBACK_MODE");
      } else {
        updateState("IDLE");
      }
    }
  }, [getOrCreatePc, sendSignal, sessionId, stopScreenShare, updateState]);

  // Toggle voice call in-theater
  const startVoiceCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localVoiceRef.current = stream;
      setVoiceStream(stream);
      setVoiceActive(true);
      setMicMuted(false);

      const pc = getOrCreatePc();
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        pc.addTrack(audioTrack, stream);
        if (isHost) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal("theater:offer", { sdp: offer });
        } else {
          sendSignal("theater:voice-ready", { active: true });
        }
      }
      sendSignal("theater:voice-status", { active: true });
    } catch {
      setErrorMessage("Microphone permission was denied.");
    }
  }, [getOrCreatePc, isHost, sendSignal]);

  const stopVoiceCall = useCallback(() => {
    if (localVoiceRef.current) {
      localVoiceRef.current.getTracks().forEach((t) => t.stop());
      localVoiceRef.current = null;
    }
    setVoiceStream(null);
    setVoiceActive(false);
    sendSignal("theater:voice-status", { active: false });
  }, [sendSignal]);

  const toggleMic = useCallback(() => {
    if (!localVoiceRef.current) return;
    const track = localVoiceRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicMuted(!track.enabled);
    }
  }, []);

  // Setup Turn & Realtime signaling
  useEffect(() => {
    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const topic = `room:${sessionId}`;
    const channel = supabase.channel(topic, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    // Load TURN credentials
    void getTurnCredentialsAction().then((res) => {
      if (res.ok && res.data.iceServers) {
        iceServersRef.current = res.data.iceServers;
      }
    });

    // Authorize & subscribe
    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed || !auth.ok) return;

      channel
        .on("broadcast", { event: "theater:offer" }, async ({ payload }: { payload: any }) => {
          if (payload.senderUserId === userId) return;
          try {
            const pc = getOrCreatePc();
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            await flushPendingIce(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal("theater:answer", { sdp: answer });

            if (payload.surface) {
              setStreamSourceType(payload.surface);
            }
            updateState("LIVE");
          } catch (e) {
            console.error("Failed handling WebRTC offer", e);
          }
        })
        .on("broadcast", { event: "theater:answer" }, async ({ payload }: { payload: any }) => {
          if (payload.senderUserId === userId) return;
          try {
            const pc = pcRef.current;
            if (pc && pc.signalingState !== "stable") {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              await flushPendingIce(pc);
            }
          } catch (e) {
            console.error("Failed handling WebRTC answer", e);
          }
        })
        .on("broadcast", { event: "theater:ice-candidate" }, async ({ payload }: { payload: any }) => {
          if (payload.senderUserId === userId) return;
          const candidate = payload.candidate as RTCIceCandidateInit;
          if (!candidate) return;

          const pc = pcRef.current;
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
              // ignore
            }
          } else {
            pendingIceRef.current.push(candidate);
          }
        })
        .on("broadcast", { event: "theater:stream-state" }, ({ payload }: { payload: any }) => {
          if (payload.senderUserId === userId) return;
          if (payload.state) {
            updateState(payload.state);
            if (payload.surface) setStreamSourceType(payload.surface);
            if (payload.state === "STREAM_ENDED" || payload.state === "FALLBACK_MODE") {
              setRemoteStream(null);
            }
          }
        })
        .on("broadcast", { event: "theater:voice-status" }, ({ payload }: { payload: any }) => {
          if (payload.senderUserId === userId) return;
          setPartnerVoiceActive(!!payload.active);
        })
        .on("broadcast", { event: "theater:voice-ready" }, async ({ payload }: { payload: any }) => {
          if (payload.senderUserId === userId) return;
          if (isHost && pcRef.current) {
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            sendSignal("theater:offer", { sdp: offer });
          }
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const keys = Object.keys(state);
          const hasPartner = keys.some((k) => k !== userId);
          setPartnerPresence(hasPartner ? "watching" : "offline");
        })
        .subscribe(async (status: string) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ userId, joinedAt: Date.now() });
          }
        });
    });

    return () => {
      disposed = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (localVoiceRef.current) {
        localVoiceRef.current.getTracks().forEach((t) => t.stop());
        localVoiceRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    flushPendingIce,
    getOrCreatePc,
    isHost,
    sendSignal,
    sessionId,
    updateState,
    userId,
  ]);

  return {
    roomState,
    localStream,
    remoteStream,
    voiceStream,
    voiceActive,
    micMuted,
    partnerVoiceActive,
    partnerPresence,
    streamSourceType,
    errorMessage,
    updateState,
    startScreenShare,
    stopScreenShare,
    startVoiceCall,
    stopVoiceCall,
    toggleMic,
    remoteVoiceAudioRef,
  };
}
