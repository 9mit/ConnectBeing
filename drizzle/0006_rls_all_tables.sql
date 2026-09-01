-- MadLove: RLS on ALL public tables (deny-by-default for PostgREST)
-- Server Actions use DATABASE_URL (table owner / bypass) and are unaffected.
-- Authenticated clients only get SELECT where explicitly granted below.

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
  SELECT u.couple_id
  FROM users u
  WHERE u.supabase_auth_id = auth.uid()::text
    AND u.couple_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.madlove_is_couple_member(p_couple_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.madlove_user_couple_ids() c WHERE c = p_couple_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every application table
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invite_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "couples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ephemeral_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "moods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "couple_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watch_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watch_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watch_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watch_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movie_memories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "relationship_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "achievements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_achievements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reminders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_customizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "couple_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_attempt_logs" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Revoke anon everywhere
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE "users" FROM anon;
REVOKE ALL ON TABLE "onboarding_profiles" FROM anon;
REVOKE ALL ON TABLE "invite_tokens" FROM anon;
REVOKE ALL ON TABLE "couples" FROM anon;
REVOKE ALL ON TABLE "messages" FROM anon;
REVOKE ALL ON TABLE "ephemeral_media" FROM anon;
REVOKE ALL ON TABLE "memories" FROM anon;
REVOKE ALL ON TABLE "moods" FROM anon;
REVOKE ALL ON TABLE "quiz_questions" FROM anon;
REVOKE ALL ON TABLE "quiz_responses" FROM anon;
REVOKE ALL ON TABLE "couple_stats" FROM anon;
REVOKE ALL ON TABLE "ai_insights" FROM anon;
REVOKE ALL ON TABLE "watch_sessions" FROM anon;
REVOKE ALL ON TABLE "watch_participants" FROM anon;
REVOKE ALL ON TABLE "watch_events" FROM anon;
REVOKE ALL ON TABLE "watch_messages" FROM anon;
REVOKE ALL ON TABLE "movie_memories" FROM anon;
REVOKE ALL ON TABLE "subscriptions" FROM anon;
REVOKE ALL ON TABLE "relationship_events" FROM anon;
REVOKE ALL ON TABLE "achievements" FROM anon;
REVOKE ALL ON TABLE "user_achievements" FROM anon;
REVOKE ALL ON TABLE "reminders" FROM anon;
REVOKE ALL ON TABLE "room_customizations" FROM anon;
REVOKE ALL ON TABLE "challenges" FROM anon;
REVOKE ALL ON TABLE "couple_verifications" FROM anon;
REVOKE ALL ON TABLE "verification_attempt_logs" FROM anon;

-- ---------------------------------------------------------------------------
-- Authenticated SELECT policies (couple / self scoped)
-- No INSERT/UPDATE/DELETE via PostgREST — mutations stay on Server Actions.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS users_select_self ON "users";
CREATE POLICY users_select_self ON "users"
  FOR SELECT TO authenticated
  USING (
    id = public.madlove_app_user_id()
    OR (
      couple_id IS NOT NULL
      AND couple_id IN (SELECT public.madlove_user_couple_ids())
    )
  );

DROP POLICY IF EXISTS onboarding_profiles_select_couple ON "onboarding_profiles";
CREATE POLICY onboarding_profiles_select_couple ON "onboarding_profiles"
  FOR SELECT TO authenticated
  USING (
    user_id = public.madlove_app_user_id()
    OR user_id IN (
      SELECT u.id FROM users u
      WHERE u.couple_id IN (SELECT public.madlove_user_couple_ids())
    )
  );

-- invite_tokens: server-only (RLS on, no authenticated grant)

DROP POLICY IF EXISTS couples_select_member ON "couples";
CREATE POLICY couples_select_member ON "couples"
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS messages_select_member ON "messages";
CREATE POLICY messages_select_member ON "messages"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS ephemeral_media_select_member ON "ephemeral_media";
CREATE POLICY ephemeral_media_select_member ON "ephemeral_media"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS memories_select_member ON "memories";
CREATE POLICY memories_select_member ON "memories"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS moods_select_member ON "moods";
CREATE POLICY moods_select_member ON "moods"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS quiz_questions_select_auth ON "quiz_questions";
CREATE POLICY quiz_questions_select_auth ON "quiz_questions"
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS quiz_responses_select_couple ON "quiz_responses";
CREATE POLICY quiz_responses_select_couple ON "quiz_responses"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS couple_stats_select_member ON "couple_stats";
CREATE POLICY couple_stats_select_member ON "couple_stats"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS ai_insights_select_member ON "ai_insights";
CREATE POLICY ai_insights_select_member ON "ai_insights"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS watch_sessions_select_member ON "watch_sessions";
CREATE POLICY watch_sessions_select_member ON "watch_sessions"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS watch_participants_select_member ON "watch_participants";
CREATE POLICY watch_participants_select_member ON "watch_participants"
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT ws.id FROM watch_sessions ws
      WHERE ws.couple_id IN (SELECT public.madlove_user_couple_ids())
    )
  );

