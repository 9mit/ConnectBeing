-- MadLove RLS for Realtime-exposed tables
-- Policies: authenticated user may only read rows for couples they belong to.
-- Server actions continue to use DATABASE_URL (service/pooler) and bypass RLS.

ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "moods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watch_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watch_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watch_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ephemeral_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memories" ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS messages_select_member ON "messages";
CREATE POLICY messages_select_member ON "messages"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS moods_select_member ON "moods";
CREATE POLICY moods_select_member ON "moods"
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT public.madlove_user_couple_ids()));

DROP POLICY IF EXISTS watch_messages_select_member ON "watch_messages";
CREATE POLICY watch_messages_select_member ON "watch_messages"
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

DROP POLICY IF EXISTS watch_sessions_select_member ON "watch_sessions";
CREATE POLICY watch_sessions_select_member ON "watch_sessions"
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

-- Deny anon direct table access (Realtime uses authenticated JWT when signed in)
REVOKE ALL ON TABLE "messages" FROM anon;
REVOKE ALL ON TABLE "moods" FROM anon;
REVOKE ALL ON TABLE "watch_messages" FROM anon;
REVOKE ALL ON TABLE "watch_events" FROM anon;
REVOKE ALL ON TABLE "watch_sessions" FROM anon;
REVOKE ALL ON TABLE "ephemeral_media" FROM anon;
REVOKE ALL ON TABLE "memories" FROM anon;

GRANT SELECT ON TABLE "messages" TO authenticated;
GRANT SELECT ON TABLE "moods" TO authenticated;
GRANT SELECT ON TABLE "watch_messages" TO authenticated;
GRANT SELECT ON TABLE "watch_events" TO authenticated;
GRANT SELECT ON TABLE "watch_sessions" TO authenticated;
GRANT SELECT ON TABLE "ephemeral_media" TO authenticated;
GRANT SELECT ON TABLE "memories" TO authenticated;
