-- Migration: 0010_doodle_canvas.sql
-- Lightweight persistent collaborative sketchbook for couples
-- Follows idempotent style: safe to re-apply.

CREATE TABLE IF NOT EXISTS "doodle_canvases" (
  "id" text PRIMARY KEY NOT NULL,
  "couple_id" text NOT NULL REFERENCES "couples"("id") ON DELETE cascade,
  "strokes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "snapshot" text,
  "version" integer DEFAULT 1 NOT NULL,
  "last_drawn_by_id" text REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "doodle_canvases_couple_uidx"
  ON "doodle_canvases" ("couple_id");

-- Enable Row Level Security (RLS)
ALTER TABLE "doodle_canvases" ENABLE ROW LEVEL SECURITY;

-- Revoke anon everywhere
REVOKE ALL ON TABLE "doodle_canvases" FROM anon;

-- Grant select to authenticated
GRANT SELECT ON TABLE "doodle_canvases" TO authenticated;

-- Allow authenticated couple members to SELECT their shared canvas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'doodle_canvases' AND policyname = 'doodle_canvases_select_couple'
  ) THEN
    CREATE POLICY doodle_canvases_select_couple ON doodle_canvases
      FOR SELECT TO authenticated
      USING (couple_id IN (SELECT public.madlove_user_couple_ids()));
  END IF;
END $$;

