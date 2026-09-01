-- Weekly couple verification
ALTER TABLE "couples" ADD COLUMN IF NOT EXISTS "verified_until" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "couple_verifications" (
  "id" text PRIMARY KEY NOT NULL,
  "couple_id" text NOT NULL REFERENCES "couples"("id") ON DELETE cascade,
  "code_hash" text NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "revealed_to_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "couple_verifications_couple_period_idx"
  ON "couple_verifications" ("couple_id", "period_end");

CREATE TABLE IF NOT EXISTS "verification_attempt_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "couple_id" text NOT NULL REFERENCES "couples"("id") ON DELETE cascade,
  "actor_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "success" boolean NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_attempts_couple_created_idx"
  ON "verification_attempt_logs" ("couple_id", "created_at");

-- Existing couples start verified for 7 days from migration apply
UPDATE "couples"
SET "verified_until" = now() + interval '7 days'
WHERE "verified_until" IS NULL AND "status" = 'active';
