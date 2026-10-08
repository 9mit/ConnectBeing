/**
 * Smart Provider Capabilities & Environment Detection for MadLove Together
 *
 * Enforces strict honesty regarding OTT control:
 * - MadLove never fakes direct player control over third-party DRM OTTs (Netflix, JioHotstar, Prime Video, etc.)
 * - Browser tab capture is offered only where native `getDisplayMedia` is supported.
 * - Mobile platforms and unsupported browsers automatically activate Companion Mode for hosting,
 *   while mobile viewers can still receive and render live WebRTC streams when available.
 */

export interface DeviceCapabilities {
  supportsDisplayCapture: boolean;
  supportsTabCapture: boolean;
  supportsAudioCapture: boolean;
  supportsWebRTC: boolean;
  supportsVoice: boolean;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChromium: boolean;
  isFirefox: boolean;
}

export interface ProviderTechnicalCapability {
  canDeepLink: boolean;
  canScreenShare: boolean;
  canPlaybackControl: boolean;
  canSync: boolean;
  canOpenInNewTab: boolean;
  requiresCompanionOnMobile: boolean;
  defaultMode: "STREAM" | "COMPANION";
}

/**
 * Evaluates the full device & browser capabilities.
 * Prioritizes feature detection (existence of APIs) over UA parsing wherever possible.
 */
export function getDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      supportsDisplayCapture: false,
      supportsTabCapture: false,
      supportsAudioCapture: false,
      supportsWebRTC: false,
      supportsVoice: false,
      isMobile: false,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChromium: false,
      isFirefox: false,
    };
  }

  const ua = navigator.userAgent || "";

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (typeof navigator.platform === "string" &&
      navigator.platform === "MacIntel" &&
      (navigator.maxTouchPoints || 0) > 1);

  const isAndroid = /Android/i.test(ua);
  const isMobile =
    isIOS ||
    isAndroid ||
    /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.maxTouchPoints || 0) > 1;

  const isFirefox = /Firefox\/([0-9]+)/i.test(ua);
  const isChromium =
    /Chrome\/([0-9]+)/i.test(ua) || /Chromium\/([0-9]+)/i.test(ua) || /Edg\/([0-9]+)/i.test(ua);
  const isSafari =
    /Safari\/([0-9]+)/i.test(ua) && !isChromium && !isFirefox && !/Android/i.test(ua);

  // WebRTC API checks
  const supportsWebRTC =
    typeof window.RTCPeerConnection !== "undefined" &&
    typeof window.MediaStream !== "undefined";

  const supportsAudioCapture =
    !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";

  // Native getDisplayMedia check
  const hasDisplayMediaFn =
    !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function";

  // Mobile OSes (iOS, Android) do not permit arbitrary tab screen capture
  const supportsDisplayCapture = hasDisplayMediaFn && !isIOS && !isAndroid;
  const supportsTabCapture = supportsDisplayCapture && (isChromium || isFirefox);
  const supportsVoice = supportsWebRTC && supportsAudioCapture;

  return {
    supportsDisplayCapture,
    supportsTabCapture,
    supportsAudioCapture,
    supportsWebRTC,
    supportsVoice,
    isMobile,
    isIOS,
    isAndroid,
    isSafari,
    isChromium,
    isFirefox,
  };
}

/**
 * Detects whether the current browser supports tab/screen capture.
 * Mobile browsers (iOS Safari, Android Chrome) lack or restrict `getDisplayMedia`.
 */
export function isBrowserScreenShareSupported(): boolean {
  return getDeviceCapabilities().supportsDisplayCapture;
}

export function isMobileDevice(): boolean {
  return getDeviceCapabilities().isMobile;
}

/**
 * Returns technical capabilities for a given provider.
 * Does not make false claims about playback synchronization on DRM OTT platforms.
 */
export function getProviderTechnicalCapability(
  providerId: string,
): ProviderTechnicalCapability {
  const norm = (providerId || "").toLowerCase();
  const screenSharePossible = isBrowserScreenShareSupported();

  // Direct web video, Network Stream, and YouTube support embedded synchronized control
  if (
    norm === "youtube" ||
    norm === "webvideo" ||
    norm === "direct" ||
    norm.includes("network stream") ||
    norm.includes("direct sync")
  ) {
    return {
      canDeepLink: true,
      canScreenShare: screenSharePossible,
      canPlaybackControl: true,
      canSync: true,
      canOpenInNewTab: true,
      requiresCompanionOnMobile: false,
      defaultMode: "STREAM",
    };
  }

  // DRM OTT Services: JioHotstar, Netflix, Prime Video, Apple TV, Disney, etc.
  // MadLove provides screen-share companion mode, NOT direct OTT playback control!
  return {
    canDeepLink: true,
    canScreenShare: screenSharePossible,
    canPlaybackControl: false, // Honest: MadLove cannot play/pause external DRM tabs
    canSync: false, // Sync markers and session clocks used instead
    canOpenInNewTab: true,
    requiresCompanionOnMobile: true,
    defaultMode: screenSharePossible ? "STREAM" : "COMPANION",
  };
}

export type TheaterDisplayMode = "LIVE_WEBRTC_THEATER" | "COMPANION_MODE";

/**
 * Deterministically determines whether to render the Live WebRTC Cinema stage
 * or the synchronized Companion Mode.
 */
export function resolveTheaterDisplayMode(options: {
  isHost: boolean;
  hasActiveRemoteStream: boolean;
  hasActiveLocalStream: boolean;
  forcedFallback: boolean;
}): TheaterDisplayMode {
  const { isHost, hasActiveRemoteStream, hasActiveLocalStream, forcedFallback } = options;

  if (forcedFallback) {
    return "COMPANION_MODE";
  }

  const caps = getDeviceCapabilities();

  // If Host is on mobile, Host cannot capture tab, so Host must use Companion Mode
  if (isHost && !caps.supportsDisplayCapture && !hasActiveLocalStream) {
    return "COMPANION_MODE";
  }

  // If Viewer has active remote stream, always display the live theater!
  if (!isHost && hasActiveRemoteStream) {
    return "LIVE_WEBRTC_THEATER";
  }

  // If Host has active local stream, display the live theater!
  if (isHost && hasActiveLocalStream) {
    return "LIVE_WEBRTC_THEATER";
  }

  // Default to live theater structure so user sees controls / waiting lounge,
  // unless user manually switches or mobile host.
  return "LIVE_WEBRTC_THEATER";
}
