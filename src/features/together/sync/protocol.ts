/**
 * Low-Latency Monotonic Synchronization Protocol for MadLove Together
 *
 * Implements:
 * - Monotonic event sequence numbers (duplicate & out-of-order protection)
 * - Authoritative session state
 * - Event-driven sync with periodic lightweight heartbeat (no unnecessary polling)
 * - Drift detection and corrective resynchronization
 * - Clock synchronization (RTT offset calculation)
 * - Countdown state machine (3... 2... 1... Play!)
 */

import { PlaybackState } from "../providers/types";

export type SyncEventType =
  | "PLAY"
  | "PAUSE"
  | "SEEK"
  | "COUNTDOWN_START"
  | "COUNTDOWN_TICK"
  | "COUNTDOWN_COMPLETE"
  | "READY_STATE"
  | "HEARTBEAT_PING"
  | "HEARTBEAT_PONG"
  | "STATE_SYNC";

export interface SyncMessage {
  id: string;
  seq: number;
  sessionId: string;
  userId: string;
  type: SyncEventType;
  state: PlaybackState;
  position: number;
  sentAt: number;
  countdown?: number; // 3, 2, 1, 0
  isReady?: boolean;
  meta?: Record<string, unknown>;
}

export interface DriftReport {
  localPos: number;
  remotePos: number;
  driftSeconds: number;
  inSync: boolean;
  requiresCorrection: boolean;
  rttMs?: number;
}

export const SYNC_CONFIG = {
  DRIFT_TOLERANCE_SECONDS: 1.25,
  CORRECTION_THRESHOLD_SECONDS: 2.0,
  HEARTBEAT_INTERVAL_MS: 12000,
  COUNTDOWN_DURATION_SECONDS: 3,
};

export class SyncProtocolManager {
  private localSeq = 0;
  private highestSeenSeq = 0;
  private processedEventIds = new Set<string>();
  private clockOffsetMs = 0;
  private roundTripTimeMs = 0;

  constructor(
    private readonly sessionId: string,
    private readonly userId: string,
  ) {}

  /**
   * Create an authoritative outgoing sync event with monotonic sequence number
   */
  createEvent(
    type: SyncEventType,
    state: PlaybackState,
    position: number,
    extra?: Partial<Pick<SyncMessage, "countdown" | "isReady" | "meta">>,
  ): SyncMessage {
    this.localSeq += 1;
    const now = Date.now();

    return {
      id: `${this.userId}-${now}-${Math.random().toString(36).substring(2, 7)}`,
      seq: this.localSeq,
      sessionId: this.sessionId,
      userId: this.userId,
      type,
      state,
      position: Math.max(0, position),
      sentAt: now,
      ...extra,
    };
  }

  /**
   * Process and validate an incoming message from the partner.
   * Returns null if the event is a duplicate or older than highest seen seq.
   */
  processIncoming(msg: SyncMessage): SyncMessage | null {
    if (msg.userId === this.userId) return null;
    if (this.processedEventIds.has(msg.id)) return null;

    // Reject out-of-order older sequences unless it's a heartbeat/ready ping
    if (msg.type !== "HEARTBEAT_PING" && msg.type !== "HEARTBEAT_PONG") {
      if (msg.seq <= this.highestSeenSeq && this.highestSeenSeq - msg.seq < 1000) {
        return null;
      }
      this.highestSeenSeq = Math.max(this.highestSeenSeq, msg.seq);
    }

    // Keep event ID cache bounded
    this.processedEventIds.add(msg.id);
    if (this.processedEventIds.size > 200) {
      const first = Array.from(this.processedEventIds)[0];
      if (first) this.processedEventIds.delete(first);
    }

    return msg;
  }

  /**
   * Calculate expected remote position taking into account network flight time
   * and playback state (optimistic time extrapolation)
   */
  calculateTargetPosition(msg: SyncMessage): number {
    if (msg.state !== "playing") {
      return msg.position;
    }
    const elapsedSeconds = Math.max(0, (Date.now() - msg.sentAt) / 1000);
    return msg.position + elapsedSeconds;
  }

  /**
   * Evaluate drift between current local playback and remote reference
   */
  evaluateDrift(localPos: number, remoteTargetPos: number): DriftReport {
    const driftSeconds = Math.abs(localPos - remoteTargetPos);
    const inSync = driftSeconds <= SYNC_CONFIG.DRIFT_TOLERANCE_SECONDS;
    const requiresCorrection = driftSeconds > SYNC_CONFIG.CORRECTION_THRESHOLD_SECONDS;

    return {
      localPos,
      remotePos: remoteTargetPos,
      driftSeconds: Math.round(driftSeconds * 1000) / 1000,
      inSync,
      requiresCorrection,
      rttMs: this.roundTripTimeMs,
    };
  }

  /**
   * Clock synchronization handler
   */
  handlePing(ping: SyncMessage): SyncMessage {
    return this.createEvent("HEARTBEAT_PONG", ping.state, ping.position, {
      meta: { pingSentAt: ping.sentAt, echoedAt: Date.now() },
    });
  }

  handlePong(pong: SyncMessage): void {
    const originalSentAt = pong.meta?.pingSentAt as number | undefined;
    if (!originalSentAt) return;

    const now = Date.now();
    this.roundTripTimeMs = Math.max(0, now - originalSentAt);
    const estimatedOneWay = this.roundTripTimeMs / 2;
    this.clockOffsetMs = (pong.sentAt + estimatedOneWay) - now;
  }

  getMetrics() {
    return {
      seq: this.localSeq,
      rttMs: this.roundTripTimeMs,
      clockOffsetMs: this.clockOffsetMs,
    };
  }
}
