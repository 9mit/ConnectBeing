/**
 * Shaka Player Loader & Adapter for MPEG-DASH (.mpd) in CoupleConnect Direct Sync.
 * Dynamically loaded in the browser to avoid server-side rendering DOM errors.
 */

// We import shaka types dynamically or use any for runtime safety
export type ShakaPlayerInstance = any;

let shakaModulePromise: Promise<any> | null = null;

export async function loadShakaModule(): Promise<any | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (!shakaModulePromise) {
    shakaModulePromise = (async () => {
      try {
        const shaka = await import("shaka-player/dist/shaka-player.compiled.js");
        const resolvedShaka =
          (shaka as any).default?.Player
            ? (shaka as any).default
            : (shaka as any).Player
            ? shaka
            : (typeof window !== "undefined" && (window as any)?.shaka?.Player)
            ? (window as any).shaka
            : (shaka as any).default || shaka;
        if (resolvedShaka?.polyfill?.installAll) {
          resolvedShaka.polyfill.installAll();
        }
        return resolvedShaka;
      } catch (err) {
        console.warn("[ShakaLoader] Failed to dynamically load shaka-player:", err);
        return null;
      }
    })();
  }

  return shakaModulePromise;
}

export function isShakaSupported(): boolean {
  if (typeof window === "undefined") return false;
  // Shaka requires MediaSource
  return (
    typeof window.MediaSource !== "undefined" &&
    typeof window.MediaSource.isTypeSupported === "function"
  );
}
