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

export type FailureMatrixCase =
  | "CASE_A_TRANSPORT_FAILURE"
  | "CASE_B_CODEC_DECODE_FAILURE"
  | "CASE_C_RENDERING_OR_DRM_BLACK"
  | "CASE_D_SOURCE_CAPTURE_FAILURE"
  | "CASE_E_NEGOTIATION_FAILURE"
  | "CONNECTING"
  | "HEALTHY_STREAMING"
  | "IDLE";

export interface WebRTCDiagnosticData {
  timestamp: number;
  role: "host" | "viewer";
  pcId: number;
  connectionState: RTCPeerConnectionState | "none";
  iceConnectionState: RTCIceConnectionState | "none";
  iceGatheringState: RTCIceGatheringState | "none";
  signalingState: RTCSignalingState | "none";
  failureMatrixCase: FailureMatrixCase;
  failureMatrixSummary: string;
  localVideoTrack?: {
    id: string;
    readyState: MediaStreamTrackState;
    enabled: boolean;
    muted: boolean;
    settings?: MediaTrackSettings;
  } | null;
  remoteVideoTrack?: {
    id: string;
    readyState: MediaStreamTrackState;
    enabled: boolean;
    muted: boolean;
  } | null;
  outboundVideo?: {
    bytesSent: number;
    packetsSent: number;
    framesEncoded: number;
    keyFramesEncoded?: number;
    frameWidth?: number;
    frameHeight?: number;
    fps?: number;
    bitrateKbps?: number;
  };
  inboundVideo?: {
    bytesReceived: number;
    packetsReceived: number;
    framesReceived: number;
    framesDecoded: number;
    framesDropped: number;
    frameWidth?: number;
    frameHeight?: number;
    fps?: number;
    bitrateKbps?: number;
  };
  ice: {
    candidatesGathered: { host: number; srflx: number; relay: number };
    selectedPair?: {
      state: string;
      localType: string;
      remoteType: string;
      localAddress: string;
      remoteAddress: string;
      currentRoundTripTime?: number;
      bytesSent: number;
      bytesReceived: number;
      relayActive: boolean;
    } | null;
  };
  negotiatedCodec?: {
    mimeType?: string;
    payloadType?: number;
    sdpFmtpLine?: string;
  } | null;
  videoElement?: {
    videoWidth: number;
    videoHeight: number;
    readyState: number;
    paused: boolean;
    muted: boolean;
    currentTime: number;
  } | null;
}

export interface TheaterWebRTCProps {
  sessionId: string;
  userId: string;
  isHost: boolean;
  initialHostStreamActive?: boolean;
  onStateChange?: (state: TheaterRoomState) => void;
  onDriftCorrect?: (remotePos: number) => void;
}

const envTurnUser = process.env.NEXT_PUBLIC_TURN_USERNAME || "openrelayproject";
const envTurnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "openrelayproject";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun.cloudflare.com:3478",
      "stun:global.stun.twilio.com:3478",
    ],
  },
  {
    urls: [
      "turn:a.relay.metered.ca:80",
      "turn:a.relay.metered.ca:443",
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
    ],
    username: envTurnUser,
    credential: envTurnCred,
  },
  {
    urls: [
      "turn:a.relay.metered.ca:443?transport=tcp",
      "turn:openrelay.metered.ca:443?transport=tcp",
      "turns:a.relay.metered.ca:443",
      "turns:openrelay.metered.ca:443",
    ],
    username: envTurnUser,
    credential: envTurnCred,
  },
];

/**
 * Reorders video payload types in SDP so mobile-friendly codecs (H.264 Baseline & VP8)
 * are listed ahead of VP9/AV1, while strictly preserving RFC 4588 RTX associations.
 * Note: Only apply to OFFER sdp. Do NOT munge answer sdp per RFC 8829 §5.4.
 */
