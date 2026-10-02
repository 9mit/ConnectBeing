"use client";

import React, { useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  X,
  Server,
  Video,
  Layers,
  ArrowRightLeft,
  Radio,
  Network,
} from "lucide-react";
import type { WebRTCDiagnosticData, FailureMatrixCase } from "@/features/together/webrtc/useTheaterWebRTC";

interface WebRTCDiagnosticInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  localDiag: WebRTCDiagnosticData | null;
  partnerDiag: WebRTCDiagnosticData | null;
  onRefreshStream?: () => void;
  isHost: boolean;
  forceRelay?: boolean;
  onToggleForceRelay?: () => void;
}

function formatSection12Report(
  isHost: boolean,
  localDiag: WebRTCDiagnosticData | null,
  partnerDiag: WebRTCDiagnosticData | null,
): string {
  const hostDiag = isHost ? localDiag : partnerDiag;
  const viewerDiag = !isHost ? localDiag : partnerDiag;

  const hostSelectedPair = hostDiag?.ice?.selectedPair ?? viewerDiag?.ice?.selectedPair;
  const hostCandidate = hostSelectedPair?.localAddress
    ? `${hostSelectedPair.localType} (${hostSelectedPair.localAddress})`
    : hostSelectedPair?.localType || "none";
  const remoteCandidate = hostSelectedPair?.remoteAddress
    ? `${hostSelectedPair.remoteType} (${hostSelectedPair.remoteAddress})`
    : hostSelectedPair?.remoteType || "none";

  return `SIGNALING

Host PC:
pcId: ${hostDiag?.pcId ?? "N/A"}
offerId: ${hostDiag?.signaling?.offerId ?? "none"}
offerSent: ${hostDiag?.signaling?.offerSent ? "true" : "false"}
answerReceived: ${hostDiag?.signaling?.answerReceived ? "true" : "false"}
answerApplied: ${hostDiag?.signaling?.answerApplied ? "true" : "false"}

Viewer PC:
pcId: ${viewerDiag?.pcId ?? "N/A"}
offerReceived: ${viewerDiag?.signaling?.offerReceived ? "true" : "false"}
offerApplied: ${viewerDiag?.signaling?.offerApplied ? "true" : "false"}
answerCreated: ${viewerDiag?.signaling?.answerCreated ? "true" : "false"}
answerSent: ${viewerDiag?.signaling?.answerSent ? "true" : "false"}

ICE

Host:
host: ${hostDiag?.ice?.candidatesGathered?.host ?? 0}
srflx: ${hostDiag?.ice?.candidatesGathered?.srflx ?? 0}
relay: ${hostDiag?.ice?.candidatesGathered?.relay ?? 0}
remoteCandidatesReceived: ${hostDiag?.ice?.remoteCandidatesReceived?.total ?? 0}

Viewer:
host: ${viewerDiag?.ice?.candidatesGathered?.host ?? 0}
srflx: ${viewerDiag?.ice?.candidatesGathered?.srflx ?? 0}
relay: ${viewerDiag?.ice?.candidatesGathered?.relay ?? 0}
remoteCandidatesReceived: ${viewerDiag?.ice?.remoteCandidatesReceived?.total ?? 0}

Selected pair:
host candidate: ${hostCandidate}
remote candidate: ${remoteCandidate}
state: ${hostSelectedPair?.state ?? "null"}
roundTripTime: ${hostSelectedPair?.currentRoundTripTime !== undefined ? `${hostSelectedPair.currentRoundTripTime} ms` : "N/A"}
availableOutgoingBitrate: ${hostSelectedPair?.availableOutgoingBitrate ? `${hostSelectedPair.availableOutgoingBitrate} kbps` : "N/A"}
availableIncomingBitrate: ${hostSelectedPair?.availableIncomingBitrate ? `${hostSelectedPair.availableIncomingBitrate} kbps` : "N/A"}

TURN:
TURN configured server-side: ${(localDiag?.turn?.turnConfiguredServerSide || partnerDiag?.turn?.turnConfiguredServerSide) ? "YES" : "NO"}
TURN config delivered to browser: ${(localDiag?.turn?.turnConfigDeliveredToBrowser || partnerDiag?.turn?.turnConfigDeliveredToBrowser) ? "YES" : "NO"}
TURN candidates: ${(localDiag?.ice?.candidatesGathered?.relay ?? 0) + (partnerDiag?.ice?.candidatesGathered?.relay ?? 0)}

CONNECTION:
signalingState: ${localDiag?.signalingState ?? "none"}
iceConnectionState: ${localDiag?.iceConnectionState ?? "none"}
connectionState: ${localDiag?.connectionState ?? "none"}

HOST MEDIA (OUTBOUND):
framesEncoded: ${hostDiag?.outboundVideo?.framesEncoded ?? 0}
framesSent: ${hostDiag?.outboundVideo?.framesSent ?? hostDiag?.outboundVideo?.framesEncoded ?? 0}
bytesSent: ${hostDiag?.outboundVideo?.bytesSent ?? 0}
packetsSent: ${hostDiag?.outboundVideo?.packetsSent ?? 0}
packetsLost: ${hostDiag?.outboundVideo?.remoteInbound?.packetsLost ?? 0}
retransmittedPacketsSent: ${hostDiag?.outboundVideo?.retransmittedPacketsSent ?? 0}
nackCount: ${hostDiag?.outboundVideo?.nackCount ?? 0}
pliCount: ${hostDiag?.outboundVideo?.pliCount ?? 0}
firCount: ${hostDiag?.outboundVideo?.firCount ?? 0}
frameWidth: ${hostDiag?.outboundVideo?.frameWidth ?? "N/A"}
frameHeight: ${hostDiag?.outboundVideo?.frameHeight ?? "N/A"}
fps: ${hostDiag?.outboundVideo?.fps ?? 0}
framesPerSecond: ${hostDiag?.outboundVideo?.nativeFps ?? hostDiag?.outboundVideo?.fps ?? 0}
resolution: ${hostDiag?.outboundVideo?.frameWidth && hostDiag?.outboundVideo?.frameHeight ? `${hostDiag.outboundVideo.frameWidth}x${hostDiag.outboundVideo.frameHeight}` : "N/A"}
bitrateKbps: ${hostDiag?.outboundVideo?.bitrateKbps ?? 0}
qpSum: ${hostDiag?.outboundVideo?.qpSum ?? "N/A"}
totalEncodeTime: ${hostDiag?.outboundVideo?.totalEncodeTime !== undefined ? `${hostDiag.outboundVideo.totalEncodeTime} s` : "N/A"}
encoderImplementation: ${hostDiag?.outboundVideo?.encoderImplementation ?? "N/A"}
qualityLimitationReason: ${hostDiag?.outboundVideo?.qualityLimitationReason ?? "none"}
qualityLimitationDurations: ${hostDiag?.outboundVideo?.qualityLimitationDurations ? JSON.stringify(hostDiag.outboundVideo.qualityLimitationDurations) : "N/A"}
qualityLimitationResolutionChanges: ${hostDiag?.outboundVideo?.qualityLimitationResolutionChanges ?? 0}
contentHint: ${hostDiag?.localVideoTrack?.contentHint ?? "N/A"}
captureSettings: ${hostDiag?.localVideoTrack?.settings ? `${hostDiag.localVideoTrack.settings.width ?? "N/A"}x${hostDiag.localVideoTrack.settings.height ?? "N/A"} @ ${hostDiag.localVideoTrack.settings.frameRate ?? "N/A"}fps (${hostDiag.localVideoTrack.settings.displaySurface ?? "browser"})` : "N/A"}

VIEWER MEDIA (INBOUND):
framesReceived: ${viewerDiag?.inboundVideo?.framesReceived ?? 0}
framesDecoded: ${viewerDiag?.inboundVideo?.framesDecoded ?? 0}
framesDropped: ${viewerDiag?.inboundVideo?.framesDropped ?? 0}
bytesReceived: ${viewerDiag?.inboundVideo?.bytesReceived ?? 0}
packetsReceived: ${viewerDiag?.inboundVideo?.packetsReceived ?? 0}
packetsLost: ${viewerDiag?.inboundVideo?.packetsLost ?? 0}
fps: ${viewerDiag?.inboundVideo?.fps ?? 0}
framesPerSecond: ${viewerDiag?.inboundVideo?.nativeFps ?? viewerDiag?.inboundVideo?.fps ?? 0}
frameWidth: ${viewerDiag?.inboundVideo?.frameWidth ?? "N/A"}
frameHeight: ${viewerDiag?.inboundVideo?.frameHeight ?? "N/A"}
resolution: ${viewerDiag?.inboundVideo?.frameWidth && viewerDiag?.inboundVideo?.frameHeight ? `${viewerDiag.inboundVideo.frameWidth}x${viewerDiag.inboundVideo.frameHeight}` : "N/A"}
bitrateKbps: ${viewerDiag?.inboundVideo?.bitrateKbps ?? 0}
jitter: ${viewerDiag?.inboundVideo?.jitter !== undefined ? `${viewerDiag.inboundVideo.jitter} s` : "N/A"}
jitterBufferDelay: ${viewerDiag?.inboundVideo?.jitterBufferDelay !== undefined ? `${viewerDiag.inboundVideo.jitterBufferDelay} s` : "N/A"}
jitterBufferEmittedCount: ${viewerDiag?.inboundVideo?.jitterBufferEmittedCount ?? "N/A"}
jitterBufferDelayAvgMs: ${viewerDiag?.inboundVideo?.jitterBufferDelayAvgMs !== undefined ? `${viewerDiag.inboundVideo.jitterBufferDelayAvgMs} ms` : "N/A"}
freezeCount: ${viewerDiag?.inboundVideo?.freezeCount ?? "N/A"}
totalFreezesDuration: ${viewerDiag?.inboundVideo?.totalFreezesDuration !== undefined ? `${viewerDiag.inboundVideo.totalFreezesDuration} s` : "N/A"}
keyFramesDecoded: ${viewerDiag?.inboundVideo?.keyFramesDecoded ?? "N/A"}
totalDecodeTime: ${viewerDiag?.inboundVideo?.totalDecodeTime !== undefined ? `${viewerDiag.inboundVideo.totalDecodeTime} s` : "N/A"}
decoderImplementation: ${viewerDiag?.inboundVideo?.decoderImplementation ?? "N/A"}

VIDEO ELEMENT:
readyState: ${viewerDiag?.videoElement?.readyState ?? "N/A"}
videoDimensions: ${viewerDiag?.videoElement?.videoWidth && viewerDiag?.videoElement?.videoHeight ? `${viewerDiag.videoElement.videoWidth}x${viewerDiag.videoElement.videoHeight}` : "N/A"}
paused: ${viewerDiag?.videoElement?.paused !== undefined ? String(viewerDiag.videoElement.paused) : "N/A"}
currentTime: ${viewerDiag?.videoElement?.currentTime ?? "N/A"}`;
}

