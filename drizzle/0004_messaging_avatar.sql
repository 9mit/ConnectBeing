-- Avatar + messaging reliability
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "avatar_url" text;

DO $$ BEGIN
  CREATE TYPE "public"."message_delivery_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "client_msg_id" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "delivery_status" "message_delivery_status" DEFAULT 'sent' NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "messages_couple_client_msg_uidx"
  ON "messages" ("couple_id", "client_msg_id")
  WHERE "client_msg_id" IS NOT NULL;