DROP POLICY IF EXISTS watch_events_select_member ON "watch_events";
CREATE POLICY watch_events_select_member ON "watch_events"
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT ws.id FROM watch_sessions ws
      WHERE ws.couple_id IN (SELECT public.madlove_user_couple_ids())
    )
  );

DROP POLICY IF EXISTS watch_messages_select_member ON "watch_messages";
CREATE POLICY watch_messages_select_member ON "watch_messages"
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT ws.id FROM watch_sessions ws
      WHERE ws.couple_id IN (SELECT public.madlove_user_couple_ids())
    )
  );

DROP POLICY IF EXISTS movie_memories_select_member ON "movie_memories";
CREATE POLICY movie_memories_select_member ON "movie_memories"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS subscriptions_select_member ON "subscriptions";
CREATE POLICY subscriptions_select_member ON "subscriptions"
  FOR SELECT TO authenticated
  USING (
    user_id = public.madlove_app_user_id()
    OR user_id IN (
      SELECT u.id FROM users u
      WHERE u.couple_id IN (SELECT public.madlove_user_couple_ids())
    )
  );

DROP POLICY IF EXISTS relationship_events_select_member ON "relationship_events";
CREATE POLICY relationship_events_select_member ON "relationship_events"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS achievements_select_auth ON "achievements";
CREATE POLICY achievements_select_auth ON "achievements"
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS user_achievements_select_couple ON "user_achievements";
CREATE POLICY user_achievements_select_couple ON "user_achievements"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS reminders_select_couple ON "reminders";
CREATE POLICY reminders_select_couple ON "reminders"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS room_customizations_select_member ON "room_customizations";
CREATE POLICY room_customizations_select_member ON "room_customizations"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS challenges_select_member ON "challenges";
CREATE POLICY challenges_select_member ON "challenges"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

-- Verification tables: no PostgREST SELECT (hashes / attempt logs stay server-only)
-- couple_verifications / verification_attempt_logs: RLS on, no grants

GRANT SELECT ON TABLE "users" TO authenticated;
GRANT SELECT ON TABLE "onboarding_profiles" TO authenticated;
GRANT SELECT ON TABLE "couples" TO authenticated;
GRANT SELECT ON TABLE "messages" TO authenticated;
GRANT SELECT ON TABLE "ephemeral_media" TO authenticated;
GRANT SELECT ON TABLE "memories" TO authenticated;
GRANT SELECT ON TABLE "moods" TO authenticated;
GRANT SELECT ON TABLE "quiz_questions" TO authenticated;
GRANT SELECT ON TABLE "quiz_responses" TO authenticated;
GRANT SELECT ON TABLE "couple_stats" TO authenticated;
GRANT SELECT ON TABLE "ai_insights" TO authenticated;
GRANT SELECT ON TABLE "watch_sessions" TO authenticated;
GRANT SELECT ON TABLE "watch_participants" TO authenticated;
GRANT SELECT ON TABLE "watch_events" TO authenticated;
GRANT SELECT ON TABLE "watch_messages" TO authenticated;
GRANT SELECT ON TABLE "movie_memories" TO authenticated;
GRANT SELECT ON TABLE "subscriptions" TO authenticated;
GRANT SELECT ON TABLE "relationship_events" TO authenticated;
GRANT SELECT ON TABLE "achievements" TO authenticated;
GRANT SELECT ON TABLE "user_achievements" TO authenticated;
GRANT SELECT ON TABLE "reminders" TO authenticated;
GRANT SELECT ON TABLE "room_customizations" TO authenticated;
GRANT SELECT ON TABLE "challenges" TO authenticated;

REVOKE ALL ON TABLE "invite_tokens" FROM authenticated;
REVOKE ALL ON TABLE "couple_verifications" FROM authenticated;
REVOKE ALL ON TABLE "verification_attempt_logs" FROM authenticated;

-- Index for watch message session lookups
CREATE INDEX IF NOT EXISTS "watch_messages_session_id_idx"
  ON "watch_messages" ("session_id");

-- Backfill verified_until for any active couple still null
UPDATE "couples"
SET "verified_until" = now() + interval '7 days'
WHERE "verified_until" IS NULL AND "status" = 'active';
