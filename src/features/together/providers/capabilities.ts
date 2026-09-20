/**
 * Smart Provider Capabilities & Environment Detection for MadLove Together
 *
 * Enforces strict honesty regarding OTT control:
 * - MadLove never fakes direct player control over third-party DRM OTTs (Netflix, JioHotstar, Prime Video, etc.)
 * - Browser tab capture is offered only where native `getDisplayMedia` is supported.
 * - Mobile platforms and unsupported browsers automatically activate Companion Mode.
 */

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
 * Detects whether the current browser supports tab/screen capture.
 * Mobile browsers (iOS Safari, Android Chrome) lack or restrict `getDisplayMedia`.
 */
export function isBrowserScreenShareSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // Check if navigator.mediaDevices.getDisplayMedia exists
  const hasDisplayMedia =
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function";

  if (!hasDisplayMedia) return false;

  // iOS Safari / Chrome on iOS does not support getDisplayMedia
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return false;

  // Android browser check
  const isAndroid = /Android/i.test(ua);
  if (isAndroid) return false;

  return true;
}

export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/**
 * Returns technical capabilities for a given provider.
 * Does not make false claims about playback synchronization on DRM OTT platforms.
 */
export function getProviderTechnicalCapability(
  providerId: string,
): ProviderTechnicalCapability {
  const norm = providerId.toLowerCase();
  const screenSharePossible = isBrowserScreenShareSupported();

  // YouTube can have embedded API control if embedded
  if (norm === "youtube") {
    return {
      canDeepLink: true,
      canScreenShare: screenSharePossible,
      canPlaybackControl: true,
      canSync: true,
      canOpenInNewTab: true,
      requiresCompanionOnMobile: true,
      defaultMode: screenSharePossible ? "STREAM" : "COMPANION",
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