function prioritizeCodecsInSdp(sdp: string): string {
  if (!sdp || typeof sdp !== "string") return sdp;

  try {
    const isCrlf = sdp.includes("\r\n");
    const lines = isCrlf ? sdp.split("\r\n") : sdp.split("\n");
    let videoMediaLineIndex = -1;
    const rtpMap = new Map<string, string>(); // pt -> codecName
    const fmtpMap = new Map<string, string>(); // pt -> fmtpConfig

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("m=video ")) {
        videoMediaLineIndex = i;
      } else if (line.startsWith("a=rtpmap:")) {
        const parts = line.substring(9).split(" ");
        const pt = parts[0];
        const codec = parts[1]?.split("/")[0]?.toUpperCase() || "";
        rtpMap.set(pt, codec);
      } else if (line.startsWith("a=fmtp:")) {
        const parts = line.substring(7).split(" ");
        const pt = parts[0];
        const fmtp = parts.slice(1).join(" ");
        fmtpMap.set(pt, fmtp.toLowerCase());
      }
    }

    if (videoMediaLineIndex === -1) return sdp;

    const mLine = lines[videoMediaLineIndex];
    const mTokens = mLine.split(" ");
    if (mTokens.length < 4) return sdp;

    const prefix = mTokens.slice(0, 3);
    const payloadTypes = mTokens.slice(3);

    // Map each primary codec to its RTX payload type (RFC 4588 apt=<primary-pt>)
    const rtxForPrimary = new Map<string, string>();
    const isRtxPt = new Set<string>();
    fmtpMap.forEach((fmtp, pt) => {
      const match = fmtp.match(/apt=(\d+)/);
      if (match && rtpMap.get(pt) === "RTX") {
        rtxForPrimary.set(match[1], pt);
        isRtxPt.add(pt);
      }
    });

    const getScore = (pt: string): number => {
      const codec = rtpMap.get(pt) || "";
      const fmtp = fmtpMap.get(pt) || "";

      if (codec === "H264") {
        if (fmtp.includes("42e01f") || fmtp.includes("42001f")) {
          return 100;
        }
        if (fmtp.includes("4d001f") || fmtp.includes("4d002a")) {
          return 90;
        }
        return 80;
      }
      if (codec === "VP8") {
        return 70;
      }
      if (codec === "VP9") {
        return 40;
      }
      if (codec === "AV1") {
        return 20;
      }
      return 10;
    };

    // Filter out RTX payload types when sorting primary codecs
    const primaryPayloads = payloadTypes.filter((pt) => !isRtxPt.has(pt));
    primaryPayloads.sort((a, b) => getScore(b) - getScore(a));

    // Reconstruct list keeping each primary codec immediately followed by its RTX codec
    const finalPayloads: string[] = [];
    for (const pt of primaryPayloads) {
      finalPayloads.push(pt);
      const rtxPt = rtxForPrimary.get(pt);
      if (rtxPt && payloadTypes.includes(rtxPt)) {
        finalPayloads.push(rtxPt);
      }
    }

    // Append any leftover unmapped payload types
    for (const pt of payloadTypes) {
      if (!finalPayloads.includes(pt)) {
        finalPayloads.push(pt);
      }
    }

    lines[videoMediaLineIndex] = `${prefix.join(" ")} ${finalPayloads.join(" ")}`;
    return isCrlf ? lines.join("\r\n") : lines.join("\n");
  } catch (err) {
    console.warn("[WebRTC] SDP codec prioritization fallback:", err);
    return sdp;
  }
}

/**
 * Configure RTCRtpTransceiver codec preferences API (modern WebRTC standard)
 * Preserves secondary codecs (RTX/RED/FEC) without breaking associations.
 */
