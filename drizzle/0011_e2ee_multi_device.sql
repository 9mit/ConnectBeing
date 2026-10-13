-- Migration: 0011_e2ee_multi_device.sql
-- True End-to-End Encryption: Multi-device enrollment, public key store & client-side encrypted key escrow

CREATE TABLE IF NOT EXISTS "user_devices" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "device_id" text NOT NULL,
  "device_name" text NOT NULL,
  "public_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_devices_user_device_uidx"
  ON "user_devices" ("user_id", "device_id");

CREATE INDEX IF NOT EXISTS "user_devices_user_id_idx"
  ON "user_devices" ("user_id");

CREATE TABLE IF NOT EXISTS "user_key_escrow" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "device_id" text NOT NULL,
  "encrypted_key_package" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_key_escrow_user_device_uidx"
  ON "user_key_escrow" ("user_id", "device_id");

CREATE INDEX IF NOT EXISTS "user_key_escrow_user_id_idx"
  ON "user_key_escrow" ("user_id");

-- Enable Row Level Security
ALTER TABLE "user_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_key_escrow" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "user_devices" FROM anon;
REVOKE ALL ON TABLE "user_key_escrow" FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user_devices" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user_key_escrow" TO authenticated;

-- RLS: user_devices SELECT: user can select their own devices, or their active partner's devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_devices' AND policyname = 'user_devices_select_own_or_partner'
  ) THEN
    CREATE POLICY user_devices_select_own_or_partner ON user_devices
      FOR SELECT TO authenticated
      USING (
        user_id = public.madlove_app_user_id()
        OR user_id IN (
          SELECT user_a_id FROM couples WHERE user_b_id = public.madlove_app_user_id() AND status = 'active'
          UNION
          SELECT user_b_id FROM couples WHERE user_a_id = public.madlove_app_user_id() AND status = 'active'
        )
      );
  END IF;
END $$;

-- RLS: user_devices INSERT/UPDATE/DELETE: user can only modify their own devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_devices' AND policyname = 'user_devices_modify_own'
  ) THEN
    CREATE POLICY user_devices_modify_own ON user_devices
      FOR ALL TO authenticated
      USING (user_id = public.madlove_app_user_id())
      WITH CHECK (user_id = public.madlove_app_user_id());
  END IF;
END $$;

-- RLS: user_key_escrow ALL: strictly own user only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_key_escrow' AND policyname = 'user_key_escrow_own_only'
  ) THEN
    CREATE POLICY user_key_escrow_own_only ON user_key_escrow
      FOR ALL TO authenticated
      USING (user_id = public.madlove_app_user_id())
      WITH CHECK (user_id = public.madlove_app_user_id());
  END IF;
END $$;
