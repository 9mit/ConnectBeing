CREATE TYPE "public"."archetype" AS ENUM('challenge', 'nurture', 'adventure');--> statement-breakpoint
CREATE TYPE "public"."couple_status" AS ENUM('pending', 'active', 'dissolved');--> statement-breakpoint
CREATE TYPE "public"."daily_task_style" AS ENUM('challenge', 'nurture', 'adventure');--> statement-breakpoint
CREATE TYPE "public"."ephemeral_media_status" AS ENUM('pending', 'delivered', 'viewed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'ephemeral_image', 'mood_update', 'system');--> statement-breakpoint
CREATE TYPE "public"."mood_value" AS ENUM('happy', 'cuddles', 'space', 'excited', 'low');--> statement-breakpoint
CREATE TYPE "public"."pet_state" AS ENUM('thriving', 'happy', 'neutral', 'sad', 'neglected');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'premium');--> statement-breakpoint
CREATE TYPE "public"."theme_token" AS ENUM('rose', 'violet', 'amber', 'sky');--> statement-breakpoint
CREATE TABLE "ai_insights" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"archetype" "archetype" NOT NULL,
	"strengths" text[] NOT NULL,
	"growth_areas" text[] NOT NULL,
	"suggested_theme" "theme_token" NOT NULL,
	"daily_task_style" "daily_task_style" NOT NULL,
	"raw_response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_insights_couple_id_unique" UNIQUE("couple_id")
);
--> statement-breakpoint
CREATE TABLE "couple_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"date" text NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"audio_minutes" integer DEFAULT 0 NOT NULL,
	"location_uptime_minutes" integer DEFAULT 0 NOT NULL,
	"quiz_completed" boolean DEFAULT false NOT NULL,
	"mood_logged" boolean DEFAULT false NOT NULL,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "couples" (
	"id" text PRIMARY KEY NOT NULL,
	"user_a_id" text NOT NULL,
	"user_b_id" text NOT NULL,
	"status" "couple_status" DEFAULT 'pending' NOT NULL,
	"anniversary_date" timestamp with time zone,
	"pet_name" text DEFAULT 'Buddy' NOT NULL,
	"pet_state" "pet_state" DEFAULT 'neutral' NOT NULL,
	"calibration_day" integer DEFAULT 0 NOT NULL,
	"is_calibrated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dissolved_at" timestamp with time zone,
	CONSTRAINT "couples_user_a_id_unique" UNIQUE("user_a_id"),
	CONSTRAINT "couples_user_b_id_unique" UNIQUE("user_b_id")
);
--> statement-breakpoint
CREATE TABLE "ephemeral_media" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"storage_key" text,
	"mime_type" text NOT NULL,
	"status" "ephemeral_media_status" DEFAULT 'pending' NOT NULL,
	"viewed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"inviter_id" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_by_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"uploader_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"caption" text,
	"taken_at" timestamp with time zone NOT NULL,
	"event_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"content" text,
	"ephemeral_media_id" text,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moods" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"user_id" text NOT NULL,
	"mood" "mood_value" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"gender" text NOT NULL,
	"hobbies" text[] DEFAULT '{}' NOT NULL,
	"self_description" text NOT NULL,
	"partner_expectation" text NOT NULL,
	"love_languages" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"date" text NOT NULL,
	"questions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"question_set_id" text NOT NULL,
	"couple_id" text NOT NULL,
	"user_id" text NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
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
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"supabase_auth_id" text NOT NULL,
	"email" text NOT NULL,
	"subscription_tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"razorpay_customer_id" text,
	"couple_id" text,
	"is_onboarded" boolean DEFAULT false NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_supabase_auth_id_unique" UNIQUE("supabase_auth_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couple_stats" ADD CONSTRAINT "couple_stats_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couples" ADD CONSTRAINT "couples_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couples" ADD CONSTRAINT "couples_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ephemeral_media" ADD CONSTRAINT "ephemeral_media_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ephemeral_media" ADD CONSTRAINT "ephemeral_media_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_used_by_id_users_id_fk" FOREIGN KEY ("used_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_ephemeral_media_id_ephemeral_media_id_fk" FOREIGN KEY ("ephemeral_media_id") REFERENCES "public"."ephemeral_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moods" ADD CONSTRAINT "moods_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moods" ADD CONSTRAINT "moods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD CONSTRAINT "onboarding_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_question_set_id_quiz_questions_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "couple_stats_couple_id_date_uidx" ON "couple_stats" USING btree ("couple_id","date");--> statement-breakpoint
CREATE INDEX "couples_status_idx" ON "couples" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ephemeral_media_status_idx" ON "ephemeral_media" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "invite_tokens_token_hash_uidx" ON "invite_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invite_tokens_inviter_id_idx" ON "invite_tokens" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "memories_couple_id_taken_at_idx" ON "memories" USING btree ("couple_id","taken_at");--> statement-breakpoint
CREATE INDEX "messages_couple_id_created_at_idx" ON "messages" USING btree ("couple_id","created_at");--> statement-breakpoint
CREATE INDEX "moods_couple_id_user_id_idx" ON "moods" USING btree ("couple_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_questions_couple_id_date_uidx" ON "quiz_questions" USING btree ("couple_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_responses_question_set_user_uidx" ON "quiz_responses" USING btree ("question_set_id","user_id");--> statement-breakpoint
CREATE INDEX "users_couple_id_idx" ON "users" USING btree ("couple_id");