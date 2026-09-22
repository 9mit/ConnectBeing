-- Migration: 0009_couple_members_hardening.sql
-- Production hardening for couple identity, membership, and invite tokens.

-- 1. Make couples.user_b_id nullable to allow Partner A to pre-create pending couple
ALTER TABLE "couples" ALTER COLUMN "user_b_id" DROP NOT NULL;

-- 2. Create couple_members table
CREATE TABLE IF NOT EXISTS "couple_members" (
  "id" text PRIMARY KEY,
  "couple_id" text NOT NULL REFERENCES "couples"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'creator',
  "status" text NOT NULL DEFAULT 'active',
  "joined_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique index enforcing that a user can have at most ONE active couple membership
CREATE UNIQUE INDEX IF NOT EXISTS "couple_members_active_user_uidx" 
  ON "couple_members" ("user_id") 
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "couple_members_couple_user_uidx" 
  ON "couple_members" ("couple_id", "user_id");

CREATE INDEX IF NOT EXISTS "couple_members_couple_id_idx" 
  ON "couple_members" ("couple_id");

CREATE INDEX IF NOT EXISTS "couple_members_user_id_idx" 
  ON "couple_members" ("user_id");

-- 3. Enhance invite_tokens table
ALTER TABLE "invite_tokens" ADD COLUMN IF NOT EXISTS "couple_id" text REFERENCES "couples"("id") ON DELETE CASCADE;
ALTER TABLE "invite_tokens" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "invite_tokens" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "invite_tokens_couple_id_idx" ON "invite_tokens" ("couple_id");
CREATE INDEX IF NOT EXISTS "invite_tokens_status_idx" ON "invite_tokens" ("status");

-- 4. Backfill existing couples into couple_members
INSERT INTO "couple_members" ("id", "couple_id", "user_id", "role", "status", "joined_at")
SELECT 
  'cm_a_' || c.id, c.id, c.user_a_id, 'creator', 'active', c.created_at
FROM "couples" c
WHERE NOT EXISTS (
  SELECT 1 FROM "couple_members" cm WHERE cm.couple_id = c.id AND cm.user_id = c.user_a_id
);

INSERT INTO "couple_members" ("id", "couple_id", "user_id", "role", "status", "joined_at")
SELECT 
  'cm_b_' || c.id, c.id, c.user_b_id, 'partner', 'active', c.created_at
FROM "couples" c
WHERE c.user_b_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "couple_members" cm WHERE cm.couple_id = c.id AND cm.user_id = c.user_b_id
);

-- 5. Backfill existing invite_tokens
UPDATE "invite_tokens" it
SET 
  "couple_id" = u.couple_id,
  "status" = CASE WHEN it.used = true THEN 'accepted' ELSE 'pending' END,
  "accepted_at" = CASE WHEN it.used = true THEN it.created_at ELSE NULL END
FROM "users" u
WHERE it.inviter_id = u.id AND it.couple_id IS NULL AND u.couple_id IS NOT NULL;

-- 6. Row-Level Security for couple_members
ALTER TABLE "couple_members" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.madlove_app_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM users u
  WHERE u.supabase_auth_id = auth.uid()::text
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.madlove_user_couple_ids()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.couple_id
  FROM couple_members cm
  JOIN users u ON u.id = cm.user_id
  WHERE u.supabase_auth_id = auth.uid()::text
    AND cm.status = 'active';
$$;

DROP POLICY IF EXISTS couple_members_select_member ON "couple_members";
CREATE POLICY couple_members_select_member ON "couple_members"
  FOR SELECT TO authenticated
  USING (
    user_id = public.madlove_app_user_id()
    OR couple_id IN (SELECT public.madlove_user_couple_ids())
  );

GRANT SELECT ON TABLE "couple_members" TO authenticated;