function prioritizeMobileSafeCodecs(transceiver: RTCRtpTransceiver) {
  if (
    !transceiver ||
    typeof transceiver.setCodecPreferences !== "function" ||
    typeof RTCRtpSender === "undefined" ||
    typeof RTCRtpSender.getCapabilities !== "function"
  ) {
    return;
  }

  try {
    const capabilities = RTCRtpSender.getCapabilities("video");
    if (!capabilities || !capabilities.codecs || capabilities.codecs.length === 0) {
      return;
    }

    const primaryCodecs: any[] = [];
    const rtxCodecs: any[] = [];
    const otherCodecs: any[] = [];

    for (const c of capabilities.codecs) {
      const mime = (c.mimeType || "").toLowerCase();
      if (mime === "video/rtx") {
        rtxCodecs.push(c);
      } else if (mime === "video/red" || mime === "video/ulpfec") {
        otherCodecs.push(c);
      } else {
        primaryCodecs.push(c);
      }
    }

    primaryCodecs.sort((a, b) => {
      const aMime = (a.mimeType || "").toLowerCase();
      const bMime = (b.mimeType || "").toLowerCase();
      const aIsH264 = aMime === "video/h264";
      const bIsH264 = bMime === "video/h264";
      const aIsVP8 = aMime === "video/vp8";
      const bIsVP8 = bMime === "video/vp8";

      if (aIsH264 && !bIsH264) return -1;
      if (!aIsH264 && bIsH264) return 1;

      if (aIsH264 && bIsH264) {
        const aFmtp = (a.sdpFmtpLine || "").toLowerCase();
        const bFmtp = (b.sdpFmtpLine || "").toLowerCase();
        const aBaseline = aFmtp.includes("42e01f") || aFmtp.includes("42001f");
        const bBaseline = bFmtp.includes("42e01f") || bFmtp.includes("42001f");
        if (aBaseline && !bBaseline) return -1;
        if (!aBaseline && bBaseline) return 1;
      }

      if (aIsVP8 && !bIsVP8) return -1;
      if (!aIsVP8 && bIsVP8) return 1;

      return 0;
    });

    const orderedCodecs = [...primaryCodecs, ...rtxCodecs, ...otherCodecs];
    transceiver.setCodecPreferences(orderedCodecs);
  } catch (e) {
    console.warn("[WebRTC] setCodecPreferences notice:", e);
  }
}

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

  // Diagnostic states
  const [webrtcDiagStats, setWebrtcDiagStats] = useState<WebRTCDiagnosticData | null>(null);
  const [partnerDiagStats, setPartnerDiagStats] = useState<WebRTCDiagnosticData | null>(null);
  const [, setRemoteTrackRevision] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pcCountRef = useRef(0);
  const currentPcIdRef = useRef(0);
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

  const gatheredCandidatesRef = useRef<{ host: number; srflx: number; relay: number }>({
    host: 0,
    srflx: 0,
    relay: 0,
  });

  const prevStatsRef = useRef<{
    timestamp: number;
    bytesSent: number;
    bytesReceived: number;
    framesEncoded: number;
    framesDecoded: number;
  }>({
    timestamp: Date.now(),
    bytesSent: 0,
    bytesReceived: 0,
    framesEncoded: 0,
    framesDecoded: 0,
  });

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
        console.log(`[WebRTC PC #${currentPcIdRef.current}] Closing previous RTCPeerConnection cleanly`);
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        /* ignore close errors */
      }
      pcRef.current = null;
    }

    const pcId = ++pcCountRef.current;
    currentPcIdRef.current = pcId;
    gatheredCandidatesRef.current = { host: 0, srflx: 0, relay: 0 };
    console.log(`[WebRTC PC #${pcId}] Initialized fresh RTCPeerConnection (role=${isHost ? "HOST" : "VIEWER"}, forceFresh=${forceFresh})`);

    // Clear stale remote media state so dead tracks from old PC don't contaminate new streams
    if (forceFresh) {
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      remoteStreamRef.current = null;
      remoteMovieStreamIdRef.current = null;
      remoteVoiceStreamIdRef.current = null;
      setRemoteStream(null);
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      bundlePolicy: "max-bundle",
      iceCandidatePoolSize: 2,
    });
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        const cType = ev.candidate.type;
        if (cType === "host") gatheredCandidatesRef.current.host++;
        else if (cType === "srflx") gatheredCandidatesRef.current.srflx++;
        else if (cType === "relay") gatheredCandidatesRef.current.relay++;

        console.log(`[WebRTC PC #${pcId} ICE] Candidate gathered (${cType}):`, ev.candidate.candidate);

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

      console.log(`[WebRTC PC #${pcId}] ontrack fired:`, {
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

        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        const rStream = remoteStreamRef.current;
        if (!rStream.getVideoTracks().some((t) => t.id === track.id)) {
          rStream.addTrack(track);
        }

        // CRITICAL: Stable MediaStream identity!
        // Do NOT create new MediaStream instances on every packet or onunmute.
        // A single stable MediaStream reference prevents mobile hardware decoders
        // from resetting and staying black.
        setRemoteStream(rStream);
        updateState("LIVE");

        track.onunmute = () => {
          console.log(`[WebRTC PC #${pcId}] Video track unmuted (media packets flowing):`, track.id);
          updateState("LIVE");
          setRemoteTrackRevision((c) => c + 1);
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
            setRemoteTrackRevision((c) => c + 1);
          }
        };
      } else if (track.kind === "audio") {
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
            remoteStreamRef.current = new MediaStream();
          }
          const rStream = remoteStreamRef.current;
          if (!rStream.getAudioTracks().some((t) => t.id === track.id)) {
            rStream.addTrack(track);
          }
          setRemoteStream(rStream);
          setRemoteTrackRevision((c) => c + 1);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC PC #${pcId}] connectionStateChange:`, {
        connectionState: state,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState,
        senderCount: pc.getSenders().length,
        receiverCount: pc.getReceivers().length,
        isHost,
      });

      if (state === "connected") {
        restartAttemptsRef.current = 0;
        void applyBitrateCap(pc);
        if (isHost && localStreamRef.current) {
          updateState("LIVE");
        }
      } else if (state === "disconnected" || state === "failed") {
        if (isHost && localStreamRef.current?.getVideoTracks().some((t) => t.readyState === "live")) {
          return;
        }

        if (roomStateRef.current === "LIVE" || roomStateRef.current === "STREAM_CONNECTING") {
          updateState("RECONNECTING");
          if (isHost && restartAttemptsRef.current < 5) {
            restartAttemptsRef.current += 1;
            void renegotiateRef.current?.();
          } else if (!isHost) {
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

      pc.getTransceivers().forEach((transceiver) => {
        if (transceiver.sender.track?.kind === "video" || transceiver.receiver.track?.kind === "video") {
          prioritizeMobileSafeCodecs(transceiver);
        }
      });

      const offer = await pc.createOffer();
      const safeOfferSdp = prioritizeCodecsInSdp(offer.sdp || "");
      const modifiedOffer = { type: offer.type, sdp: safeOfferSdp };
      await pc.setLocalDescription(modifiedOffer);

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

      // Prefer tab sharing with audio, constrained to 1080p @ 30fps to prevent overloading mobile decoders
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
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

        pc.getTransceivers().forEach((transceiver) => {
          if (transceiver.sender.track?.kind === "video" || transceiver.receiver.track?.kind === "video") {
            prioritizeMobileSafeCodecs(transceiver);
          }
        });

        const offer = await pc.createOffer();
        const safeOfferSdp = prioritizeCodecsInSdp(offer.sdp || "");
        const modifiedOffer = { type: offer.type, sdp: safeOfferSdp };
        await pc.setLocalDescription(modifiedOffer);

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

          const rawSdp = typeof payload.sdp === "string" ? payload.sdp : payload.sdp?.sdp || "";
          const safeOfferSdp = prioritizeCodecsInSdp(rawSdp);
          await pc.setRemoteDescription(new RTCSessionDescription({
            type: "offer",
            sdp: safeOfferSdp,
          }));
          await flushPendingIce(pc);

          // Defensive receiver track recovery: ensure any newly provisioned receiver track is attached
          pc.getReceivers().forEach((receiver) => {
            const rTrack = receiver.track;
            if (rTrack && rTrack.kind === "video" && rTrack.readyState === "live") {
              if (!remoteStreamRef.current) {
                remoteStreamRef.current = new MediaStream();
              }
              const rStream = remoteStreamRef.current;
              if (!rStream.getVideoTracks().some((t) => t.id === rTrack.id)) {
                rStream.addTrack(rTrack);
                setRemoteStream(rStream);
                updateState("LIVE");
              }
            }
          });

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
          // CRITICAL: DO NOT munge answer SDP per RFC 8829 §5.4!
          // Modifying answer payload types causes WebKit (iOS Safari) and Chromium to throw InvalidModificationError.
          await pc.setLocalDescription(answer);

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
            const answerDesc =
              typeof payload.sdp === "string"
                ? { type: "answer", sdp: payload.sdp }
                : payload.sdp;
            if (answerDesc && answerDesc.sdp) {
              await pc.setRemoteDescription(new RTCSessionDescription(answerDesc));
              await flushPendingIce(pc);
            }
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
      })
      .on("broadcast", { event: "theater:diag-stats" }, ({ payload }: { payload: any }) => {
        if (payload && payload.role && payload.role !== (isHost ? "host" : "viewer")) {
          setPartnerDiagStats(payload as WebRTCDiagnosticData);
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

  // Continuous WebRTC Media Pipeline Diagnostic Engine (Runs every 1000ms)
  useEffect(() => {
    let disposed = false;
    let lastBroadcastTime = 0;

    const diagInterval = setInterval(async () => {
      const pc = pcRef.current;
      const pcId = currentPcIdRef.current;
      const now = Date.now();
      const prev = prevStatsRef.current;
      const deltaTimeSec = Math.max(0.2, (now - prev.timestamp) / 1000);

      const localVTrack = localStreamRef.current?.getVideoTracks()[0];
      const remoteVTrack = remoteStreamRef.current?.getVideoTracks()[0];

      const gatheredStats: {
        outboundVideo?: WebRTCDiagnosticData["outboundVideo"];
        inboundVideo?: WebRTCDiagnosticData["inboundVideo"];
        selectedPair: WebRTCDiagnosticData["ice"]["selectedPair"];
        negotiatedCodec: WebRTCDiagnosticData["negotiatedCodec"];
      } = {
        selectedPair: null,
        negotiatedCodec: null,
      };

      if (pc && pc.signalingState !== "closed") {
        try {
          const stats = await pc.getStats();
          const codecMap = new Map<string, any>();

          stats.forEach((report: any) => {
            if (report.type === "codec") {
              codecMap.set(report.id, report);
            }
            if (report.type === "outbound-rtp" && report.kind === "video") {
              const bytes = report.bytesSent || 0;
              const frames = report.framesEncoded || 0;
              const bitrate = Math.max(0, Math.round(((bytes - prev.bytesSent) * 8) / (deltaTimeSec * 1000)));
              const fps = Math.max(0, Math.round((frames - prev.framesEncoded) / deltaTimeSec));
              prev.bytesSent = bytes;
              prev.framesEncoded = frames;

              gatheredStats.outboundVideo = {
                bytesSent: bytes,
                packetsSent: report.packetsSent || 0,
                framesEncoded: frames,
                keyFramesEncoded: report.keyFramesEncoded,
                frameWidth: report.frameWidth,
                frameHeight: report.frameHeight,
                fps,
                bitrateKbps: bitrate,
              };

              if (report.codecId && codecMap.has(report.codecId)) {
                const c = codecMap.get(report.codecId);
                gatheredStats.negotiatedCodec = {
                  mimeType: c.mimeType,
                  payloadType: c.payloadType,
                  sdpFmtpLine: c.sdpFmtpLine,
                };
              }
            }
            if (report.type === "inbound-rtp" && report.kind === "video") {
              const bytes = report.bytesReceived || 0;
              const frames = report.framesDecoded || 0;
              const bitrate = Math.max(0, Math.round(((bytes - prev.bytesReceived) * 8) / (deltaTimeSec * 1000)));
              const fps = Math.max(0, Math.round((frames - prev.framesDecoded) / deltaTimeSec));
              prev.bytesReceived = bytes;
              prev.framesDecoded = frames;

              gatheredStats.inboundVideo = {
                bytesReceived: bytes,
                packetsReceived: report.packetsReceived || 0,
                framesReceived: report.framesReceived || 0,
                framesDecoded: frames,
                framesDropped: report.framesDropped || 0,
                frameWidth: report.frameWidth,
                frameHeight: report.frameHeight,
                fps,
                bitrateKbps: bitrate,
              };

              if (report.codecId && codecMap.has(report.codecId)) {
                const c = codecMap.get(report.codecId);
                gatheredStats.negotiatedCodec = {
                  mimeType: c.mimeType,
                  payloadType: c.payloadType,
                  sdpFmtpLine: c.sdpFmtpLine,
                };
              }
            }
            if (report.type === "candidate-pair" && (report.state === "succeeded" || report.nominated)) {
              const pairInfo: NonNullable<WebRTCDiagnosticData["ice"]["selectedPair"]> = {
                state: report.state,
                localType: "unknown",
                remoteType: "unknown",
                localAddress: "hidden",
                remoteAddress: "hidden",
                currentRoundTripTime: report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : undefined,
                bytesSent: report.bytesSent || 0,
                bytesReceived: report.bytesReceived || 0,
                relayActive: false,
              };
              stats.forEach((cand: any) => {
                if (cand.id === report.localCandidateId) {
                  pairInfo.localType = cand.candidateType || "unknown";
                  pairInfo.localAddress = cand.address ? `${cand.address}:${cand.port}` : cand.ip || "hidden";
                }
                if (cand.id === report.remoteCandidateId) {
                  pairInfo.remoteType = cand.candidateType || "unknown";
                  pairInfo.remoteAddress = cand.address ? `${cand.address}:${cand.port}` : cand.ip || "hidden";
                }
              });
              pairInfo.relayActive = pairInfo.localType === "relay" || pairInfo.remoteType === "relay";
              gatheredStats.selectedPair = pairInfo;
            }
          });
        } catch {
          // ignore stats gathering error during pc transitions
        }
      }

      const outboundVideo = gatheredStats.outboundVideo;
      const inboundVideo = gatheredStats.inboundVideo;
      const selectedPair = gatheredStats.selectedPair;
      const negotiatedCodec = gatheredStats.negotiatedCodec;

      prev.timestamp = now;

      // Video element metrics
      let videoElementStats: WebRTCDiagnosticData["videoElement"] = null;
      if (typeof document !== "undefined") {
        const vEl = document.querySelector("video");
        if (vEl) {
          videoElementStats = {
            videoWidth: vEl.videoWidth || 0,
            videoHeight: vEl.videoHeight || 0,
            readyState: vEl.readyState || 0,
            paused: vEl.paused,
            muted: vEl.muted,
            currentTime: Math.round(vEl.currentTime || 0),
          };
        }
      }

      // Hard Failure Matrix Classification
      let matrixCase: FailureMatrixCase = "IDLE";
      let matrixSummary = "Idle";

      if (isHost) {
        if (localStreamRef.current) {
          if (outboundVideo && outboundVideo.framesEncoded === 0) {
            matrixCase = "CASE_D_SOURCE_CAPTURE_FAILURE";
            matrixSummary = "CASE D: Host screen capture active but 0 frames encoded (source track stalled)";
          } else if (outboundVideo && outboundVideo.framesEncoded > 0) {
            matrixCase = "HEALTHY_STREAMING";
            matrixSummary = `Host encoding ${outboundVideo.fps || 0} fps (${outboundVideo.frameWidth || 0}x${outboundVideo.frameHeight || 0})`;
          } else {
            matrixCase = "CONNECTING";
            matrixSummary = "Host preparing stream transmission...";
          }
        }
      } else {
        const connState = pc?.connectionState;
        if (!pc || connState === "new" || connState === "connecting") {
          matrixCase = "CONNECTING";
          matrixSummary = "WebRTC peer connection establishing...";
        } else if (!remoteVTrack) {
          matrixCase = "CASE_E_NEGOTIATION_FAILURE";
          matrixSummary = "CASE E: WebRTC peer connection established but remote video track never received (ontrack never fired)";
        } else if (inboundVideo && inboundVideo.bytesReceived === 0 && (partnerDiagStats?.outboundVideo?.bytesSent || 0) > 0) {
          matrixCase = "CASE_A_TRANSPORT_FAILURE";
          matrixSummary = "CASE A: Host is transmitting RTP, but Viewer bytesReceived is 0 (NAT/TURN/Firewall blockage)";
        } else if (inboundVideo && inboundVideo.bytesReceived > 0 && inboundVideo.framesReceived > 0 && inboundVideo.framesDecoded === 0) {
          matrixCase = "CASE_B_CODEC_DECODE_FAILURE";
          matrixSummary = "CASE B: Inbound RTP packets arriving, but 0 frames decoded (Codec / SDP payload mismatch)";
        } else if (inboundVideo && inboundVideo.framesDecoded > 0 && videoElementStats && videoElementStats.videoWidth > 0) {
          matrixCase = "HEALTHY_STREAMING";
          matrixSummary = `Decoded ${inboundVideo.framesDecoded} frames (${inboundVideo.fps || 0} fps, ${inboundVideo.frameWidth || 0}x${inboundVideo.frameHeight || 0})`;
        } else {
          matrixCase = "CONNECTING";
          matrixSummary = "Awaiting media decoding...";
        }
      }

      const diag: WebRTCDiagnosticData = {
        timestamp: now,
        role: isHost ? "host" : "viewer",
        pcId,
        connectionState: pc?.connectionState || "none",
        iceConnectionState: pc?.iceConnectionState || "none",
        iceGatheringState: pc?.iceGatheringState || "none",
        signalingState: pc?.signalingState || "none",
        failureMatrixCase: matrixCase,
        failureMatrixSummary: matrixSummary,
        localVideoTrack: localVTrack ? {
          id: localVTrack.id,
          readyState: localVTrack.readyState,
          enabled: localVTrack.enabled,
          muted: localVTrack.muted,
          settings: typeof localVTrack.getSettings === "function" ? localVTrack.getSettings() : undefined,
        } : null,
        remoteVideoTrack: remoteVTrack ? {
          id: remoteVTrack.id,
          readyState: remoteVTrack.readyState,
          enabled: remoteVTrack.enabled,
          muted: remoteVTrack.muted,
        } : null,
        outboundVideo,
        inboundVideo,
        ice: {
          candidatesGathered: { ...gatheredCandidatesRef.current },
          selectedPair,
        },
        negotiatedCodec,
        videoElement: videoElementStats,
      };

      if (!disposed) {
        setWebrtcDiagStats(diag);
        if (typeof window !== "undefined") {
          (window as any).__WEBRTC_STATS = diag;
          (window as any).__WEBRTC_DIAG = () => diag;
        }

        if (now - lastBroadcastTime > 2500 && channelRef.current && isSubscribedRef.current) {
          lastBroadcastTime = now;
          void channelRef.current.send({
            type: "broadcast",
            event: "theater:diag-stats",
            payload: diag,
          });
        }
      }
    }, 1000);

    return () => {
      disposed = true;
      clearInterval(diagInterval);
    };
  }, [isHost, partnerDiagStats]);

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
    webrtcDiagStats,
    partnerDiagStats,
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
