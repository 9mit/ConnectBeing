CREATE TYPE "public"."relationship_event_type" AS ENUM('message_sent', 'mood_logged', 'quiz_completed', 'watch_started', 'watch_ended', 'call_started', 'call_ended', 'memory_added', 'achievement_unlocked', 'challenge_completed');--> statement-breakpoint
CREATE TYPE "public"."streaming_provider" AS ENUM('netflix', 'prime', 'disney', 'apple', 'jiohotstar', 'sonyliv', 'zee5', 'crunchyroll', 'youtube', 'other');--> statement-breakpoint
CREATE TYPE "public"."watch_event_type" AS ENUM('play', 'pause', 'seek');--> statement-breakpoint
CREATE TYPE "public"."watch_session_status" AS ENUM('scheduled', 'active', 'completed', 'cancelled');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_tier" "subscription_tier" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "razorpay_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "e2ee_public_key" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"razorpay_subscription_id" text NOT NULL,
	"razorpay_plan_id" text NOT NULL,
	"tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscriptions_razorpay_subscription_id_unique" UNIQUE("razorpay_subscription_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"provider" "streaming_provider" NOT NULL,
	"title" text NOT NULL,
	"poster_url" text,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "watch_session_status" DEFAULT 'scheduled' NOT NULL,
	"invitation_message" text,
	"theme" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch_events" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"event_type" "watch_event_type" NOT NULL,
	"playback_position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"playback_position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "movie_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"session_id" text NOT NULL,
	"title" text NOT NULL,
	"poster_url" text,
	"watch_duration" integer NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"ai_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relationship_events" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"actor_user_id" text,
	"event_type" "relationship_event_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'star' NOT NULL,
	CONSTRAINT "achievements_code_unique" UNIQUE("code")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"user_id" text NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"title" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "room_customizations" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"theme" text DEFAULT 'rose-dusk' NOT NULL,
	"decor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_customizations_couple_id_unique" UNIQUE("couple_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"goal" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_sessions" ADD CONSTRAINT "watch_sessions_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_participants" ADD CONSTRAINT "watch_participants_session_id_watch_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."watch_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_participants" ADD CONSTRAINT "watch_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_events" ADD CONSTRAINT "watch_events_session_id_watch_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."watch_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_events" ADD CONSTRAINT "watch_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_messages" ADD CONSTRAINT "watch_messages_session_id_watch_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."watch_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_messages" ADD CONSTRAINT "watch_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movie_memories" ADD CONSTRAINT "movie_memories_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movie_memories" ADD CONSTRAINT "movie_memories_session_id_watch_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."watch_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relationship_events" ADD CONSTRAINT "relationship_events_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relationship_events" ADD CONSTRAINT "relationship_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reminders" ADD CONSTRAINT "reminders_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "room_customizations" ADD CONSTRAINT "room_customizations_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "challenges" ADD CONSTRAINT "challenges_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_sessions_couple_id_idx" ON "watch_sessions" USING btree ("couple_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relationship_events_couple_created_idx" ON "relationship_events" USING btree ("couple_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_unique" ON "user_achievements" USING btree ("couple_id","user_id","achievement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminders_couple_due_idx" ON "reminders" USING btree ("couple_id","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenges_couple_status_idx" ON "challenges" USING btree ("couple_id","status");--> statement-breakpoint
INSERT INTO "achievements" ("id", "code", "title", "description", "icon") VALUES
  ('ach_first_message', 'first_message', 'First Spark', 'Send your first message together', 'message'),
  ('ach_first_quiz', 'first_quiz', 'Quiz Duo', 'Complete a daily quiz', 'quiz'),
  ('ach_first_watch', 'first_watch', 'Movie Night', 'Finish a Together watch session', 'film'),
  ('ach_mood_streak', 'mood_logger', 'Mood Mirror', 'Log a mood check-in', 'heart'),
  ('ach_seven_days', 'week_together', 'Seven Days', 'Reach 7 days of couple calibration', 'calendar')
ON CONFLICT ("code") DO NOTHING;
