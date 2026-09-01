-- Shared space features: calendar events, time capsules, in-app notifications
-- Style follows 0005: idempotent statements (safe to re-apply).

-- ---------------------------------------------------------------------------
-- calendar_events — shared couple date nights, rituals & anniversaries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "calendar_events" (
  "id" text PRIMARY KEY NOT NULL,
  "couple_id" text NOT NULL REFERENCES "couples"("id") ON DELETE cascade,
  "created_by_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "event_date" timestamp with time zone NOT NULL,
  "category" text DEFAULT 'date_night' NOT NULL,
  "reminder_hours" integer DEFAULT 24 NOT NULL,
  "completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "calendar_events_couple_date_idx"
  ON "calendar_events" ("couple_id", "event_date");

-- ---------------------------------------------------------------------------
-- time_capsules — sealed memories unlocked on future dates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "time_capsules" (
  "id" text PRIMARY KEY NOT NULL,
  "couple_id" text NOT NULL REFERENCES "couples"("id") ON DELETE cascade,
  "created_by_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "media_storage_key" text,
  "unlock_at" timestamp with time zone NOT NULL,
  "is_unlocked" boolean DEFAULT false NOT NULL,
  "unlocked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "time_capsules_couple_unlock_idx"
  ON "time_capsules" ("couple_id", "unlock_at");

-- ---------------------------------------------------------------------------
-- in_app_notifications — couple activity feed and ritual reminders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "in_app_notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "couple_id" text NOT NULL REFERENCES "couples"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "kind" text DEFAULT 'general' NOT NULL,
  "link" text,
  "read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "in_app_notifications_user_read_idx"
  ON "in_app_notifications" ("user_id", "read", "created_at");

-- ---------------------------------------------------------------------------
-- RLS + grants (match 0006: deny-by-default for PostgREST; server actions
-- use DATABASE_URL as table owner and are unaffected)
-- ---------------------------------------------------------------------------

ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "time_capsules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "in_app_notifications" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE "calendar_events" TO authenticated;
GRANT SELECT ON TABLE "time_capsules" TO authenticated;
GRANT SELECT ON TABLE "in_app_notifications" TO authenticated;
