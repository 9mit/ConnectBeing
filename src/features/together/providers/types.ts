export type PlaybackState = "playing" | "paused" | "buffering" | "idle";

export interface SyncPayload {
  state: PlaybackState;
  timestamp: number; // current video timestamp in seconds
  updatedAt: number; // local Date.now() when state was captured
}

export interface StreamingProvider {
  /** The unique ID of the provider (e.g., 'netflix', 'prime') */
  id: string;

  /** Display name of the provider */
  name: string;

  /** Primary color for UI branding */
  color: string;

  /** Returns true if this provider is supported on the current device/browser */
  supportedCapabilities(): {
    sync: boolean;
    deepLink: boolean;
  };

  /**
   * Generates a deep link URL to launch the content natively or in a new tab.
   * @param contentId The specific movie or show identifier
   */
  deepLink(contentId: string): string;

  /**
   * Abstract connection logic. For extensions, this would inject a script.
   * For MVP "simulate sync", this might just setup listeners.
   */
  connect(): Promise<void>;

  /**
   * Abstract disconnection logic.
   */
  disconnect(): Promise<void>;
}
