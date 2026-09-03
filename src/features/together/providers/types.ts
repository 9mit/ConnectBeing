/**
 * Universal OTT Provider Architecture & Capability-Based Models
 * MadLove Together — Universal Watch-Party Layer
 */

export type PlaybackState = "playing" | "paused" | "buffering" | "idle";

/**
 * 4-Tier Fallback Model for Streaming Platforms
 * - Level 1: Full in-engine synchronization (HTML5 / YouTube / Embeddable APIs)
 * - Level 2: Browser/extension-assisted synchronization (when client companion is present)
 * - Level 3: Launch + synchronized countdown and session clock (DRM OTTs: Netflix, Prime, Hotstar)
 * - Level 4: Companion mode (synchronized chat, voice, reactions, timeline & memories)
 */
export type CapabilityLevel = 1 | 2 | 3 | 4;

export type ProviderAvailability =
  | "available"
  | "unavailable"
  | "region-restricted"
  | "unknown";

export type ContentType = "movie" | "series" | "episode" | "video";

export interface ProviderCapabilities {
  deepLink: boolean;
  browserPlayback: boolean;
  extensionControl: boolean;
  playbackSynchronization: boolean;
  currentTimeDetection: boolean;
  playPauseControl: boolean;
  seekControl: boolean;
  episodeDetection: boolean;
  metadataLookup: boolean;
}

export interface ContentReference {
  contentId: string;
  providerId: string;
  title: string;
  type?: ContentType;
  season?: number;
  episode?: number;
  customUrl?: string;
}

export interface ContentSearchResult {
  id: string;
  contentId: string;
  providerId: string;
  providerName: string;
  title: string;
  type: ContentType;
  year?: number;
  genre?: string[];
  runtimeMinutes?: number;
  rating?: string;
  posterUrl?: string;
  synopsis?: string;
  availability: ProviderAvailability;
  availableRegions?: string[];
  launchUrl: string;
}

export interface ContentDetails extends ContentSearchResult {
  directStreamable: boolean;
  capabilityLevel: CapabilityLevel;
  seasonsCount?: number;
  episodesCount?: number;
  cast?: string[];
}

export interface WatchSessionInput {
  coupleId: string;
  userId: string;
  content: ContentReference;
  scheduledFor?: Date;
  invitationMessage?: string;
  theme?: string;
}

export interface WatchSessionResult {
  sessionId: string;
  launchUrl: string;
  capabilityLevel: CapabilityLevel;
  capabilities: ProviderCapabilities;
}

export interface SyncPayload {
  state: PlaybackState;
  timestamp: number; // current video timestamp in seconds
  updatedAt: number; // local Date.now() when captured
  seq?: number;      // monotonic sequence number
}

/**
 * Universal Streaming Provider Adapter Interface
 * All OTT services must implement this provider-agnostic interface.
 */
export interface StreamingProvider {
  /** Unique provider identifier (e.g. 'netflix', 'jiohotstar', 'prime') */
  readonly id: string;

  /** Human-readable display name */
  readonly name: string;

  /** Provider brand theme color (hex) */
  readonly brandColor: string;

  /** Primary regions serviced (e.g. ['IN', 'GLOBAL', 'US']) */
  readonly primaryRegions: string[];

  /** Effective capability level under current execution environment */
  readonly capabilityLevel: CapabilityLevel;

  /** Capability flags supported by this provider */
  getCapabilities(): ProviderCapabilities;

  /** Checks if the provider service is operational in the user's environment */
  detectAvailability(region?: string): Promise<ProviderAvailability>;

  /** Searches content catalog or metadata index */
  searchContent(query: string, region?: string): Promise<ContentSearchResult[]>;

  /** Retrieves detailed metadata for a specific content title */
  getContentDetails(contentId: string): Promise<ContentDetails | null>;

  /** Creates and initializes a watch session for this content */
  createWatchSession(input: WatchSessionInput): Promise<WatchSessionResult>;

  /** Generates a legitimate deep link or launch URL */
  generateLaunchUrl(content: ContentReference): Promise<string>;
}
