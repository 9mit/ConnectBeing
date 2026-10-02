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
} from "lucide-react";
import type { WebRTCDiagnosticData, FailureMatrixCase } from "@/features/together/webrtc/useTheaterWebRTC";

interface WebRTCDiagnosticInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  localDiag: WebRTCDiagnosticData | null;
  partnerDiag: WebRTCDiagnosticData | null;
  onRefreshStream?: () => void;
  isHost: boolean;
}

export function WebRTCDiagnosticInspector({
  isOpen,
  onClose,
  localDiag,
  partnerDiag,
  onRefreshStream,
  isHost,
}: WebRTCDiagnosticInspectorProps) {
  const [copied, setCopied] = useState(false);

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

  const handleCopyReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      role: isHost ? "host" : "viewer",
      local: localDiag,
      partner: partnerDiag,
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
              <h3 className="text-sm font-semibold text-white tracking-wide">
                WebRTC Media Pipeline Diagnostics
              </h3>
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

          {/* Section: Live Transport & ICE Pair */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Server size={14} className="text-rose-400" />
                Transport & ICE Connection
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                PeerConnection: {localDiag?.connectionState || "unknown"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Candidate Pair</span>
                <span className="font-mono text-zinc-200 truncate block font-medium">
                  {localDiag?.ice?.selectedPair
                    ? `${localDiag.ice.selectedPair.localType} ⇄ ${localDiag.ice.selectedPair.remoteType}`
                    : "Connecting..."}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Relay / TURN</span>
                <span
                  className={`font-mono truncate block font-semibold ${
                    localDiag?.ice?.selectedPair?.relayActive
                      ? "text-emerald-400"
                      : "text-zinc-300"
                  }`}
                >
                  {localDiag?.ice?.selectedPair?.relayActive
                    ? "Metered Relay Active"
                    : "Direct P2P"}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">RTT Latency</span>
                <span className="font-mono text-zinc-200 block">
                  {localDiag?.ice?.selectedPair?.currentRoundTripTime !== undefined
                    ? `${localDiag.ice.selectedPair.currentRoundTripTime} ms`
                    : "N/A"}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">Candidates Gathered</span>
                <span className="font-mono text-zinc-300 block">
                  H:{localDiag?.ice?.candidatesGathered?.host || 0} S:
                  {localDiag?.ice?.candidatesGathered?.srflx || 0} R:
                  <span className="text-emerald-400 font-bold ml-0.5">
                    {localDiag?.ice?.candidatesGathered?.relay || 0}
                  </span>
                </span>
              </div>
            </div>
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
            )}

            {/* If Viewer: Inbound RTP metrics */}
            {!isHost && (
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
              onClick={handleCopyReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 transition-all border border-white/[0.08] active:scale-95"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? "Copied Report!" : "Copy Full JSON"}</span>
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