export function WebRTCDiagnosticInspector({
  isOpen,
  onClose,
  localDiag,
  partnerDiag,
  onRefreshStream,
  isHost,
  forceRelay = false,
  onToggleForceRelay,
}: WebRTCDiagnosticInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [copiedSec12, setCopiedSec12] = useState(false);

  if (!isOpen) return null;

  const currentCase: FailureMatrixCase = localDiag?.failureMatrixCase || "IDLE";

  const getCaseBadge = (matrixCase: FailureMatrixCase) => {
    switch (matrixCase) {
      case "HEALTHY_STREAMING":
        return {
          bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
          icon: <CheckCircle2 size={15} className="text-emerald-400" />,
          label: "HEALTHY STREAMING (Frames Active)",
        };
      case "CASE_A_TRANSPORT_FAILURE":
        return {
          bg: "bg-rose-500/15 border-rose-500/40 text-rose-400",
          icon: <XCircle size={15} className="text-rose-400" />,
          label: "CASE A: TRANSPORT / ICE / TURN FAILURE",
        };
      case "CASE_B_CODEC_DECODE_FAILURE":
        return {
          bg: "bg-rose-500/15 border-rose-500/40 text-rose-400",
          icon: <XCircle size={15} className="text-rose-400" />,
          label: "CASE B: CODEC / DECODER MISMATCH",
        };
      case "CASE_C_RENDERING_OR_DRM_BLACK":
        return {
          bg: "bg-amber-500/15 border-amber-500/40 text-amber-400",
          icon: <AlertTriangle size={15} className="text-amber-400" />,
          label: "CASE C: VIDEO ELEMENT / CSS OVERLAY / DRM ISSUE",
        };
      case "CASE_D_SOURCE_CAPTURE_FAILURE":
        return {
          bg: "bg-amber-500/15 border-amber-500/40 text-amber-400",
          icon: <AlertTriangle size={15} className="text-amber-400" />,
          label: "CASE D: SCREEN CAPTURE SOURCE STALLED",
        };
      case "CASE_E_NEGOTIATION_FAILURE":
        return {
          bg: "bg-rose-500/15 border-rose-500/40 text-rose-400",
          icon: <XCircle size={15} className="text-rose-400" />,
          label: "CASE E: SDP NEGOTIATION / ONTRACK FAILURE",
        };
      case "CONNECTING":
        return {
          bg: "bg-sky-500/15 border-sky-500/30 text-sky-400",
          icon: <RefreshCw size={15} className="animate-spin text-sky-400" />,
          label: "CONNECTING / NEGOTIATING WEBRTC",
        };
      default:
        return {
          bg: "bg-zinc-800 border-zinc-700 text-zinc-400",
          icon: <Activity size={15} className="text-zinc-400" />,
          label: "IDLE / AWAITING STREAM",
        };
    }
  };

  const badge = getCaseBadge(currentCase);

  const handleCopySec12 = () => {
    const text = formatSection12Report(isHost, localDiag, partnerDiag);
    void navigator.clipboard.writeText(text);
    setCopiedSec12(true);
    setTimeout(() => setCopiedSec12(false), 2000);
  };

  const handleCopyReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      role: isHost ? "host" : "viewer",
      local: localDiag,
      partner: partnerDiag,
      formattedSummary: {
        SIGNALING: {
          HostPC: isHost ? {
            pcId: localDiag?.pcId,
            offerId: localDiag?.signaling?.offerId,
            offerSent: localDiag?.signaling?.offerSent,
            answerReceived: localDiag?.signaling?.answerReceived,
            answerApplied: localDiag?.signaling?.answerApplied,
            error: localDiag?.signaling?.answerApplyError,
          } : {
            pcId: partnerDiag?.pcId,
            offerId: partnerDiag?.signaling?.offerId,
            offerSent: partnerDiag?.signaling?.offerSent,
            answerReceived: partnerDiag?.signaling?.answerReceived,
            answerApplied: partnerDiag?.signaling?.answerApplied,
            error: partnerDiag?.signaling?.answerApplyError,
          },
          ViewerPC: !isHost ? {
            pcId: localDiag?.pcId,
            offerReceived: localDiag?.signaling?.offerReceived,
            offerApplied: localDiag?.signaling?.offerApplied,
            answerCreated: localDiag?.signaling?.answerCreated,
            answerSent: localDiag?.signaling?.answerSent,
            error: localDiag?.signaling?.offerApplyError,
          } : {
            pcId: partnerDiag?.pcId,
            offerReceived: partnerDiag?.signaling?.offerReceived,
            offerApplied: partnerDiag?.signaling?.offerApplied,
            answerCreated: partnerDiag?.signaling?.answerCreated,
            answerSent: partnerDiag?.signaling?.answerSent,
            error: partnerDiag?.signaling?.offerApplyError,
          },
        },
        ICE: {
          Host: isHost ? {
            gathered: localDiag?.ice?.candidatesGathered,
            remoteReceived: localDiag?.ice?.remoteCandidatesReceived,
            remoteAdded: localDiag?.ice?.remoteCandidatesAdded,
            candidateErrors: localDiag?.ice?.candidateErrors,
          } : {
            gathered: partnerDiag?.ice?.candidatesGathered,
            remoteReceived: partnerDiag?.ice?.remoteCandidatesReceived,
            remoteAdded: partnerDiag?.ice?.remoteCandidatesAdded,
            candidateErrors: partnerDiag?.ice?.candidateErrors,
          },
          Viewer: !isHost ? {
            gathered: localDiag?.ice?.candidatesGathered,
            remoteReceived: localDiag?.ice?.remoteCandidatesReceived,
            remoteAdded: localDiag?.ice?.remoteCandidatesAdded,
            candidateErrors: localDiag?.ice?.candidateErrors,
          } : {
            gathered: partnerDiag?.ice?.candidatesGathered,
            remoteReceived: partnerDiag?.ice?.remoteCandidatesReceived,
            remoteAdded: partnerDiag?.ice?.remoteCandidatesAdded,
            candidateErrors: partnerDiag?.ice?.candidateErrors,
          },
          selectedPair: localDiag?.ice?.selectedPair,
        },
        TURN: {
          configuredServerSide: localDiag?.turn?.turnConfiguredServerSide ? "YES" : "NO",
          configDeliveredToBrowser: localDiag?.turn?.turnConfigDeliveredToBrowser ? "YES" : "NO",
          turnCandidateCount: localDiag?.ice?.candidatesGathered?.relay ?? 0,
          iceServerCount: localDiag?.turn?.iceServerCount ?? 0,
          turnTransports: localDiag?.turn?.turnTransports ?? [],
          forcedRelayMode: localDiag?.turn?.forcedRelayMode ?? false,
        },
        CONNECTION: {
          signalingState: localDiag?.signalingState,
          iceConnectionState: localDiag?.iceConnectionState,
          connectionState: localDiag?.connectionState,
        },
        MEDIA: {
          framesEncoded: localDiag?.outboundVideo?.framesEncoded ?? partnerDiag?.outboundVideo?.framesEncoded ?? 0,
          bytesSent: localDiag?.outboundVideo?.bytesSent ?? partnerDiag?.outboundVideo?.bytesSent ?? 0,
          bytesReceived: localDiag?.inboundVideo?.bytesReceived ?? partnerDiag?.inboundVideo?.bytesReceived ?? 0,
          framesReceived: localDiag?.inboundVideo?.framesReceived ?? partnerDiag?.inboundVideo?.framesReceived ?? 0,
          framesDecoded: localDiag?.inboundVideo?.framesDecoded ?? partnerDiag?.inboundVideo?.framesDecoded ?? 0,
        },
      },
    };
    void navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0c0e15] shadow-2xl text-zinc-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <Activity size={18} className="text-rose-400" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  WebRTC Media Pipeline Diagnostics
                </h3>
                {forceRelay && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    FORCED RELAY
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 font-mono">
                Role: <span className="text-white font-bold">{isHost ? "Desktop Host" : "Mobile Viewer"}</span> | PC ID: #{localDiag?.pcId || 1}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close Diagnostics"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Failure Matrix Banner */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${badge.bg}`}>
            <div className="shrink-0 mt-0.5">{badge.icon}</div>
            <div className="min-w-0">
              <span className="font-mono font-bold text-[11px] uppercase tracking-wider block">
                {badge.label}
              </span>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">
                {localDiag?.failureMatrixSummary || "Awaiting diagnostics..."}
              </p>
            </div>
          </div>

          {/* Section: Signaling & Negotiation Audit */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Radio size={14} className="text-sky-400" />
                Signaling & Negotiation Audit
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                SignalingState: <span className="text-white font-bold">{localDiag?.signalingState || "unknown"}</span>
              </span>
            </div>

            <div className="bg-black/40 rounded-lg p-2.5 border border-white/[0.04] space-y-2 text-[11px]">
              <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 border-b border-white/[0.05] pb-1.5">
                <span>Active OfferId:</span>
                <span className="text-zinc-200 font-bold truncate max-w-[280px]">
                  {localDiag?.signaling?.offerId || "None"}
                </span>
              </div>

              {isHost ? (
                /* Host Negotiation Telemetry */
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[10px]">
                  <div>
                    <span className="text-zinc-500 block">Offer Created</span>
                    <span className={localDiag?.signaling?.offerCreated ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                      {localDiag?.signaling?.offerCreated ? "YES" : "NO"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Offer Sent</span>
                    <span className={localDiag?.signaling?.offerSent ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                      {localDiag?.signaling?.offerSent ? "YES" : "NO"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Answer Received</span>
                    <span className={localDiag?.signaling?.answerReceived ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {localDiag?.signaling?.answerReceived ? "YES" : "NO (Awaiting)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Answer Applied</span>
                    <span className={localDiag?.signaling?.answerApplied ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                      {localDiag?.signaling?.answerApplied ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              ) : (
                /* Viewer Negotiation Telemetry */
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[10px]">
                  <div>
                    <span className="text-zinc-500 block">Offer Received</span>
                    <span className={localDiag?.signaling?.offerReceived ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {localDiag?.signaling?.offerReceived ? `YES (PC #${localDiag.signaling.offerReceivedForPcId ?? "?"})` : "NO (Awaiting)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Offer Applied</span>
                    <span className={localDiag?.signaling?.offerApplied ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                      {localDiag?.signaling?.offerApplied ? "YES" : "NO"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Answer Created</span>
                    <span className={localDiag?.signaling?.answerCreated ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                      {localDiag?.signaling?.answerCreated ? "YES" : "NO"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Answer Sent</span>
                    <span className={localDiag?.signaling?.answerSent ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                      {localDiag?.signaling?.answerSent ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              )}

              {(localDiag?.signaling?.answerApplyError || localDiag?.signaling?.offerApplyError) && (
                <div className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded p-1.5 font-mono">
                  Error: {localDiag?.signaling?.answerApplyError || localDiag?.signaling?.offerApplyError}
                </div>
              )}
            </div>
          </div>

          {/* Section: Live Transport & ICE Pair */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Server size={14} className="text-rose-400" />
                Transport & ICE Connection
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                PeerConnection: <span className="text-white font-bold">{localDiag?.connectionState || "unknown"}</span> | ICE: <span className="text-white font-bold">{localDiag?.iceConnectionState || "unknown"}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Selected Pair</span>
                <span className="font-mono text-zinc-200 truncate block font-medium">
                  {localDiag?.ice?.selectedPair
                    ? `${localDiag.ice.selectedPair.localType} ⇄ ${localDiag.ice.selectedPair.remoteType}`
                    : "Connecting..."}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Pair State</span>
                <span
                  className={`font-mono truncate block font-semibold ${
                    localDiag?.ice?.selectedPair?.state === "succeeded"
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {localDiag?.ice?.selectedPair?.state || "Unselected"}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">RTT / Bandwidth</span>
                <span className="font-mono text-zinc-200 block truncate">
                  {localDiag?.ice?.selectedPair?.currentRoundTripTime !== undefined
                    ? `${localDiag.ice.selectedPair.currentRoundTripTime} ms`
                    : "N/A"}
                  {localDiag?.ice?.selectedPair?.availableOutgoingBitrate
                    ? ` (${localDiag.ice.selectedPair.availableOutgoingBitrate}k)`
                    : ""}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Local Gathered</span>
                <span className="font-mono text-zinc-300 block">
                  H:{localDiag?.ice?.candidatesGathered?.host || 0} S:
                  {localDiag?.ice?.candidatesGathered?.srflx || 0} R:
                  <span className="text-emerald-400 font-bold ml-0.5">
                    {localDiag?.ice?.candidatesGathered?.relay || 0}
                  </span>
                </span>
              </div>
            </div>

            {/* Remote candidate exchange stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1">
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Remote Received</span>
                <span className="font-mono text-zinc-300 block text-[10px]">
                  H:{localDiag?.ice?.remoteCandidatesReceived?.host ?? 0} S:
                  {localDiag?.ice?.remoteCandidatesReceived?.srflx ?? 0} R:
                  <span className="text-emerald-400 font-bold ml-0.5">
                    {localDiag?.ice?.remoteCandidatesReceived?.relay ?? 0}
                  </span>{" "}
                  (Tot:{localDiag?.ice?.remoteCandidatesReceived?.total ?? 0})
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Remote Added</span>
                <span className="font-mono text-emerald-400 block font-bold">
                  {localDiag?.ice?.remoteCandidatesAdded ?? 0}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Candidate Errors</span>
                <span className={`font-mono block font-bold ${(localDiag?.ice?.candidateErrors ?? 0) > 0 ? "text-rose-400" : "text-zinc-400"}`}>
                  {localDiag?.ice?.candidateErrors ?? 0}
                </span>
              </div>
            </div>

            {localDiag?.ice?.lastCandidateError && (
              <div className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded p-1.5 font-mono">
                Last Candidate Error: {localDiag.ice.lastCandidateError}
              </div>
            )}
          </div>

          {/* Section: TURN Relay Traversal & Configuration */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Network size={14} className="text-emerald-400" />
                TURN Relay Traversal & Diagnostic Controls
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                Policy: <span className="text-white font-bold">{forceRelay ? "relay" : "all"}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Server-Side TURN</span>
                <span className={`font-mono block font-semibold ${localDiag?.turn?.turnConfiguredServerSide ? "text-emerald-400" : "text-zinc-400"}`}>
                  {localDiag?.turn?.turnConfiguredServerSide ? "YES" : "NO"}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Delivered to Browser</span>
                <span className={`font-mono block font-semibold ${localDiag?.turn?.turnConfigDeliveredToBrowser ? "text-emerald-400" : "text-zinc-400"}`}>
                  {localDiag?.turn?.turnConfigDeliveredToBrowser ? "YES" : "NO"}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Total ICE Servers</span>
                <span className="font-mono text-zinc-200 block">
                  {localDiag?.turn?.iceServerCount ?? 0} (TURN: {localDiag?.turn?.turnServerCount ?? 0})
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Transports</span>
                <span className="font-mono text-zinc-300 block truncate">
                  {(localDiag?.turn?.turnTransports || []).join(", ") || "None"}
                </span>
              </div>
            </div>

            {/* Diagnostic Control Toggle: Force Relay Mode */}
            {onToggleForceRelay && (
              <div className="pt-1 flex items-center justify-between bg-black/40 rounded-lg p-2.5 border border-white/[0.04]">
                <div>
                  <span className="text-zinc-200 font-semibold block text-[11px]">Control Test: Force Relay Policy</span>
                  <span className="text-[10px] text-zinc-500 block">
                    Sets iceTransportPolicy to &quot;relay&quot; to verify TURN allocation under strict firewall conditions.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleForceRelay}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                    forceRelay
                      ? "bg-amber-600 hover:bg-amber-500 text-white font-bold"
                      : "bg-white/[0.08] hover:bg-white/[0.14] text-zinc-300"
                  }`}
                >
                  {forceRelay ? "Disable Forced Relay" : "Enable Forced Relay"}
                </button>
              </div>
            )}
          </div>

          {/* Section: Codec & Video Metrics */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Video size={14} className="text-amber-400" />
                Video Codec & Stream Flow
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                Codec:{" "}
                <span className="text-emerald-300 font-bold">
                  {localDiag?.negotiatedCodec?.mimeType?.replace("video/", "") || "N/A"}
                </span>
              </span>
            </div>

            {/* If Host: Outbound RTP metrics */}
            {isHost && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Frames Encoded</span>
                    <span className="font-mono text-white font-bold">
                      {localDiag?.outboundVideo?.framesEncoded ?? 0}
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Encoder FPS</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {localDiag?.outboundVideo?.fps ?? 0} fps
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Resolution</span>
                    <span className="font-mono text-zinc-200">
                      {localDiag?.outboundVideo?.frameWidth && localDiag?.outboundVideo?.frameHeight
                        ? `${localDiag.outboundVideo.frameWidth}x${localDiag.outboundVideo.frameHeight}`
                        : "Awaiting"}
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Bitrate</span>
                    <span className="font-mono text-zinc-200">
                      {localDiag?.outboundVideo?.bitrateKbps ?? 0} kbps
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Retransmitted</span>
                    <span className="font-mono text-zinc-300 block">
                      {localDiag?.outboundVideo?.retransmittedPacketsSent ?? 0} pkts
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">NACK / PLI</span>
                    <span className="font-mono text-zinc-300 block">
                      N:{localDiag?.outboundVideo?.nackCount ?? 0} / P:{localDiag?.outboundVideo?.pliCount ?? 0}
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Quality Limitation</span>
                    <span className={`font-mono block font-semibold ${(localDiag?.outboundVideo?.qualityLimitationReason || "none") === "none" ? "text-emerald-400" : "text-amber-400"}`}>
                      {localDiag?.outboundVideo?.qualityLimitationReason || "none"}
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Content Hint</span>
                    <span className="font-mono text-emerald-400 block font-semibold">
                      {localDiag?.localVideoTrack?.contentHint || "motion"}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* If Viewer: Inbound RTP metrics */}
            {!isHost && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Frames Decoded</span>
                    <span
                      className={`font-mono font-bold ${
                        (localDiag?.inboundVideo?.framesDecoded || 0) > 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {localDiag?.inboundVideo?.framesDecoded ?? 0}
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Decoder FPS</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {localDiag?.inboundVideo?.fps ?? 0} fps
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Bytes Received</span>
                    <span className="font-mono text-zinc-200">
                      {Math.round((localDiag?.inboundVideo?.bytesReceived || 0) / 1024)} KB
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Frames Dropped</span>
                    <span className="font-mono text-zinc-400">
                      {localDiag?.inboundVideo?.framesDropped ?? 0}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Packets Lost</span>
                    <span className={`font-mono block ${(localDiag?.inboundVideo?.packetsLost ?? 0) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      {localDiag?.inboundVideo?.packetsLost ?? 0}
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Jitter / Delay</span>
                    <span className="font-mono text-zinc-200 block truncate">
                      {localDiag?.inboundVideo?.jitter !== undefined ? `${Math.round(localDiag.inboundVideo.jitter * 1000)}ms` : "0ms"} ({localDiag?.inboundVideo?.jitterBufferDelayAvgMs ?? 0}ms)
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Freezes / Keys</span>
                    <span className="font-mono text-zinc-200 block">
                      F:{localDiag?.inboundVideo?.freezeCount ?? 0} / K:{localDiag?.inboundVideo?.keyFramesDecoded ?? 0}
                    </span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block">Decoder Engine</span>
                    <span className="font-mono text-emerald-400 block truncate">
                      {localDiag?.inboundVideo?.decoderImplementation || "Hardware/Native"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Section: Video Element State */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Layers size={14} className="text-sky-400" />
                HTML5 Video Element State
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                readyState: {localDiag?.videoElement?.readyState ?? 0} / 4
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Render Dimensions</span>
                <span
                  className={`font-mono font-semibold ${
                    (localDiag?.videoElement?.videoWidth || 0) > 0
                      ? "text-emerald-400"
                      : "text-zinc-400"
                  }`}
                >
                  {localDiag?.videoElement?.videoWidth && localDiag?.videoElement?.videoHeight
                    ? `${localDiag.videoElement.videoWidth} x ${localDiag.videoElement.videoHeight}`
                    : "0 x 0 (Empty)"}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Playback State</span>
                <span
                  className={`font-mono font-medium ${
                    localDiag?.videoElement?.paused ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {localDiag?.videoElement?.paused ? "Paused" : "Actively Playing"}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Muted (Autoplay Safe)</span>
                <span className="font-mono text-zinc-200">
                  {localDiag?.videoElement?.muted ? "Muted (Safe)" : "Unmuted"}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Track Live</span>
                <span className="font-mono text-emerald-400">
                  {isHost
                    ? localDiag?.localVideoTrack?.readyState || "none"
                    : localDiag?.remoteVideoTrack?.readyState || "none"}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Partner Cross-Telemetry */}
          {partnerDiag && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <ArrowRightLeft size={14} className="text-emerald-400" />
                  Partner Live Telemetry ({partnerDiag.role})
                </span>
                <span className="font-mono text-[10px] text-emerald-400">
                  Connected
                </span>
              </div>
              <div className="text-[11px] font-mono text-zinc-400 grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded-lg border border-white/[0.04]">
                <div>
                  Partner State:{" "}
                  <span className="text-zinc-200 font-semibold">
                    {partnerDiag.failureMatrixCase}
                  </span>
                </div>
                <div>
                  Partner Bitrate:{" "}
                  <span className="text-zinc-200 font-semibold">
                    {partnerDiag.role === "host"
                      ? `${partnerDiag.outboundVideo?.bitrateKbps || 0} kbps`
                      : `${partnerDiag.inboundVideo?.bitrateKbps || 0} kbps`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="border-t border-white/[0.08] px-5 py-3 bg-white/[0.02] flex items-center justify-between gap-3">
          {onRefreshStream && !isHost && (
            <button
              type="button"
              onClick={onRefreshStream}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-95"
            >
              <RefreshCw size={13} />
              <span>Request Stream Re-sync</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCopySec12}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 transition-all border border-rose-500/30 active:scale-95"
            >
              {copiedSec12 ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedSec12 ? "Copied Section 12!" : "Copy Section 12 Text"}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 transition-all border border-white/[0.08] active:scale-95"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? "Copied JSON!" : "Copy Full JSON"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
