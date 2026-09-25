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
  initialHostStreamActive?: boolean;
  onStateChange?: (state: TheaterRoomState) => void;
  onDriftCorrect?: (remotePos: number) => void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun.cloudflare.com:3478",
      "stun:openrelay.metered.ca:80",
    ],
  },
  { urls: ["stun:global.stun.twilio.com:3478"] },
];

export function useTheaterWebRTC({
  sessionId,
  userId,
  isHost,
  initialHostStreamActive = false,
  onStateChange,
}: TheaterWebRTCProps) {
  const [roomState, setRoomState] = useState<TheaterRoomState>(() => {
    if (!isHost && initialHostStreamActive) return "STREAM_CONNECTING";
    return "IDLE";
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [partnerVoiceActive, setPartnerVoiceActive] = useState(false);
  const [partnerPresence, setPartnerPresence] = useState<
    "online" | "watching" | "paused" | "reconnecting" | "offline" | "left"
  >("offline");
  const hadPartnerEverRef = useRef(false);
  const [streamSourceType, setStreamSourceType] = useState<"tab" | "window" | "screen" | "none">("none");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);
  const pendingSignalsRef = useRef<Array<{ event: string; payload: Record<string, unknown> }>>([]);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const restartAttemptsRef = useRef(0);
  const makingOfferRef = useRef(false);
  const activeOfferIdRef = useRef<string | null>(null);
  const pendingRenegotiateViewerIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVoiceRef = useRef<MediaStream | null>(null);
  const remoteVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteMovieStreamIdRef = useRef<string | null>(null);
  const remoteVoiceStreamIdRef = useRef<string | null>(null);
  const streamSourceTypeRef = useRef<"tab" | "window" | "screen" | "none">(streamSourceType);
  streamSourceTypeRef.current = streamSourceType;

  const renegotiateRef = useRef<(id?: string) => Promise<void>>();
  const sendViewerReadyRef = useRef<() => void>();

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

  // Send signaling message via Supabase Realtime broadcast with offline queue
  const sendSignal = useCallback((event: string, payload: Record<string, unknown>) => {
    const fullPayload = { ...payload, senderUserId: userId };
    if (!channelRef.current || !isSubscribedRef.current) {
      pendingSignalsRef.current.push({ event, payload: fullPayload });
      return;
    }
    void channelRef.current.send({
      type: "broadcast",
      event,
      payload: fullPayload,
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

  // Initialize or re-create PeerConnection cleanly
  const getOrCreatePc = useCallback((forceFresh = false) => {
    if (!forceFresh && pcRef.current && pcRef.current.signalingState !== "closed") {
      return pcRef.current;
    }

    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        /* ignore close errors */
      }
      pcRef.current = null;
    }

    // Clear stale remote media state so dead tracks from old PC don't contaminate new streams
    if (forceFresh) {
      remoteStreamRef.current = null;
      remoteMovieStreamIdRef.current = null;
      remoteVoiceStreamIdRef.current = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      bundlePolicy: "max-bundle",
      iceCandidatePoolSize: 2,
    });
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendSignal("theater:ice-candidate", {
          candidate: ev.candidate.toJSON(),
          offerId: activeOfferIdRef.current,
        });
      }
    };

    pc.ontrack = (ev) => {
      const track = ev.track;
      const associatedStream = ev.streams[0];
      const streamId = associatedStream?.id;

      // === MANDATORY DIAGNOSTIC: ontrack event details ===
      console.log("[WebRTC] ontrack fired:", {
        kind: track.kind,
        trackId: track.id,
        readyState: track.readyState,
        enabled: track.enabled,
        muted: track.muted,
        label: track.label,
        streamsCount: ev.streams.length,
        streamId,
        existingRemoteVideoTracks: remoteStreamRef.current?.getVideoTracks().length ?? 0,
        existingRemoteAudioTracks: remoteStreamRef.current?.getAudioTracks().length ?? 0,
      });

      if (track.kind === "video") {
        if (streamId) {
          remoteMovieStreamIdRef.current = streamId;
        }

        const nativeStream = associatedStream || new MediaStream([track]);
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = nativeStream;
        }
        const rStream = remoteStreamRef.current;
        if (!rStream.getVideoTracks().some((t) => t.id === track.id)) {
          rStream.addTrack(track);
        }

        setRemoteStream(new MediaStream(rStream.getTracks()));
        updateState("LIVE");

        track.onunmute = () => {
          console.log("[WebRTC] Video track unmuted (media packets flowing):", track.id);
          updateState("LIVE");
          if (remoteStreamRef.current) {
            setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
          }
        };

        track.onended = () => {
          if (!remoteStreamRef.current) return;
          remoteStreamRef.current.removeTrack(track);
          const remainingVideos = remoteStreamRef.current.getVideoTracks();
          if (remainingVideos.length === 0) {
            remoteStreamRef.current = null;
            setRemoteStream(null);
            updateState("STREAM_ENDED");
          } else {
            setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
          }
        };
      } else if (track.kind === "audio") {
        // Disambiguate movie tab audio vs voice microphone audio
        const isMovieAudio =
          (remoteMovieStreamIdRef.current && streamId === remoteMovieStreamIdRef.current) ||
          (associatedStream && associatedStream.getVideoTracks().length > 0) ||
          (!remoteVoiceStreamIdRef.current && !track.label.toLowerCase().includes("mic"));

        const isVoiceAudio =
          (remoteVoiceStreamIdRef.current && streamId === remoteVoiceStreamIdRef.current) ||
          track.label.toLowerCase().includes("mic") ||
          !isMovieAudio;

        if (isVoiceAudio && remoteVoiceAudioRef.current) {
          remoteVoiceAudioRef.current.srcObject = new MediaStream([track]);
          void remoteVoiceAudioRef.current.play().catch(() => {});
        } else {
          // Tab movie audio: add to remoteStream
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = associatedStream || new MediaStream([track]);
          }
          const rStream = remoteStreamRef.current;
          if (!rStream.getAudioTracks().some((t) => t.id === track.id)) {
            rStream.addTrack(track);
          }
          setRemoteStream(new MediaStream(rStream.getTracks()));
        }
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      // === MANDATORY DIAGNOSTIC: connection state change ===
      console.log("[WebRTC] connectionStateChange:", {
        connectionState: state,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState,
        senderCount: pc.getSenders().length,
        receiverCount: pc.getReceivers().length,
        videoSenderTrack: pc.getSenders().find(s => s.track?.kind === "video")?.track
          ? { readyState: pc.getSenders().find(s => s.track?.kind === "video")!.track!.readyState, enabled: pc.getSenders().find(s => s.track?.kind === "video")!.track!.enabled }
          : null,
        remoteVideoTracks: remoteStreamRef.current?.getVideoTracks().map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled })) ?? [],
        isHost,
      });

      // Expose diagnostic function on window for DevTools access
      if (typeof window !== "undefined") {
        (window as any).__WEBRTC_DIAG = async () => {
          const currentPc = pcRef.current || pc;
          const stats: Record<string, any> = {
            connectionState: currentPc.connectionState,
            iceConnectionState: currentPc.iceConnectionState,
            signalingState: currentPc.signalingState,
            senders: currentPc.getSenders().map(s => ({
              kind: s.track?.kind,
              readyState: s.track?.readyState,
              enabled: s.track?.enabled,
              id: s.track?.id,
              settings: s.track?.getSettings(),
            })),
            receivers: currentPc.getReceivers().map(r => ({
              kind: r.track?.kind,
              readyState: r.track?.readyState,
              enabled: r.track?.enabled,
              id: r.track?.id,
            })),
            localStream: localStreamRef.current ? {
              videoTracks: localStreamRef.current.getVideoTracks().map(t => ({ readyState: t.readyState, enabled: t.enabled, settings: t.getSettings() })),
              audioTracks: localStreamRef.current.getAudioTracks().length,
            } : null,
            remoteStream: remoteStreamRef.current ? {
              videoTracks: remoteStreamRef.current.getVideoTracks().map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled, muted: t.muted })),
              audioTracks: remoteStreamRef.current.getAudioTracks().length,
            } : null,
            iceServers: iceServersRef.current.map(s => ({ urls: s.urls, hasCredential: !!s.credential })),
          };

          // Collect RTP stats
          const rtpStats = await currentPc.getStats();
          const rtp: Record<string, any>[] = [];
          const ice: Record<string, any>[] = [];
          rtpStats.forEach((report: any) => {
            if (report.type === "outbound-rtp" && report.kind === "video") {
              rtp.push({ direction: "outbound-video", bytesSent: report.bytesSent, packetsSent: report.packetsSent, framesEncoded: report.framesEncoded, keyFramesEncoded: report.keyFramesEncoded, frameWidth: report.frameWidth, frameHeight: report.frameHeight, framesPerSecond: report.framesPerSecond });
            }
            if (report.type === "inbound-rtp" && report.kind === "video") {
              rtp.push({ direction: "inbound-video", bytesReceived: report.bytesReceived, packetsReceived: report.packetsReceived, framesReceived: report.framesReceived, framesDecoded: report.framesDecoded, framesDropped: report.framesDropped, frameWidth: report.frameWidth, frameHeight: report.frameHeight, framesPerSecond: report.framesPerSecond });
            }
            if (report.type === "candidate-pair" && report.state === "succeeded") {
              ice.push({ state: report.state, localCandidateId: report.localCandidateId, remoteCandidateId: report.remoteCandidateId, nominated: report.nominated, bytesSent: report.bytesSent, bytesReceived: report.bytesReceived, currentRoundTripTime: report.currentRoundTripTime });
            }
          });
          // Resolve candidate types
          for (const pair of ice) {
            rtpStats.forEach((report: any) => {
              if (report.id === pair.localCandidateId) {
                pair.localType = report.candidateType;
                pair.localProtocol = report.protocol;
                pair.localAddress = report.address ? `${report.address}:${report.port}` : "hidden";
              }
              if (report.id === pair.remoteCandidateId) {
                pair.remoteType = report.candidateType;
                pair.remoteProtocol = report.protocol;
              }
            });
          }
          stats.rtp = rtp;
          stats.ice = ice;

          // Video element state
          const videoEl = document.querySelector("video");
          if (videoEl) {
            stats.videoElement = {
              srcObject: !!videoEl.srcObject,
              srcObjectTrackCount: (videoEl.srcObject as MediaStream)?.getTracks().length ?? 0,
              videoWidth: videoEl.videoWidth,
              videoHeight: videoEl.videoHeight,
              readyState: videoEl.readyState,
              networkState: videoEl.networkState,
              paused: videoEl.paused,
              muted: videoEl.muted,
              currentTime: videoEl.currentTime,
            };
          }

          console.log("[WebRTC DIAGNOSTIC DUMP]", JSON.stringify(stats, null, 2));
          return stats;
        };
      }

      if (state === "connected") {
        restartAttemptsRef.current = 0;
        void applyBitrateCap(pc);
        if (isHost && localStreamRef.current) {
          updateState("LIVE");
        }
      } else if (state === "disconnected" || state === "failed") {
        // If host is actively capturing tab, do not demote host to RECONNECTING or FALLBACK_MODE
        if (isHost && localStreamRef.current?.getVideoTracks().some((t) => t.readyState === "live")) {
          return;
        }

        if (roomStateRef.current === "LIVE" || roomStateRef.current === "STREAM_CONNECTING") {
          updateState("RECONNECTING");
          if (isHost && restartAttemptsRef.current < 5) {
            restartAttemptsRef.current += 1;
            void renegotiateRef.current?.();
          } else if (!isHost) {
            // Mobile Viewer: ping host to renegotiate fresh connection without dropping to FALLBACK_MODE
            setTimeout(() => {
              sendViewerReadyRef.current?.();
            }, 1200);
          }
        }
      }
    };

    return pc;
  }, [applyBitrateCap, isHost, sendSignal, updateState]);

  const lastRenegotiateTimeRef = useRef<number>(0);

  // Host renegotiation logic when Viewer announces presence/readiness
  const renegotiateForViewer = useCallback(async (targetViewerId?: string) => {
    if (!isHost || !localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") return;

    // 1. If already connected AND not responding to a newly joined viewer, re-announce stream state
    if (!targetViewerId && pcRef.current && pcRef.current.connectionState === "connected") {
      sendSignal("theater:stream-state", {
        state: "LIVE",
        surface: streamSourceTypeRef.current || "tab",
      });
      return;
    }

    // 2. Debounce and concurrency protection
    const now = Date.now();
    if (makingOfferRef.current || (now - lastRenegotiateTimeRef.current < 500 && !targetViewerId)) {
      if (targetViewerId) {
        pendingRenegotiateViewerIdRef.current = targetViewerId;
      }
      return;
    }
    lastRenegotiateTimeRef.current = now;
    makingOfferRef.current = true;

    try {
      // When responding to a viewer readiness announcement, refresh, or when disconnected,
      // instantiate a fresh RTCPeerConnection to guarantee clean SDP generation & fresh ICE candidate exchange.
      const needFresh =
        !pcRef.current ||
        pcRef.current.connectionState !== "connected" ||
        pcRef.current.signalingState === "closed" ||
        Boolean(targetViewerId);
      const pc = getOrCreatePc(needFresh);
      if (needFresh) {
        pendingIceRef.current = [];
      }

      // Add movie stream tracks if not already added
      const senders = pc.getSenders();
      localStreamRef.current.getTracks().forEach((track) => {
        if (track.readyState === "live") {
          const alreadyAdded = senders.some((s) => s.track?.id === track.id);
          if (!alreadyAdded) {
            try {
              pc.addTrack(track, localStreamRef.current!);
            } catch {
              // ignore duplicate track
            }
          }
        }
      });

      // Add voice track if call is active
      if (localVoiceRef.current) {
        const vTrack = localVoiceRef.current.getAudioTracks()[0];
        if (vTrack && vTrack.readyState === "live") {
          const alreadyAdded = senders.some((s) => s.track?.id === vTrack.id);
          if (!alreadyAdded) {
            try {
              pc.addTrack(vTrack, localVoiceRef.current);
            } catch {
              // ignore duplicate track
            }
          }
        }
      }

      const offerId = Math.random().toString(36).substring(2, 9);
      activeOfferIdRef.current = offerId;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait up to 300ms for initial STUN/TURN candidates to gather into localDescription
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          const check = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", check);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", check);
          setTimeout(() => {
            pc.removeEventListener("icegatheringstatechange", check);
            resolve();
          }, 300);
        }
      });

      sendSignal("theater:offer", {
        sdp: pc.localDescription || offer,
        surface: streamSourceTypeRef.current || "tab",
        offerId,
        targetViewerId,
        movieStreamId: localStreamRef.current?.id,
        voiceStreamId: localVoiceRef.current?.id,
      });

      sendSignal("theater:stream-state", {
        state: "LIVE",
        surface: streamSourceTypeRef.current || "tab",
      });
    } catch (err) {
      console.error("[WebRTC Host] Failed creating renegotiated offer:", err);
    } finally {
      makingOfferRef.current = false;
      if (pendingRenegotiateViewerIdRef.current) {
        const nextViewer = pendingRenegotiateViewerIdRef.current;
        pendingRenegotiateViewerIdRef.current = null;
        setTimeout(() => {
          void renegotiateForViewer(nextViewer);
        }, 350);
      }
    }
  }, [getOrCreatePc, isHost, sendSignal]);

  // Viewer announces readiness to host
  const sendViewerReady = useCallback(() => {
    if (isHost) return;
    sendSignal("theater:viewer-ready", {
      viewerUserId: userId,
      timestamp: Date.now(),
    });
  }, [isHost, sendSignal, userId]);

  renegotiateRef.current = renegotiateForViewer;
  sendViewerReadyRef.current = sendViewerReady;

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
      try {
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
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
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
      streamSourceTypeRef.current = detectedSurface;
      localStreamRef.current = stream;
      setLocalStream(stream);
      updateState("STREAM_CONNECTING");

      // Listen for browser native 'Stop sharing' button click
      videoTrack.onended = () => {
        stopScreenShare();
      };

      // Set up WebRTC transport
      const pc = getOrCreatePc(true);

      // Add all tracks to PC
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Include voice audio if active
      if (localVoiceRef.current) {
        const vTrack = localVoiceRef.current.getAudioTracks()[0];
        if (vTrack && vTrack.readyState === "live") {
          pc.addTrack(vTrack, localVoiceRef.current);
        }
      }

      // Create offer
      makingOfferRef.current = true;
      try {
        const offerId = Math.random().toString(36).substring(2, 9);
        activeOfferIdRef.current = offerId;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait up to 350ms for initial STUN/TURN candidates to gather into localDescription
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            const check = () => {
              if (pc.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", check);
                resolve();
              }
            };
            pc.addEventListener("icegatheringstatechange", check);
            setTimeout(() => {
              pc.removeEventListener("icegatheringstatechange", check);
              resolve();
            }, 350);
          }
        });

        sendSignal("theater:offer", {
          sdp: pc.localDescription || offer,
          surface: detectedSurface,
          offerId,
          movieStreamId: stream.id,
          voiceStreamId: localVoiceRef.current?.id,
        });
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localVoiceRef.current = stream;
      setVoiceStream(stream);
      setVoiceActive(true);
      setMicMuted(false);

      const pc = getOrCreatePc(false);
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        pc.addTrack(audioTrack, stream);
        if (isHost) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const offerId = Math.random().toString(36).substring(2, 9);
          activeOfferIdRef.current = offerId;
          sendSignal("theater:offer", { sdp: offer, offerId });
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

    const topic = `room-signaling:${sessionId}`;
    const channel = supabase
      .channel(topic, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "theater:offer" }, async ({ payload }: { payload: any }) => {
        if (payload.senderUserId === userId) return;
        if (payload.targetViewerId && payload.targetViewerId !== userId) return;
        try {
          // If already processing or connected with this offerId, avoid resetting
          if (
            activeOfferIdRef.current === payload.offerId &&
            pcRef.current?.connectionState === "connected"
          ) {
            return;
          }
          // A new offerId from the host means the host created a fresh RTCPeerConnection
          // (e.g., in renegotiateForViewer). The viewer MUST also create a fresh PC so that
          // ontrack fires for the new transceivers. Reusing the old PC causes ontrack to
          // never fire (W3C WebRTC spec: existing transceivers don't re-fire ontrack).
          const isNewOffer = payload.offerId !== activeOfferIdRef.current;
          activeOfferIdRef.current = payload.offerId;

          if (payload.movieStreamId) {
            remoteMovieStreamIdRef.current = payload.movieStreamId;
          }
          if (payload.voiceStreamId) {
            remoteVoiceStreamIdRef.current = payload.voiceStreamId;
          }

          const needFresh =
            !pcRef.current ||
            pcRef.current.signalingState === "closed" ||
            isNewOffer;
          const pc = getOrCreatePc(needFresh);
          if (needFresh) {
            pendingIceRef.current = [];
          }

          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await flushPendingIce(pc);

          if (localVoiceRef.current) {
            const vTrack = localVoiceRef.current.getAudioTracks()[0];
            if (vTrack && vTrack.readyState === "live") {
              const senders = pc.getSenders();
              if (!senders.some((s) => s.track?.id === vTrack.id)) {
                pc.addTrack(vTrack, localVoiceRef.current);
              }
            }
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Wait up to 300ms for initial STUN candidates to gather into localDescription
          await new Promise<void>((resolve) => {
            if (pc.iceGatheringState === "complete") {
              resolve();
            } else {
              const check = () => {
                if (pc.iceGatheringState === "complete") {
                  pc.removeEventListener("icegatheringstatechange", check);
                  resolve();
                }
              };
              pc.addEventListener("icegatheringstatechange", check);
              setTimeout(() => {
                pc.removeEventListener("icegatheringstatechange", check);
                resolve();
              }, 300);
            }
          });

          sendSignal("theater:answer", {
            sdp: pc.localDescription || answer,
            offerId: payload.offerId,
          });

          if (payload.surface) {
            setStreamSourceType(payload.surface);
            streamSourceTypeRef.current = payload.surface;
          }
          updateState("STREAM_CONNECTING");
        } catch (e) {
          console.error("[WebRTC Viewer] Failed handling WebRTC offer:", e);
        }
      })
      .on("broadcast", { event: "theater:answer" }, async ({ payload }: { payload: any }) => {
        if (payload.senderUserId === userId) return;
        try {
          const pc = pcRef.current;
          if (
            pc &&
            (pc.signalingState === "have-local-offer" ||
              pc.signalingState === "have-remote-pranswer")
          ) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            await flushPendingIce(pc);
          }
        } catch (e) {
          console.error("[WebRTC Host] Failed handling WebRTC answer:", e);
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
            // ignore stale candidate
          }
        } else {
          pendingIceRef.current.push(candidate);
        }
      })
      .on("broadcast", { event: "theater:viewer-ready" }, async ({ payload }: { payload: any }) => {
        if (payload.senderUserId === userId) return;
        // Host receives viewer readiness signal -> renegotiate fresh offer immediately
        if (isHost && localStreamRef.current) {
          await renegotiateForViewer(payload.senderUserId);
        }
      })
      .on("broadcast", { event: "theater:stream-state" }, ({ payload }: { payload: any }) => {
        if (payload.senderUserId === userId) return;
        if (payload.state) {
          // If host is actively capturing, remote state updates must not overwrite host's own LIVE state
          if (isHost && localStreamRef.current?.getVideoTracks().some((t) => t.readyState === "live")) {
            return;
          }
          updateState(payload.state);
          if (payload.surface) {
            setStreamSourceType(payload.surface);
            streamSourceTypeRef.current = payload.surface;
          }
          if (payload.state === "STREAM_ENDED") {
            setRemoteStream(null);
            remoteStreamRef.current = null;
          } else if (payload.state === "LIVE" && !isHost && !remoteStreamRef.current) {
            // Host is live but viewer doesn't have stream yet -> request offer
            sendViewerReady();
          }
        }
      })
      .on("broadcast", { event: "theater:voice-status" }, ({ payload }: { payload: any }) => {
        if (payload.senderUserId === userId) return;
        setPartnerVoiceActive(!!payload.active);
      })
      .on("broadcast", { event: "theater:voice-ready" }, async ({ payload }: { payload: any }) => {
        if (payload.senderUserId === userId) return;
        if (isHost && pcRef.current && localStreamRef.current) {
          await renegotiateForViewer(payload.senderUserId);
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const keys = Object.keys(state);
        const hasPartner = keys.some((k) => k !== userId);
        if (hasPartner) {
          hadPartnerEverRef.current = true;
          setPartnerPresence("watching");
          // If host is live, trigger offer for partner if not already connected
          if (
            isHost &&
            localStreamRef.current &&
            (!pcRef.current || pcRef.current.connectionState !== "connected")
          ) {
            void renegotiateForViewer();
          }
        } else {
          setPartnerPresence(hadPartnerEverRef.current ? "left" : "offline");
        }
      })
      .on("presence", { event: "join" }, ({ newPresences }: { newPresences: any[] }) => {
        const partnerJoined = (newPresences || []).some((p: any) => p.userId !== userId);
        if (partnerJoined) {
          hadPartnerEverRef.current = true;
          setPartnerPresence("watching");
          if (isHost && localStreamRef.current) {
            void renegotiateForViewer();
          }
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }: { leftPresences: any[] }) => {
        const partnerLeft = (leftPresences || []).some((p: any) => p.userId !== userId);
        if (partnerLeft) {
          setPartnerPresence("left");
        }
      })
      .on("broadcast", { event: "theater:partner_leave" }, ({ payload }: { payload: any }) => {
        if (payload.senderUserId !== userId) {
          setPartnerPresence("left");
        }
      });

    channelRef.current = channel;

    // Load TURN credentials
    void getTurnCredentialsAction().then((res) => {
      // === MANDATORY DIAGNOSTIC: TURN credential verification ===
      console.log("[WebRTC] TURN credentials response:", {
        ok: res.ok,
        serverCount: res.ok ? res.data.iceServers.length : 0,
        hasTurnServer: res.ok ? res.data.iceServers.some((s: any) => {
          const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
          return urls.some((u: string) => u.startsWith("turn:"));
        }) : false,
        hasCredential: res.ok ? res.data.iceServers.some((s: any) => !!s.credential) : false,
      });
      if (res.ok && res.data.iceServers && res.data.iceServers.length > 0) {
        iceServersRef.current = [
          ...DEFAULT_ICE_SERVERS,
          ...res.data.iceServers,
        ];
        if (pcRef.current && pcRef.current.signalingState !== "closed") {
          try {
            pcRef.current.setConfiguration({
              iceServers: iceServersRef.current,
              bundlePolicy: "max-bundle",
              iceCandidatePoolSize: 2,
            });
          } catch {
            /* ignore dynamic update error on older engines */
          }
        }
      }
    });

    // Authorize & subscribe
    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed || !auth.ok) return;

      channel.subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          isSubscribedRef.current = true;
          await channel.track({ userId, joinedAt: Date.now() });

          // Flush queued signals
          while (pendingSignalsRef.current.length > 0) {
            const item = pendingSignalsRef.current.shift();
            if (item && channelRef.current) {
              void channelRef.current.send({
                type: "broadcast",
                event: item.event,
                payload: item.payload,
              });
            }
          }

          // If viewer, actively signal readiness to the host
          if (!isHost) {
            sendViewerReady();
          }
        }
      });
    });

    return () => {
      disposed = true;
      isSubscribedRef.current = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (localVoiceRef.current) {
        localVoiceRef.current.getTracks().forEach((t) => t.stop());
        localVoiceRef.current = null;
      }
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {
          // ignore
        }
        pcRef.current = null;
      }
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    flushPendingIce,
    getOrCreatePc,
    isHost,
    renegotiateForViewer,
    sendSignal,
    sendViewerReady,
    sessionId,
    updateState,
    userId,
  ]);

  // Periodic heartbeat / retry for viewer awaiting stream
  useEffect(() => {
    if (isHost) return;
    let count = 0;
    let mediaWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(() => {
      count++;
      if (count > 40) {
        clearInterval(interval);
        return;
      }
      // Check whether we have a live video track, not just a connected PC.
      // A PC can be "connected" at the ICE/DTLS layer while video RTP is blocked
      // (e.g. missing TURN relay, stale transceiver, codec mismatch).
      const hasLiveVideo = remoteStreamRef.current?.getVideoTracks().some(
        (t) => t.readyState === "live",
      );
      const isActivelyConnecting = pcRef.current?.connectionState === "connecting";

      if (
        !hasLiveVideo &&
        !isActivelyConnecting &&
        roomStateRef.current !== "STREAM_ENDED"
      ) {
        sendViewerReady();
      }
    }, 3000);

    // Media watchdog: if PC reaches "connected" but no video track arrives
    // within 8 seconds, force a viewer-ready renegotiation to recover.
    const originalOnConnectionStateChange = pcRef.current?.onconnectionstatechange;
    const checkMediaAfterConnect = () => {
      const pc = pcRef.current;
      if (pc?.connectionState === "connected") {
        mediaWatchdogTimer = setTimeout(() => {
          const hasLiveVideo = remoteStreamRef.current?.getVideoTracks().some(
            (t) => t.readyState === "live",
          );
          if (!hasLiveVideo && roomStateRef.current !== "STREAM_ENDED") {
            console.warn("[WebRTC Viewer] Media watchdog: connected but no video after 8s, requesting renegotiation");
            sendViewerReady();
          }
        }, 8000);
      }
    };
    // Attach watchdog alongside existing handler (if PC exists at mount time)
    if (pcRef.current) {
      checkMediaAfterConnect();
    }

    return () => {
      clearInterval(interval);
      if (mediaWatchdogTimer) clearTimeout(mediaWatchdogTimer);
    };
  }, [isHost, sendViewerReady]);

  const notifyPartnerLeaving = useCallback(async () => {
    try {
      sendSignal("theater:partner_leave", {});
      if (channelRef.current) {
        await channelRef.current.untrack();
      }
    } catch {
      /* ignore */
    }
  }, [sendSignal]);

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
    notifyPartnerLeaving,
    sendViewerReady,
  };
}
