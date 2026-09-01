-- Private Realtime channel authorization (Supabase Realtime Authorization)
-- Requires Realtime Authorization enabled in the project dashboard.

CREATE OR REPLACE FUNCTION public.madlove_realtime_couple_allowed()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  topic text := realtime.topic();
  couple text;
BEGIN
  IF topic IS NULL THEN
    RETURN false;
  END IF;
  -- Topics: couple:{id}:chat|call|location|presence|moods
  IF topic ~ '^couple:[a-zA-Z0-9_-]+:(chat|call|location|presence|moods)$' THEN
    couple := split_part(topic, ':', 2);
    RETURN public.madlove_is_couple_member(couple);
  END IF;
  -- Topics: room:{sessionId}
  IF topic ~ '^room:[a-zA-Z0-9_-]+$' THEN
    RETURN EXISTS (
      SELECT 1
      FROM watch_sessions ws
      WHERE ws.id = split_part(topic, ':', 2)
        AND ws.couple_id IN (SELECT public.madlove_user_couple_ids())
    );
  END IF;
  RETURN false;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'realtime' AND table_name = 'messages'
  ) THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS madlove_realtime_select ON realtime.messages';
    EXECUTE $p$
      CREATE POLICY madlove_realtime_select ON realtime.messages
        FOR SELECT TO authenticated
        USING (public.madlove_realtime_couple_allowed())
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS madlove_realtime_insert ON realtime.messages';
    EXECUTE $p$
      CREATE POLICY madlove_realtime_insert ON realtime.messages
        FOR INSERT TO authenticated
        WITH CHECK (public.madlove_realtime_couple_allowed())
    $p$;
  END IF;
END $$;
