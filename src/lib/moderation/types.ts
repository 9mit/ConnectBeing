/**
 * Shared moderation types.
 *
 * Phase 5 pipeline:
 * 1. Presigned upload → client uploads to Storage
 * 2. Confirm Server Action downloads/reads object bytes server-side (or receives key)
 * 3. ModerationProvider.checkImage(...)
 * 4. If rejected: delete Storage object, return 422 with reasonCode — never write DB
 * 5. If clean: insert ephemeral_media / memories
 */

export type ModerationReasonCode =
  | "EXPLICIT_NUDITY"
  | "SEXUAL_CONTENT"
  | "UNSAFE_CONTENT"
  | "PROVIDER_ERROR";

export type ModerationLabel =
  | "FEMALE_GENITALIA_EXPOSED"
  | "MALE_GENITALIA_EXPOSED"
  | "BUTTOCKS_EXPOSED"
  | "FEMALE_BREAST_EXPOSED"
  | "ANUS_EXPOSED"
  | "BELLY_EXPOSED"
  | "FEET_EXPOSED"
  | "ARMPITS_EXPOSED"
  | "FACE_FEMALE"
  | "FACE_MALE"
  | "OTHER";

export interface ModerationDetection {
  label: ModerationLabel | string;
  score: number;
}

export interface ModerationResult {
  /** true when the image is allowed to be persisted */
  safe: boolean;
  reasonCode?: ModerationReasonCode;
  detections: ModerationDetection[];
  provider: "nudenet" | "google_vision" | "allow_all";
}

export interface ModerationProvider {
  readonly name: "nudenet" | "google_vision" | "allow_all";
  checkImage(bytes: Buffer, mimeType: string): Promise<ModerationResult>;
}
