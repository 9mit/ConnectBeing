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

export interface WebRTCSignalingDiag {
  offerId: string | null;
  // Host metrics
  offerCreated?: boolean;
  offerSent?: boolean;
  answerReceived?: boolean;
  answerApplied?: boolean;
  answerApplyError?: string | null;
  // Viewer metrics
  offerReceived?: boolean;
  offerApplied?: boolean;
  offerApplyError?: string | null;
  answerCreated?: boolean;
  answerSent?: boolean;
  offerReceivedForPcId?: number;
  answerCreatedForPcId?: number;
  answerSentForPcId?: number;
}

export interface WebRTCTurnDiag {
  turnConfiguredServerSide: boolean;
  turnConfigDeliveredToBrowser: boolean;
  iceServerCount: number;
  stunServerCount: number;
  turnServerCount: number;
  turnTransports: string[];
  forcedRelayMode: boolean;
}

export interface WebRTCIceDiag {
  candidatesGathered: { host: number; srflx: number; relay: number };
  remoteCandidatesReceived: { host: number; srflx: number; relay: number; total: number };
  remoteCandidatesAdded: number;
  candidateErrors: number;
  lastCandidateError?: string | null;
  selectedPair?: {
    state: string;
    localType: string;
    remoteType: string;
    localAddress: string;
    remoteAddress: string;
    currentRoundTripTime?: number;
    bytesSent: number;
    bytesReceived: number;
    availableOutgoingBitrate?: number;
    availableIncomingBitrate?: number;
    relayActive: boolean;
  } | null;
}

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
  signaling: WebRTCSignalingDiag;
  turn: WebRTCTurnDiag;
  ice: WebRTCIceDiag;
  localVideoTrack?: {
    id: string;
    readyState: MediaStreamTrackState;
    enabled: boolean;
    muted: boolean;
    settings?: MediaTrackSettings;
    contentHint?: string;
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
    framesSent?: number;
    retransmittedPacketsSent?: number;
    nackCount?: number;
    pliCount?: number;
    firCount?: number;
    frameWidth?: number;
    frameHeight?: number;
    fps?: number;
    nativeFps?: number;
    bitrateKbps?: number;
    qpSum?: number;
    totalEncodeTime?: number;
    encoderImplementation?: string;
    qualityLimitationReason?: string;
    qualityLimitationDurations?: Record<string, number>;
    qualityLimitationResolutionChanges?: number;
    remoteInbound?: {
      packetsLost?: number;
      jitter?: number;
      roundTripTime?: number;
    };
  };
  inboundVideo?: {
    bytesReceived: number;
    packetsReceived: number;
    packetsLost?: number;
    framesReceived: number;
    framesDecoded: number;
    framesDropped: number;
    keyFramesDecoded?: number;
    frameWidth?: number;
    frameHeight?: number;
    fps?: number;
    nativeFps?: number;
    bitrateKbps?: number;
    jitter?: number;
    jitterBufferDelay?: number;
    jitterBufferEmittedCount?: number;
    jitterBufferDelayAvgMs?: number;
    totalDecodeTime?: number;
    freezeCount?: number;
    totalFreezesDuration?: number;
    decoderImplementation?: string;
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
  adaptiveQuality?: {
    currentProfile: string;
    targetProfile: string | null;
    consecutiveUpgradeMeasurements: number;
    sourceWidth: number;
    sourceHeight: number;
    measuredBandwidthKbps: number;
    measuredRttMs: number;
    appliedMaxBitrate: number;
    appliedMaxFramerate: number;
    appliedScaleDown: number;
  };
}

export type AdaptiveQualityProfile = "ULTRA" | "HIGH" | "MEDIUM" | "LOW" | "MINIMUM";

export interface TheaterWebRTCProps {
  sessionId: string;
  userId: string;
  isHost: boolean;
  initialHostStreamActive?: boolean;
  onStateChange?: (state: TheaterRoomState) => void;
  onDriftCorrect?: (remotePos: number) => void;
  isDiagOpen?: boolean;
}

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
  // OpenRelay Public TURN (Always valid with 'openrelayproject' credentials)
  {
    urls: [
      "turn:openrelay.metered.ca:3478",
      "turn:openrelay.metered.ca:3478?transport=tcp",
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
      "turns:openrelay.metered.ca:443",
      "turns:openrelay.metered.ca:5349",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  // Custom Metered TURN (Only if environment credentials provided)
  ...(process.env.NEXT_PUBLIC_TURN_USERNAME && process.env.NEXT_PUBLIC_TURN_CREDENTIAL
    ? [
        {
          urls: [
            "turn:a.relay.metered.ca:3478",
            "turn:a.relay.metered.ca:3478?transport=tcp",
            "turn:a.relay.metered.ca:80",
            "turn:a.relay.metered.ca:443",
            "turn:a.relay.metered.ca:443?transport=tcp",
            "turns:a.relay.metered.ca:443",
            "turns:a.relay.metered.ca:5349",
          ],
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        },
      ]
    : []),
];

/**
 * Inspects ICE servers configuration safely WITHOUT revealing passwords or secrets
 */
function inspectIceServers(servers: RTCIceServer[]) {
  let stunCount = 0;
  let turnCount = 0;
  const transports = new Set<string>();

  for (const s of servers) {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    for (const u of urls) {
      if (u.startsWith("stun:") || u.startsWith("stuns:")) {
        stunCount++;
      } else if (u.startsWith("turn:") || u.startsWith("turns:")) {
        turnCount++;
        if (u.startsWith("turns:")) transports.add("tls");
        if (u.includes("transport=tcp")) transports.add("tcp");
        else transports.add("udp");
      }
    }
  }

  return {
    iceServerCount: servers.length,
    stunServerCount: stunCount,
    turnServerCount: turnCount,
    turnTransports: Array.from(transports),
  };
}

/**
 * Deduplicates ICE servers list by sorted URLs and username
 */
function deduplicateIceServers(servers: RTCIceServer[]): RTCIceServer[] {
  const seen = new Set<string>();
  const result: RTCIceServer[] = [];
  for (const s of servers) {
    const urls = Array.isArray(s.urls) ? [...s.urls].sort().join(",") : s.urls;
    const key = `${urls}|${s.username || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(s);
    }
  }
  return result;
}

/**
 * Parses ICE candidate type from candidate string per RFC 5245 §15.1
 */
function parseCandidateType(candStr?: string): "host" | "srflx" | "relay" | "unknown" {
  if (!candStr) return "unknown";
  const match = candStr.match(/typ\s+(\w+)/i);
  if (match && match[1]) {
    const t = match[1].toLowerCase();
    if (t === "host" || t === "srflx" || t === "relay") return t;
  }
  return "unknown";
}

/**
 * Standardized WebRTC Diagnostic Logger
 * Explicitly logs ONLY: sessionId, peer role, pcId, offerId, event name,
 * signalingState, connectionState, iceConnectionState, candidate type.
 * STRICTLY NEVER logs TURN credentials, passwords, tokens, or cookies.
 */
function emitDiagnosticLog(params: {
  sessionId: string;
  role: "host" | "viewer";
  pcId: number;
  offerId: string | null;
  eventName: string;
  signalingState: string;
  connectionState: string;
  iceConnectionState: string;
  candidateType?: string;
  details?: Record<string, unknown>;
}) {
  const safeDetails: Record<string, unknown> = {};
  if (params.details) {
    for (const [k, v] of Object.entries(params.details)) {
      const lower = k.toLowerCase();
      if (
        lower.includes("pass") ||
        lower.includes("secret") ||
        lower.includes("cred") ||
        lower.includes("token") ||
        lower.includes("cookie") ||
        lower.includes("auth")
      ) {
        continue;
      }
      safeDetails[k] = v;
    }
  }

  console.log(`[WebRTC-DIAG] [${params.role.toUpperCase()}] ${params.eventName}`, {
    sessionId: params.sessionId,
    role: params.role,
    pcId: params.pcId,
    offerId: params.offerId ?? "none",
    eventName: params.eventName,
    signalingState: params.signalingState,
    connectionState: params.connectionState,
    iceConnectionState: params.iceConnectionState,
    candidateType: params.candidateType ?? "none",
    ...safeDetails,
  });
}

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
  isDiagOpen = false,
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

  // Diagnostic states & refs for low-frequency UI decoupling
  const [webrtcDiagStats, setWebrtcDiagStats] = useState<WebRTCDiagnosticData | null>(null);
  const webrtcDiagStatsRef = useRef<WebRTCDiagnosticData | null>(null);
  const [partnerDiagStats, setPartnerDiagStats] = useState<WebRTCDiagnosticData | null>(null);
  const partnerDiagStatsRef = useRef<WebRTCDiagnosticData | null>(null);
  const lastPartnerStatsUpdateTimeRef = useRef<number>(0);
  const lastUiUpdateTimeRef = useRef<number>(0);
  const lastMatrixCaseRef = useRef<FailureMatrixCase | null>(null);
  const isDiagOpenRef = useRef(isDiagOpen);

  useEffect(() => {
    isDiagOpenRef.current = isDiagOpen;
    if (isDiagOpen) {
      if (webrtcDiagStatsRef.current) setWebrtcDiagStats(webrtcDiagStatsRef.current);
      if (partnerDiagStatsRef.current) setPartnerDiagStats(partnerDiagStatsRef.current);
    }
  }, [isDiagOpen]);

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
  const offerSentTimestampRef = useRef<number>(0);
  const pendingRenegotiateRef = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVoiceRef = useRef<MediaStream | null>(null);
  const remoteVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteMovieStreamIdRef = useRef<string | null>(null);
  const remoteVoiceStreamIdRef = useRef<string | null>(null);
  const streamSourceTypeRef = useRef<"tab" | "window" | "screen" | "none">(streamSourceType);
  streamSourceTypeRef.current = streamSourceType;

  // Diagnostic tracking refs
  const signalingDiagRef = useRef<WebRTCSignalingDiag>({
    offerId: null,
    offerCreated: false,
    offerSent: false,
    answerReceived: false,
    answerApplied: false,
    answerApplyError: null,
    offerReceived: false,
    offerApplied: false,
    offerApplyError: null,
    answerCreated: false,
    answerSent: false,
  });

  const turnDiagRef = useRef<WebRTCTurnDiag>({
    turnConfiguredServerSide: false,
    turnConfigDeliveredToBrowser: false,
    iceServerCount: 0,
    stunServerCount: 0,
    turnServerCount: 0,
    turnTransports: [],
    forcedRelayMode: false,
  });

  const iceDiagRef = useRef<{
    remoteCandidatesReceived: { host: number; srflx: number; relay: number; total: number };
    remoteCandidatesAdded: number;
    candidateErrors: number;
    lastCandidateError: string | null;
  }>({
    remoteCandidatesReceived: { host: 0, srflx: 0, relay: 0, total: 0 },
    remoteCandidatesAdded: 0,
    candidateErrors: 0,
    lastCandidateError: null,
  });

  // Forced Relay Diagnostic Control (temporary test mode)
  const [forceRelay, setForceRelay] = useState(false);
  const forceRelayRef = useRef(forceRelay);
  forceRelayRef.current = forceRelay;

  const adaptiveQualityRef = useRef<{
    currentProfile: AdaptiveQualityProfile;
    consecutiveUpgradeMeasurements: number;
    lastProfileChangeTime: number;
    targetProfile: AdaptiveQualityProfile | null;
  }>({
    currentProfile: "HIGH",
    consecutiveUpgradeMeasurements: 0,
    lastProfileChangeTime: 0,
    targetProfile: null,
  });

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
    }).then((res) => {
      if (res && res !== "ok") {
        console.warn(`[WebRTC Realtime] Broadcast '${event}' response: ${res}`);
      }
    }).catch((err) => {
      console.error(`[WebRTC Realtime] Broadcast '${event}' failed:`, err);
    });
  }, [userId]);

  // Apply bitrate and motion cadence optimization for movie screen sharing
  const applyBitrateCap = useCallback(async (pc: RTCPeerConnection, maxKbps = 2500) => {
    try {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (!sender) return;
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        return;
      }
      try {
        (params as any).degradationPreference = "maintain-framerate";
      } catch {
        // ignore if degradationPreference not supported
      }
      params.encodings[0]!.maxBitrate = maxKbps * 1000;
      params.encodings[0]!.maxFramerate = 30;
      params.encodings[0]!.scaleResolutionDownBy = 1.0;
      await sender.setParameters(params);
    } catch {
      // Fallback 1: try setting with framerate cap and degradationPreference without scaleResolutionDownBy if rejected
      try {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (!sender) return;
        const params = sender.getParameters();
        if (params.encodings && params.encodings.length > 0) {
          try {
            (params as any).degradationPreference = "maintain-framerate";
          } catch {}
          params.encodings[0]!.maxBitrate = maxKbps * 1000;
          params.encodings[0]!.maxFramerate = 30;
          await sender.setParameters(params);
        }
      } catch {
        // Fallback 2: try setting just bitrate if advanced parameters rejected by browser
        try {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (!sender) return;
          const params = sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0]!.maxBitrate = maxKbps * 1000;
            await sender.setParameters(params);
          }
        } catch {
          // Bitrate parameter setting unsupported or renegotiating
        }
      }
    }
  }, []);

  // Flush queued ICE candidates after remote description is set
  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    const queue = [...pendingIceRef.current];
    pendingIceRef.current = [];
    for (const cand of queue) {
      const cType = parseCandidateType(cand.candidate);
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
        iceDiagRef.current.remoteCandidatesAdded++;
        emitDiagnosticLog({
          sessionId,
          role: isHost ? "host" : "viewer",
          pcId: currentPcIdRef.current,
          offerId: activeOfferIdRef.current,
          eventName: "ice-candidate-flushed-success",
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          candidateType: cType,
        });
      } catch (err: unknown) {
        iceDiagRef.current.candidateErrors++;
        const errMsg = err instanceof Error ? err.message : String(err);
        iceDiagRef.current.lastCandidateError = errMsg;
        emitDiagnosticLog({
          sessionId,
          role: isHost ? "host" : "viewer",
          pcId: currentPcIdRef.current,
          offerId: activeOfferIdRef.current,
          eventName: "ice-candidate-flushed-error",
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          candidateType: cType,
          details: { error: errMsg },
        });
      }
    }
  }, [isHost, sessionId]);

  // Initialize or re-create PeerConnection cleanly
  const getOrCreatePc = useCallback((forceFresh = false) => {
    if (!forceFresh && pcRef.current && pcRef.current.signalingState !== "closed") {
      return pcRef.current;
    }

    if (pcRef.current) {
      try {
        emitDiagnosticLog({
          sessionId,
          role: isHost ? "host" : "viewer",
          pcId: currentPcIdRef.current,
          offerId: activeOfferIdRef.current,
          eventName: "closing-previous-pc",
          signalingState: pcRef.current.signalingState,
          connectionState: pcRef.current.connectionState,
          iceConnectionState: pcRef.current.iceConnectionState,
        });
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

    const inspectedServers = inspectIceServers(iceServersRef.current);
    emitDiagnosticLog({
      sessionId,
      role: isHost ? "host" : "viewer",
      pcId,
      offerId: activeOfferIdRef.current,
      eventName: "initialized-fresh-pc",
      signalingState: "new",
      connectionState: "new",
      iceConnectionState: "new",
      details: {
        forceFresh,
        forcedRelay: forceRelayRef.current,
        iceServerCount: inspectedServers.iceServerCount,
        stunServerCount: inspectedServers.stunServerCount,
        turnServerCount: inspectedServers.turnServerCount,
        turnTransports: inspectedServers.turnTransports,
      },
    });

    // Clear stale remote media state and queued candidates only on explicit fresh teardown
    if (forceFresh) {
      pendingIceRef.current = [];
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
      iceTransportPolicy: forceRelayRef.current ? "relay" : "all",
    });
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        const cType = ev.candidate.type || parseCandidateType(ev.candidate.candidate);
        if (cType === "host") gatheredCandidatesRef.current.host++;
        else if (cType === "srflx") gatheredCandidatesRef.current.srflx++;
        else if (cType === "relay") gatheredCandidatesRef.current.relay++;

        emitDiagnosticLog({
          sessionId,
          role: isHost ? "host" : "viewer",
          pcId,
          offerId: activeOfferIdRef.current,
          eventName: "ice-candidate-gathered",
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          candidateType: cType,
        });

        sendSignal("theater:ice-candidate", {
          candidate: ev.candidate.toJSON(),
          offerId: activeOfferIdRef.current,
          pcId,
        });
      }
    };

    pc.ontrack = (ev) => {
      const track = ev.track;
      const associatedStream = ev.streams[0];
      const streamId = associatedStream?.id;

      emitDiagnosticLog({
        sessionId,
        role: isHost ? "host" : "viewer",
        pcId,
        offerId: activeOfferIdRef.current,
        eventName: "ontrack-fired",
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        details: {
          kind: track.kind,
          trackId: track.id,
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted,
          streamId,
        },
      });

      if (track.kind === "video") {
        if ("contentHint" in track) {
          (track as any).contentHint = "motion";
        }

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
        setRemoteStream(rStream);
        updateState("LIVE");

        track.onunmute = () => {
          emitDiagnosticLog({
            sessionId,
            role: isHost ? "host" : "viewer",
            pcId,
            offerId: activeOfferIdRef.current,
            eventName: "track-unmuted",
            signalingState: pc.signalingState,
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
            details: { trackId: track.id },
          });
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
      emitDiagnosticLog({
        sessionId,
        role: isHost ? "host" : "viewer",
        pcId,
        offerId: activeOfferIdRef.current,
        eventName: "connection-state-change",
        signalingState: pc.signalingState,
        connectionState: state,
        iceConnectionState: pc.iceConnectionState,
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
  }, [applyBitrateCap, isHost, sendSignal, sessionId, updateState]);

  const lastRenegotiateTimeRef = useRef<number>(0);

  // Host renegotiation logic when Viewer announces presence/readiness
  // CRITICAL FIX: Never destroy an in-flight PC while it is awaiting an answer (have-local-offer)
  const renegotiateForViewer = useCallback(async (targetViewerId?: string) => {
    if (!isHost || !localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") return;
    if ("contentHint" in videoTrack) {
      (videoTrack as any).contentHint = "motion";
    }

    const pc = pcRef.current;

    // 1. If existing PC is already connected, re-announce stream state without destroying PC
    if (pc && pc.connectionState === "connected") {
      emitDiagnosticLog({
        sessionId,
        role: "host",
        pcId: currentPcIdRef.current,
        offerId: activeOfferIdRef.current,
        eventName: "renegotiate-skipped-already-connected",
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
      sendSignal("theater:stream-state", {
        state: "LIVE",
        surface: streamSourceTypeRef.current || "tab",
      });
      void applyBitrateCap(pc);
      return;
    }

    // 2. If existing PC is currently awaiting answer (have-local-offer)
    // DO NOT destroy the PC! That destroys the offer before the viewer can answer.
    if (pc && pc.signalingState === "have-local-offer") {
      const elapsedSinceOffer = Date.now() - offerSentTimestampRef.current;
      if (elapsedSinceOffer < 10000) {
        emitDiagnosticLog({
          sessionId,
          role: "host",
          pcId: currentPcIdRef.current,
          offerId: activeOfferIdRef.current,
          eventName: "renegotiate-resending-existing-offer",
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          details: { elapsedMs: elapsedSinceOffer, targetViewerId: targetViewerId ?? "broadcast" },
        });

        // Re-transmit existing offer to the target viewer or broadcast
        sendSignal("theater:offer", {
          sdp: pc.localDescription,
          surface: streamSourceTypeRef.current || "tab",
          offerId: activeOfferIdRef.current,
          targetViewerId,
          pcId: currentPcIdRef.current,
          movieStreamId: localStreamRef.current?.id,
          voiceStreamId: localVoiceRef.current?.id,
        });
        return;
      }
      // If elapsed >= 10000ms, offer timed out; fall through to create a fresh offer.
    }

    // 3. If existing PC is in 'stable' signaling state and ICE is actively connecting/checking
    // DO NOT interrupt in-flight ICE connection checks with a new offer!
    if (
      pc &&
      pc.signalingState === "stable" &&
      (pc.connectionState === "connecting" || pc.iceConnectionState === "checking")
    ) {
      const elapsedSinceOffer = Date.now() - offerSentTimestampRef.current;
      if (elapsedSinceOffer < 15000) {
        emitDiagnosticLog({
          sessionId,
          role: "host",
          pcId: currentPcIdRef.current,
          offerId: activeOfferIdRef.current,
          eventName: "renegotiate-skipped-ice-in-flight",
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          details: { elapsedMs: elapsedSinceOffer, targetViewerId: targetViewerId ?? "broadcast" },
        });
        return;
      }
    }

    // 4. Concurrency protection & debouncing
    const now = Date.now();
    if (makingOfferRef.current) {
      pendingRenegotiateRef.current = true;
      return;
    }
    if (now - lastRenegotiateTimeRef.current < 1000) {
      pendingRenegotiateRef.current = true;
      return;
    }
    lastRenegotiateTimeRef.current = now;
    makingOfferRef.current = true;

    try {
      // Only instantiate fresh PC if none exists, or closed, or failed, or offer explicitly timed out
      const needFresh =
        !pcRef.current ||
        pcRef.current.signalingState === "closed" ||
        pcRef.current.connectionState === "failed" ||
        pcRef.current.connectionState === "disconnected" ||
        (pcRef.current.signalingState === "have-local-offer" && (now - offerSentTimestampRef.current >= 10000));

      const activePc = getOrCreatePc(needFresh);

      // Add movie stream tracks if not already added
      const senders = activePc.getSenders();
      localStreamRef.current.getTracks().forEach((track) => {
        if (track.readyState === "live") {
          const alreadyAdded = senders.some((s) => s.track?.id === track.id);
          if (!alreadyAdded) {
            try {
              activePc.addTrack(track, localStreamRef.current!);
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
              activePc.addTrack(vTrack, localVoiceRef.current);
            } catch {
              // ignore duplicate track
            }
          }
        }
      }

      void applyBitrateCap(activePc);

      const offerId = `off_${sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      activeOfferIdRef.current = offerId;
      offerSentTimestampRef.current = Date.now();

      // Diagnostic tracking
      signalingDiagRef.current.offerId = offerId;
      signalingDiagRef.current.offerCreated = true;
      signalingDiagRef.current.offerSent = false;
      signalingDiagRef.current.answerReceived = false;
      signalingDiagRef.current.answerApplied = false;
      signalingDiagRef.current.answerApplyError = null;

      activePc.getTransceivers().forEach((transceiver) => {
        if (transceiver.sender.track?.kind === "video" || transceiver.receiver.track?.kind === "video") {
          prioritizeMobileSafeCodecs(transceiver);
        }
      });

      emitDiagnosticLog({
        sessionId,
        role: "host",
        pcId: currentPcIdRef.current,
        offerId,
        eventName: "creating-offer",
        signalingState: activePc.signalingState,
        connectionState: activePc.connectionState,
        iceConnectionState: activePc.iceConnectionState,
      });

      const offer = await activePc.createOffer();
      const safeOfferSdp = prioritizeCodecsInSdp(offer.sdp || "");
      const modifiedOffer = { type: offer.type, sdp: safeOfferSdp };
      await activePc.setLocalDescription(modifiedOffer);

      emitDiagnosticLog({
        sessionId,
        role: "host",
        pcId: currentPcIdRef.current,
        offerId,
        eventName: "set-local-description-offer",
        signalingState: activePc.signalingState,
        connectionState: activePc.connectionState,
        iceConnectionState: activePc.iceConnectionState,
      });

      // Wait up to 300ms for initial STUN/TURN candidates to gather into localDescription
      await new Promise<void>((resolve) => {
        if (activePc.iceGatheringState === "complete") {
          resolve();
        } else {
          const check = () => {
            if (activePc.iceGatheringState === "complete") {
              activePc.removeEventListener("icegatheringstatechange", check);
              resolve();
            }
          };
          activePc.addEventListener("icegatheringstatechange", check);
          setTimeout(() => {
            activePc.removeEventListener("icegatheringstatechange", check);
            resolve();
          }, 300);
        }
      });

      signalingDiagRef.current.offerSent = true;

      emitDiagnosticLog({
        sessionId,
        role: "host",
        pcId: currentPcIdRef.current,
        offerId,
        eventName: "offer-sent",
        signalingState: activePc.signalingState,
        connectionState: activePc.connectionState,
        iceConnectionState: activePc.iceConnectionState,
        details: { targetViewerId: targetViewerId ?? "broadcast" },
      });

      sendSignal("theater:offer", {
        sdp: activePc.localDescription || offer,
        surface: streamSourceTypeRef.current || "tab",
        offerId,
        targetViewerId,
        pcId: currentPcIdRef.current,
        movieStreamId: localStreamRef.current?.id,
        voiceStreamId: localVoiceRef.current?.id,
      });

      sendSignal("theater:stream-state", {
        state: "LIVE",
        surface: streamSourceTypeRef.current || "tab",
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      signalingDiagRef.current.answerApplyError = errMsg;
      emitDiagnosticLog({
        sessionId,
        role: "host",
        pcId: currentPcIdRef.current,
        offerId: activeOfferIdRef.current,
        eventName: "create-offer-error",
        signalingState: pcRef.current?.signalingState || "none",
        connectionState: pcRef.current?.connectionState || "none",
        iceConnectionState: pcRef.current?.iceConnectionState || "none",
        details: { error: errMsg },
      });
      console.error("[WebRTC Host] Failed creating renegotiated offer:", err);
    } finally {
      makingOfferRef.current = false;
      if (pendingRenegotiateRef.current) {
        pendingRenegotiateRef.current = false;
        // Schedule next renegotiation ONLY if PC is not currently awaiting answer
        const currentPc = pcRef.current;
        if (currentPc && currentPc.signalingState !== "have-local-offer") {
          setTimeout(() => {
            void renegotiateForViewer();
          }, 1500);
        }
      }
    }
  }, [applyBitrateCap, getOrCreatePc, isHost, sendSignal, sessionId]);

  // Viewer announces readiness to host
  const sendViewerReady = useCallback(() => {
    if (isHost) return;
    emitDiagnosticLog({
      sessionId,
      role: "viewer",
      pcId: currentPcIdRef.current,
      offerId: activeOfferIdRef.current,
      eventName: "send-viewer-ready",
      signalingState: pcRef.current?.signalingState || "none",
      connectionState: pcRef.current?.connectionState || "none",
      iceConnectionState: pcRef.current?.iceConnectionState || "none",
    });
    sendSignal("theater:viewer-ready", {
      viewerUserId: userId,
      timestamp: Date.now(),
    });
  }, [isHost, sendSignal, sessionId, userId]);

  renegotiateRef.current = renegotiateForViewer;
  sendViewerReadyRef.current = sendViewerReady;

  // Toggle forced relay mode for diagnostic control test
  const toggleForceRelay = useCallback(() => {
    setForceRelay((prev) => {
      const next = !prev;
      forceRelayRef.current = next;
      console.log(`[WebRTC] Forced Relay Diagnostic mode changed to: ${next ? "RELAY ONLY" : "ALL"}`);

      // Recreate PC fresh with new iceTransportPolicy because W3C spec prohibits changing it on existing PC
      if (isHost) {
        if (localStreamRef.current) {
          const pc = getOrCreatePc(true);
          localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
          });
          if (localVoiceRef.current) {
            const vTrack = localVoiceRef.current.getAudioTracks()[0];
            if (vTrack && vTrack.readyState === "live") {
              pc.addTrack(vTrack, localVoiceRef.current);
            }
          }
          void renegotiateRef.current?.();
        }
      } else {
        getOrCreatePc(true);
        sendViewerReadyRef.current?.();
      }
      return next;
    });
  }, [getOrCreatePc, isHost]);

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
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "browser",
            frameRate: { ideal: 30, max: 30 },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
          },
          audio: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 30 },
            width: { max: 1920 },
            height: { max: 1080 },
          },
          audio: true,
        });
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        throw new Error("Captured stream does not contain a live video track.");
      }

      // CRITICAL: Set contentHint = 'motion' to switch Chromium from kScreenshare to kRealtimeVideo.
      // This enables motion pacer smoothing and maintains stable 30 FPS clock instead of damage-rect throttling.
      if ("contentHint" in videoTrack) {
        (videoTrack as any).contentHint = "motion";
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

      // Pre-configure sender bitrate, 30 FPS cap, and downscaling
      void applyBitrateCap(pc);

      // Create offer
      makingOfferRef.current = true;
      try {
        const offerId = `off_${sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        activeOfferIdRef.current = offerId;
        offerSentTimestampRef.current = Date.now();

        signalingDiagRef.current.offerId = offerId;
        signalingDiagRef.current.offerCreated = true;
        signalingDiagRef.current.offerSent = false;
        signalingDiagRef.current.answerReceived = false;
        signalingDiagRef.current.answerApplied = false;
        signalingDiagRef.current.answerApplyError = null;

        pc.getTransceivers().forEach((transceiver) => {
          if (transceiver.sender.track?.kind === "video" || transceiver.receiver.track?.kind === "video") {
            prioritizeMobileSafeCodecs(transceiver);
          }
        });

        emitDiagnosticLog({
          sessionId,
          role: "host",
          pcId: currentPcIdRef.current,
          offerId,
          eventName: "host-screenshare-create-offer",
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
        });

        const offer = await pc.createOffer();
        const safeOfferSdp = prioritizeCodecsInSdp(offer.sdp || "");
        const modifiedOffer = { type: offer.type, sdp: safeOfferSdp };
        await pc.setLocalDescription(modifiedOffer);

        emitDiagnosticLog({
          sessionId,
          role: "host",
          pcId: currentPcIdRef.current,
          offerId,
          eventName: "set-local-description-offer",
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
        });

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

        signalingDiagRef.current.offerSent = true;

        emitDiagnosticLog({
          sessionId,
          role: "host",
          pcId: currentPcIdRef.current,
          offerId,
          eventName: "offer-sent",
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          details: { surface: detectedSurface },
        });

        sendSignal("theater:offer", {
          sdp: pc.localDescription || offer,
          surface: detectedSurface,
          offerId,
          pcId: currentPcIdRef.current,
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
  }, [applyBitrateCap, getOrCreatePc, sendSignal, sessionId, stopScreenShare, updateState]);

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
        if (isHost) return;

        signalingDiagRef.current.offerReceived = true;
        signalingDiagRef.current.offerId = payload.offerId || null;
        signalingDiagRef.current.offerReceivedForPcId = currentPcIdRef.current;

        emitDiagnosticLog({
          sessionId,
          role: "viewer",
          pcId: currentPcIdRef.current,
          offerId: payload.offerId,
          eventName: "offer-received",
          signalingState: pcRef.current?.signalingState || "none",
          connectionState: pcRef.current?.connectionState || "none",
          iceConnectionState: pcRef.current?.iceConnectionState || "none",
          details: { hostPcId: payload.pcId, offerId: payload.offerId },
        });

        try {
          // If already processing or connected with this offerId, avoid resetting
          if (activeOfferIdRef.current === payload.offerId && pcRef.current) {
            if (pcRef.current.connectionState === "connected") {
              emitDiagnosticLog({
                sessionId,
                role: "viewer",
                pcId: currentPcIdRef.current,
                offerId: payload.offerId,
                eventName: "offer-ignored-already-connected",
                signalingState: pcRef.current.signalingState,
                connectionState: pcRef.current.connectionState,
                iceConnectionState: pcRef.current.iceConnectionState,
              });
              return;
            }

            // If we already generated an answer for this offerId and are connecting,
            // re-send the existing answer instead of re-applying SDP and disrupting ICE!
            if (
              pcRef.current.signalingState === "stable" &&
              pcRef.current.localDescription &&
              signalingDiagRef.current.answerCreated
            ) {
              emitDiagnosticLog({
                sessionId,
                role: "viewer",
                pcId: currentPcIdRef.current,
                offerId: payload.offerId,
                eventName: "offer-resending-existing-answer",
                signalingState: pcRef.current.signalingState,
                connectionState: pcRef.current.connectionState,
                iceConnectionState: pcRef.current.iceConnectionState,
              });
              sendSignal("theater:answer", {
                sdp: pcRef.current.localDescription,
                offerId: payload.offerId,
                viewerPcId: currentPcIdRef.current,
                hostPcId: payload.pcId,
              });
              return;
            }
          }

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
            pcRef.current.connectionState === "failed" ||
            isNewOffer;
          const pc = getOrCreatePc(needFresh);

          const rawSdp = typeof payload.sdp === "string" ? payload.sdp : payload.sdp?.sdp || "";
          const safeOfferSdp = prioritizeCodecsInSdp(rawSdp);
          await pc.setRemoteDescription(new RTCSessionDescription({
            type: "offer",
            sdp: safeOfferSdp,
          }));

          signalingDiagRef.current.offerApplied = true;
          signalingDiagRef.current.offerApplyError = null;

          emitDiagnosticLog({
            sessionId,
            role: "viewer",
            pcId: currentPcIdRef.current,
            offerId: payload.offerId,
            eventName: "offer-applied-success",
            signalingState: pc.signalingState,
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
          });

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
          signalingDiagRef.current.answerCreated = true;
          signalingDiagRef.current.answerCreatedForPcId = currentPcIdRef.current;

          // CRITICAL: DO NOT munge answer SDP per RFC 8829 §5.4!
          // Modifying answer payload types causes WebKit (iOS Safari) and Chromium to throw InvalidModificationError.
          await pc.setLocalDescription(answer);

          emitDiagnosticLog({
            sessionId,
            role: "viewer",
            pcId: currentPcIdRef.current,
            offerId: payload.offerId,
            eventName: "set-local-description-answer",
            signalingState: pc.signalingState,
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
          });

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

          signalingDiagRef.current.answerSent = true;
          signalingDiagRef.current.answerSentForPcId = currentPcIdRef.current;

          emitDiagnosticLog({
            sessionId,
            role: "viewer",
            pcId: currentPcIdRef.current,
            offerId: payload.offerId,
            eventName: "answer-sent",
            signalingState: pc.signalingState,
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
          });

          sendSignal("theater:answer", {
            sdp: pc.localDescription || answer,
            offerId: payload.offerId,
            viewerPcId: currentPcIdRef.current,
            hostPcId: payload.pcId,
          });

          if (payload.surface) {
            setStreamSourceType(payload.surface);
            streamSourceTypeRef.current = payload.surface;
          }
          updateState("STREAM_CONNECTING");
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          signalingDiagRef.current.offerApplied = false;
          signalingDiagRef.current.offerApplyError = errMsg;
          emitDiagnosticLog({
            sessionId,
            role: "viewer",
            pcId: currentPcIdRef.current,
            offerId: payload.offerId,
            eventName: "offer-handling-error",
            signalingState: pcRef.current?.signalingState || "none",
            connectionState: pcRef.current?.connectionState || "none",
            iceConnectionState: pcRef.current?.iceConnectionState || "none",
            details: { error: errMsg },
          });
          console.error("[WebRTC Viewer] Failed handling WebRTC offer:", e);
        }
      })
      .on("broadcast", { event: "theater:answer" }, async ({ payload }: { payload: any }) => {
        if (payload.senderUserId === userId) return;
        if (!isHost) return;

        signalingDiagRef.current.answerReceived = true;

        emitDiagnosticLog({
          sessionId,
          role: "host",
          pcId: currentPcIdRef.current,
          offerId: payload.offerId,
          eventName: "answer-received",
          signalingState: pcRef.current?.signalingState || "none",
          connectionState: pcRef.current?.connectionState || "none",
          iceConnectionState: pcRef.current?.iceConnectionState || "none",
          details: {
            payloadOfferId: payload.offerId,
            activeOfferId: activeOfferIdRef.current,
            viewerPcId: payload.viewerPcId,
            hostPcId: payload.hostPcId,
          },
        });

        // OfferId validation to prevent SDP session mismatch on host PC
        if (activeOfferIdRef.current && payload.offerId && payload.offerId !== activeOfferIdRef.current) {
          const mismatchMsg = `OfferId mismatch: expected ${activeOfferIdRef.current}, received ${payload.offerId}`;
          signalingDiagRef.current.answerApplyError = mismatchMsg;
          emitDiagnosticLog({
            sessionId,
            role: "host",
            pcId: currentPcIdRef.current,
            offerId: payload.offerId,
            eventName: "answer-offerId-mismatch",
            signalingState: pcRef.current?.signalingState || "none",
            connectionState: pcRef.current?.connectionState || "none",
            iceConnectionState: pcRef.current?.iceConnectionState || "none",
            details: {
              expectedOfferId: activeOfferIdRef.current,
              receivedOfferId: payload.offerId,
            },
          });
          return;
        }

        // Host PC ID validation: reject answers intended for an older/closed Host PC instance
        if (payload.hostPcId && payload.hostPcId !== currentPcIdRef.current) {
          const mismatchMsg = `Host PC ID mismatch: expected PC #${currentPcIdRef.current}, received for PC #${payload.hostPcId}`;
          signalingDiagRef.current.answerApplyError = mismatchMsg;
          emitDiagnosticLog({
            sessionId,
            role: "host",
            pcId: currentPcIdRef.current,
            offerId: payload.offerId,
            eventName: "answer-hostPcId-mismatch",
            signalingState: pcRef.current?.signalingState || "none",
            connectionState: pcRef.current?.connectionState || "none",
            iceConnectionState: pcRef.current?.iceConnectionState || "none",
            details: {
              expectedHostPcId: currentPcIdRef.current,
              receivedHostPcId: payload.hostPcId,
            },
          });
          return;
        }

        try {
          const pc = pcRef.current;
          if (
            pc &&
            (pc.signalingState === "have-local-offer" ||
              pc.signalingState === "have-remote-pranswer")
          ) {
            const rawSdp =
              typeof payload.sdp === "string"
                ? payload.sdp
                : payload.sdp?.sdp;
            if (rawSdp) {
              await pc.setRemoteDescription(new RTCSessionDescription({
                type: "answer",
                sdp: rawSdp,
              }));
              signalingDiagRef.current.answerApplied = true;
              signalingDiagRef.current.answerApplyError = null;

              emitDiagnosticLog({
                sessionId,
                role: "host",
                pcId: currentPcIdRef.current,
                offerId: activeOfferIdRef.current,
                eventName: "answer-applied-success",
                signalingState: pc.signalingState,
                connectionState: pc.connectionState,
                iceConnectionState: pc.iceConnectionState,
              });

              await flushPendingIce(pc);
              void applyBitrateCap(pc);
            }
          } else {
            const stateMsg = `Host PC not in have-local-offer (current: ${pc?.signalingState || "no-pc"})`;
            signalingDiagRef.current.answerApplyError = stateMsg;
            emitDiagnosticLog({
              sessionId,
              role: "host",
              pcId: currentPcIdRef.current,
              offerId: activeOfferIdRef.current,
              eventName: "answer-ignored-wrong-state",
              signalingState: pc?.signalingState || "none",
              connectionState: pc?.connectionState || "none",
              iceConnectionState: pc?.iceConnectionState || "none",
            });
          }
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          signalingDiagRef.current.answerApplied = false;
          signalingDiagRef.current.answerApplyError = errMsg;
          emitDiagnosticLog({
            sessionId,
            role: "host",
            pcId: currentPcIdRef.current,
            offerId: activeOfferIdRef.current,
            eventName: "answer-apply-error",
            signalingState: pcRef.current?.signalingState || "none",
            connectionState: pcRef.current?.connectionState || "none",
            iceConnectionState: pcRef.current?.iceConnectionState || "none",
            details: { error: errMsg },
          });
          console.error("[WebRTC Host] Failed handling WebRTC answer:", e);
        }
      })
      .on("broadcast", { event: "theater:ice-candidate" }, async ({ payload }: { payload: any }) => {
        if (payload.senderUserId === userId) return;
        const candidate = payload.candidate as RTCIceCandidateInit;
        if (!candidate || !candidate.candidate) return;

        // Reject candidates from stale offer generations to prevent SDP mismatch errors
        if (
          payload.offerId &&
          activeOfferIdRef.current &&
          payload.offerId !== activeOfferIdRef.current
        ) {
          emitDiagnosticLog({
            sessionId,
            role: isHost ? "host" : "viewer",
            pcId: currentPcIdRef.current,
            offerId: activeOfferIdRef.current,
            eventName: "ice-candidate-dropped-stale-offer",
            signalingState: pcRef.current?.signalingState || "none",
            connectionState: pcRef.current?.connectionState || "none",
            iceConnectionState: pcRef.current?.iceConnectionState || "none",
            details: {
              receivedOfferId: payload.offerId,
              activeOfferId: activeOfferIdRef.current,
            },
          });
          return;
        }

        const cType = parseCandidateType(candidate.candidate);
        if (cType === "host") iceDiagRef.current.remoteCandidatesReceived.host++;
        else if (cType === "srflx") iceDiagRef.current.remoteCandidatesReceived.srflx++;
        else if (cType === "relay") iceDiagRef.current.remoteCandidatesReceived.relay++;
        iceDiagRef.current.remoteCandidatesReceived.total++;

        const pc = pcRef.current;
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            iceDiagRef.current.remoteCandidatesAdded++;
            emitDiagnosticLog({
              sessionId,
              role: isHost ? "host" : "viewer",
              pcId: currentPcIdRef.current,
              offerId: activeOfferIdRef.current,
              eventName: "ice-candidate-applied",
              signalingState: pc.signalingState,
              connectionState: pc.connectionState,
              iceConnectionState: pc.iceConnectionState,
              candidateType: cType,
            });
          } catch (err: unknown) {
            iceDiagRef.current.candidateErrors++;
            const errMsg = err instanceof Error ? err.message : String(err);
            iceDiagRef.current.lastCandidateError = errMsg;
            emitDiagnosticLog({
              sessionId,
              role: isHost ? "host" : "viewer",
              pcId: currentPcIdRef.current,
              offerId: activeOfferIdRef.current,
              eventName: "ice-candidate-apply-error",
              signalingState: pc.signalingState,
              connectionState: pc.connectionState,
              iceConnectionState: pc.iceConnectionState,
              candidateType: cType,
              details: { error: errMsg },
            });
          }
        } else {
          pendingIceRef.current.push(candidate);
          emitDiagnosticLog({
            sessionId,
            role: isHost ? "host" : "viewer",
            pcId: currentPcIdRef.current,
            offerId: activeOfferIdRef.current,
            eventName: "ice-candidate-queued",
            signalingState: pc?.signalingState || "none",
            connectionState: pc?.connectionState || "none",
            iceConnectionState: pc?.iceConnectionState || "none",
            candidateType: cType,
          });
        }
      })
      .on("broadcast", { event: "theater:viewer-ready" }, async ({ payload }: { payload: any }) => {
        if (payload.senderUserId === userId) return;
        emitDiagnosticLog({
          sessionId,
          role: isHost ? "host" : "viewer",
          pcId: currentPcIdRef.current,
          offerId: activeOfferIdRef.current,
          eventName: "viewer-ready-received",
          signalingState: pcRef.current?.signalingState || "none",
          connectionState: pcRef.current?.connectionState || "none",
          iceConnectionState: pcRef.current?.iceConnectionState || "none",
          details: { fromUserId: payload.senderUserId },
        });
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
            const isActivelyConnecting =
              pcRef.current?.connectionState === "connecting" ||
              pcRef.current?.iceConnectionState === "checking" ||
              (activeOfferIdRef.current !== null && Date.now() - offerSentTimestampRef.current < 10000);

            // Only request offer if viewer is not already in-flight connecting/negotiating
            if (!isActivelyConnecting) {
              sendViewerReady();
            }
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
          partnerDiagStatsRef.current = payload as WebRTCDiagnosticData;
          const now = Date.now();
          if (isDiagOpenRef.current || now - lastPartnerStatsUpdateTimeRef.current >= 3500) {
            lastPartnerStatsUpdateTimeRef.current = now;
            setPartnerDiagStats(payload as WebRTCDiagnosticData);
          }
        }
      });

    channelRef.current = channel;

    // Load TURN credentials
    void getTurnCredentialsAction().then((res) => {
      const serverTurnConfigured = res.ok && Boolean(res.data?.serverInfo?.turnConfigured);
      const serverIceServers = res.ok ? res.data.iceServers : [];
      const hasReturnedConfig = serverIceServers.length > 0;

      turnDiagRef.current.turnConfiguredServerSide = serverTurnConfigured;
      turnDiagRef.current.turnConfigDeliveredToBrowser = hasReturnedConfig;

      if (res.ok && serverIceServers.length > 0) {
        iceServersRef.current = deduplicateIceServers([
          ...DEFAULT_ICE_SERVERS,
          ...serverIceServers,
        ]);
      }

      const inspected = inspectIceServers(iceServersRef.current);
      turnDiagRef.current.iceServerCount = inspected.iceServerCount;
      turnDiagRef.current.stunServerCount = inspected.stunServerCount;
      turnDiagRef.current.turnServerCount = inspected.turnServerCount;
      turnDiagRef.current.turnTransports = inspected.turnTransports;

      // Safe diagnostic log: NEVER prints credentials/passwords
      console.log("[WebRTC-DIAG] [TURN-CONFIG]", {
        sessionId,
        role: isHost ? "host" : "viewer",
        TURN_USERNAME_present: res.ok && serverIceServers.some((s: any) => Boolean(s.username)) ? "YES" : "NO",
        TURN_CREDENTIAL_present: res.ok && serverIceServers.some((s: any) => Boolean(s.credential)) ? "YES" : "NO",
        ICE_config_returned: hasReturnedConfig ? "YES" : "NO",
        TURN_URL_count: inspected.turnServerCount,
        iceServerCount: inspected.iceServerCount,
        stunServerCount: inspected.stunServerCount,
        turnTransports: inspected.turnTransports,
      });

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
    });

    // Authorize & subscribe
    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed) return;
      if (!auth.ok) {
        emitDiagnosticLog({
          sessionId,
          role: isHost ? "host" : "viewer",
          pcId: currentPcIdRef.current,
          offerId: activeOfferIdRef.current,
          eventName: "channel-auth-failed",
          signalingState: pcRef.current?.signalingState || "none",
          connectionState: pcRef.current?.connectionState || "none",
          iceConnectionState: pcRef.current?.iceConnectionState || "none",
          details: { error: auth.error?.message || "Unauthorized" },
        });
        console.error("[WebRTC] Realtime signaling topic authorization failed:", auth.error);
        return;
      }

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
    applyBitrateCap,
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
      const isActivelyConnecting =
        pcRef.current?.connectionState === "connecting" ||
        pcRef.current?.iceConnectionState === "checking";

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
          const remoteInboundList: any[] = [];
          const candidatePairs: any[] = [];
          let selectedCandidatePairId: string | null = null;
          let outboundVideoReport: any = null;
          let inboundVideoReport: any = null;

          stats.forEach((report: any) => {
            if (report.type === "transport" && report.selectedCandidatePairId) {
              selectedCandidatePairId = report.selectedCandidatePairId;
            } else if (report.type === "codec") {
              codecMap.set(report.id, report);
            } else if (report.type === "remote-inbound-rtp" && (report.kind === "video" || !report.kind)) {
              remoteInboundList.push(report);
            } else if (report.type === "outbound-rtp" && report.kind === "video") {
              outboundVideoReport = report;
            } else if (report.type === "inbound-rtp" && report.kind === "video") {
              inboundVideoReport = report;
            } else if (report.type === "candidate-pair") {
              candidatePairs.push(report);
            }
          });

          if (outboundVideoReport) {
            const report = outboundVideoReport;
            const bytes = report.bytesSent || 0;
            const frames = report.framesEncoded || 0;
            const bitrate = Math.max(0, Math.round(((bytes - prev.bytesSent) * 8) / (deltaTimeSec * 1000)));
            const fps = Math.max(0, Math.round((frames - prev.framesEncoded) / deltaTimeSec));
            prev.bytesSent = bytes;
            prev.framesEncoded = frames;

            const remoteInbound = report.remoteId
              ? remoteInboundList.find((r) => r.id === report.remoteId)
              : remoteInboundList[0];

            gatheredStats.outboundVideo = {
              bytesSent: bytes,
              packetsSent: report.packetsSent || 0,
              framesEncoded: frames,
              keyFramesEncoded: report.keyFramesEncoded,
              framesSent: report.framesSent ?? frames,
              retransmittedPacketsSent: report.retransmittedPacketsSent ?? 0,
              nackCount: report.nackCount ?? 0,
              pliCount: report.pliCount ?? 0,
              firCount: report.firCount ?? 0,
              frameWidth: report.frameWidth,
              frameHeight: report.frameHeight,
              fps,
              nativeFps: report.framesPerSecond !== undefined ? Math.round(report.framesPerSecond * 10) / 10 : undefined,
              bitrateKbps: bitrate,
              qpSum: report.qpSum,
              totalEncodeTime: report.totalEncodeTime !== undefined ? Math.round(report.totalEncodeTime * 1000) / 1000 : undefined,
              encoderImplementation: report.encoderImplementation,
              qualityLimitationReason: report.qualityLimitationReason || "none",
              qualityLimitationDurations: report.qualityLimitationDurations,
              qualityLimitationResolutionChanges: report.qualityLimitationResolutionChanges,
              remoteInbound: remoteInbound ? {
                packetsLost: remoteInbound.packetsLost,
                jitter: remoteInbound.jitter !== undefined ? Math.round(remoteInbound.jitter * 1000) / 1000 : undefined,
                roundTripTime: remoteInbound.roundTripTime !== undefined ? Math.round(remoteInbound.roundTripTime * 1000) : undefined,
              } : undefined,
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

          if (inboundVideoReport) {
            const report = inboundVideoReport;
            const bytes = report.bytesReceived || 0;
            const frames = report.framesDecoded || 0;
            const bitrate = Math.max(0, Math.round(((bytes - prev.bytesReceived) * 8) / (deltaTimeSec * 1000)));
            const fps = Math.max(0, Math.round((frames - prev.framesDecoded) / deltaTimeSec));
            prev.bytesReceived = bytes;
            prev.framesDecoded = frames;

            const jbDelay = report.jitterBufferDelay || 0;
            const jbEmitted = report.jitterBufferEmittedCount || 0;
            const jbAvgMs = jbEmitted > 0 ? Math.round((jbDelay / jbEmitted) * 1000) : undefined;

            gatheredStats.inboundVideo = {
              bytesReceived: bytes,
              packetsReceived: report.packetsReceived || 0,
              packetsLost: report.packetsLost ?? 0,
              framesReceived: report.framesReceived ?? ((report.framesDecoded || 0) + (report.framesDropped || 0)),
              framesDecoded: frames,
              framesDropped: report.framesDropped || 0,
              keyFramesDecoded: report.keyFramesDecoded,
              frameWidth: report.frameWidth,
              frameHeight: report.frameHeight,
              fps,
              nativeFps: report.framesPerSecond !== undefined ? Math.round(report.framesPerSecond * 10) / 10 : undefined,
              bitrateKbps: bitrate,
              jitter: report.jitter !== undefined ? Math.round(report.jitter * 1000) / 1000 : undefined,
              jitterBufferDelay: report.jitterBufferDelay !== undefined ? Math.round(report.jitterBufferDelay * 1000) / 1000 : undefined,
              jitterBufferEmittedCount: jbEmitted,
              jitterBufferDelayAvgMs: jbAvgMs,
              totalDecodeTime: report.totalDecodeTime !== undefined ? Math.round(report.totalDecodeTime * 1000) / 1000 : undefined,
              freezeCount: report.freezeCount,
              totalFreezesDuration: report.totalFreezesDuration !== undefined ? Math.round(report.totalFreezesDuration * 1000) / 1000 : undefined,
              decoderImplementation: report.decoderImplementation,
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

          const activePair =
            (selectedCandidatePairId ? candidatePairs.find((p) => p.id === selectedCandidatePairId) : null) ||
            candidatePairs.find((p) => p.state === "succeeded" && p.nominated) ||
            candidatePairs.find((p) => p.state === "succeeded") ||
            candidatePairs.find((p) => p.nominated) ||
            candidatePairs[0];
          if (activePair) {
            const pairInfo: NonNullable<WebRTCDiagnosticData["ice"]["selectedPair"]> = {
              state: activePair.state,
              localType: "unknown",
              remoteType: "unknown",
              localAddress: "hidden",
              remoteAddress: "hidden",
              currentRoundTripTime: typeof activePair.currentRoundTripTime === "number" ? Math.round(activePair.currentRoundTripTime * 1000) : undefined,
              bytesSent: activePair.bytesSent || 0,
              bytesReceived: activePair.bytesReceived || 0,
              availableOutgoingBitrate: typeof activePair.availableOutgoingBitrate === "number" ? Math.round(activePair.availableOutgoingBitrate / 1000) : undefined,
              availableIncomingBitrate: typeof activePair.availableIncomingBitrate === "number" ? Math.round(activePair.availableIncomingBitrate / 1000) : undefined,
              relayActive: false,
            };
            stats.forEach((cand: any) => {
              if (cand.id === activePair.localCandidateId) {
                pairInfo.localType = cand.candidateType || "unknown";
                pairInfo.localAddress = cand.address ? `${cand.address}:${cand.port}` : cand.ip || "hidden";
              }
              if (cand.id === activePair.remoteCandidateId) {
                pairInfo.remoteType = cand.candidateType || "unknown";
                pairInfo.remoteAddress = cand.address ? `${cand.address}:${cand.port}` : cand.ip || "hidden";
              }
            });
            pairInfo.relayActive = pairInfo.localType === "relay" || pairInfo.remoteType === "relay";
            gatheredStats.selectedPair = pairInfo;
          }
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
        const vEl = (isHost
          ? document.querySelector('video[data-webrtc-role="local"], video')
          : document.querySelector('video[data-webrtc-role="remote"], video')) as HTMLVideoElement | null;
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
        } else if (inboundVideo && inboundVideo.bytesReceived === 0 && (partnerDiagStatsRef.current?.outboundVideo?.bytesSent || 0) > 0) {
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

      let adaptiveDiagStats: WebRTCDiagnosticData["adaptiveQuality"] = undefined;
      
      if (isHost && pc && pc.signalingState !== "closed") {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        const bwKbps = selectedPair?.availableOutgoingBitrate ?? 0;
        const rttMs = selectedPair?.currentRoundTripTime ?? 0;
        
        const settings = localVTrack?.getSettings();
        const srcWidth = settings?.width ?? 0;
        const srcHeight = settings?.height ?? 0;

        if (sender && bwKbps > 0 && srcWidth > 0) {
          let candidate: AdaptiveQualityProfile = "MINIMUM";
          if (bwKbps >= 2500 && rttMs < 150) candidate = "ULTRA";
          else if (bwKbps >= 1200 && rttMs < 300) candidate = "HIGH";
          else if (bwKbps >= 600 && rttMs < 500) candidate = "MEDIUM";
          else if (bwKbps >= 250 && rttMs < 800) candidate = "LOW";
          else candidate = "MINIMUM";

          const profileOrder: Record<AdaptiveQualityProfile, number> = { "MINIMUM": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3, "ULTRA": 4 };
          const state = adaptiveQualityRef.current;
          
          if (candidate !== state.currentProfile) {
            const isUpgrade = profileOrder[candidate] > profileOrder[state.currentProfile];
            
            if (isUpgrade) {
              if (candidate === state.targetProfile) {
                state.consecutiveUpgradeMeasurements++;
              } else {
                state.targetProfile = candidate;
                state.consecutiveUpgradeMeasurements = 1;
              }
            } else {
              state.targetProfile = candidate;
              state.consecutiveUpgradeMeasurements = 3; 
            }

            if (state.consecutiveUpgradeMeasurements >= 3 && now - state.lastProfileChangeTime >= 5000) {
              const params = sender.getParameters();
              if (params.encodings && params.encodings.length > 0) {
                const enc = params.encodings[0]!;
                
                let scaleDown = 1.0;
                let maxBitrate = 2500;
                let maxFramerate = 30;
                let degPref = "maintain-framerate";

                if (state.targetProfile === "ULTRA") {
                  maxBitrate = 2500;
                  maxFramerate = 30;
                } else if (state.targetProfile === "HIGH") {
                  maxBitrate = 1800;
                  maxFramerate = 30;
                } else if (state.targetProfile === "MEDIUM") {
                  maxBitrate = 1200;
                  maxFramerate = 24;
                  scaleDown = srcWidth <= 1280 ? 1.0 : 1.5;
                  degPref = "balanced";
                } else if (state.targetProfile === "LOW") {
                  maxBitrate = 600;
                  maxFramerate = 20;
                  scaleDown = srcWidth > 1280 ? 1.5 : (srcWidth > 640 ? 1.5 : 1.0);
                } else {
                  maxBitrate = 300;
                  maxFramerate = 15;
                  scaleDown = srcWidth > 1280 ? 2.0 : (srcWidth > 640 ? 2.0 : 1.0);
                }
                
                if (srcWidth / scaleDown < 320 && srcWidth >= 320) {
                  scaleDown = srcWidth / 320;
                } else if (srcWidth < 320) {
                  scaleDown = 1.0;
                }

                try { (params as any).degradationPreference = degPref; } catch {}
                enc.maxBitrate = maxBitrate * 1000;
                enc.maxFramerate = maxFramerate;
                enc.scaleResolutionDownBy = Math.max(1.0, scaleDown);

                sender.setParameters(params).catch(() => {});

                state.currentProfile = state.targetProfile;
                state.lastProfileChangeTime = now;
              }
            }
          } else {
            state.consecutiveUpgradeMeasurements = 0;
            state.targetProfile = null;
          }
          
          const currentParams = sender.getParameters();
          adaptiveDiagStats = {
            currentProfile: state.currentProfile,
            targetProfile: state.targetProfile,
            consecutiveUpgradeMeasurements: state.consecutiveUpgradeMeasurements,
            sourceWidth: srcWidth,
            sourceHeight: srcHeight,
            measuredBandwidthKbps: bwKbps,
            measuredRttMs: rttMs,
            appliedMaxBitrate: currentParams.encodings?.[0]?.maxBitrate ?? 0,
            appliedMaxFramerate: currentParams.encodings?.[0]?.maxFramerate ?? 0,
            appliedScaleDown: currentParams.encodings?.[0]?.scaleResolutionDownBy ?? 1.0,
          };
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
        signaling: { ...signalingDiagRef.current },
        turn: { ...turnDiagRef.current, forcedRelayMode: forceRelayRef.current },
        ice: {
          candidatesGathered: { ...gatheredCandidatesRef.current },
          remoteCandidatesReceived: { ...iceDiagRef.current.remoteCandidatesReceived },
          remoteCandidatesAdded: iceDiagRef.current.remoteCandidatesAdded,
          candidateErrors: iceDiagRef.current.candidateErrors,
          lastCandidateError: iceDiagRef.current.lastCandidateError,
          selectedPair,
        },
        localVideoTrack: localVTrack ? {
          id: localVTrack.id,
          readyState: localVTrack.readyState,
          enabled: localVTrack.enabled,
          muted: localVTrack.muted,
          settings: typeof localVTrack.getSettings === "function" ? localVTrack.getSettings() : undefined,
          contentHint: (localVTrack as any).contentHint || undefined,
        } : null,
        remoteVideoTrack: remoteVTrack ? {
          id: remoteVTrack.id,
          readyState: remoteVTrack.readyState,
          enabled: remoteVTrack.enabled,
          muted: remoteVTrack.muted,
        } : null,
        outboundVideo,
        inboundVideo,
        negotiatedCodec,
        videoElement: videoElementStats,
        adaptiveQuality: adaptiveDiagStats,
      };

      webrtcDiagStatsRef.current = diag;
      if (typeof window !== "undefined") {
        (window as any).__WEBRTC_STATS = diag;
        (window as any).__WEBRTC_DIAG = () => diag;
      }

      if (!disposed) {
        // UI render throttling:
        // Update React state immediately on matrix case transition or when diag inspector is open;
        // during normal background playback, update every 3 seconds to avoid main-thread jank.
        const matrixChanged = matrixCase !== lastMatrixCaseRef.current;
        const timeSinceLastUiUpdate = now - lastUiUpdateTimeRef.current;
        const shouldUpdateUi = isDiagOpenRef.current || matrixChanged || timeSinceLastUiUpdate >= 3000;

        if (shouldUpdateUi) {
          lastUiUpdateTimeRef.current = now;
          lastMatrixCaseRef.current = matrixCase;
          setWebrtcDiagStats(diag);
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
  }, [isHost]);

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
    webrtcDiagStatsRef,
    partnerDiagStatsRef,
    updateState,
    startScreenShare,
    stopScreenShare,
    startVoiceCall,
    stopVoiceCall,
    toggleMic,
    remoteVoiceAudioRef,
    notifyPartnerLeaving,
    sendViewerReady,
    forceRelay,
    toggleForceRelay,
    currentAdaptiveProfile: adaptiveQualityRef.current.currentProfile,
  };
}
