-- Showdown runtime fixes confirmed working on PLAYMIHARO.
-- Keeps the existing legacy public.game_sessions separate.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS challenge_format TEXT;

GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.room_players TO service_role;
GRANT ALL ON public.showdown_game_sessions TO service_role;
GRANT ALL ON public.session_questions TO service_role;
GRANT ALL ON public.player_answers TO service_role;
GRANT ALL ON public.score_events TO service_role;

GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT SELECT ON public.room_players TO anon, authenticated;
GRANT SELECT ON public.showdown_game_sessions TO anon, authenticated;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showdown_game_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rooms'
      AND policyname = 'showdown rooms public read'
  ) THEN
    CREATE POLICY "showdown rooms public read"
    ON public.rooms FOR SELECT TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'room_players'
      AND policyname = 'showdown room players public read'
  ) THEN
    CREATE POLICY "showdown room players public read"
    ON public.room_players FOR SELECT TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'showdown_game_sessions'
      AND policyname = 'showdown sessions public read'
  ) THEN
    CREATE POLICY "showdown sessions public read"
    ON public.showdown_game_sessions FOR SELECT TO anon, authenticated
    USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'rooms_updated'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER rooms_updated
    BEFORE UPDATE ON public.rooms
    FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'room_players_updated'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER room_players_updated
    BEFORE UPDATE ON public.room_players
    FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'showdown_game_sessions_updated'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER showdown_game_sessions_updated
    BEFORE UPDATE ON public.showdown_game_sessions
    FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();
  END IF;
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.showdown_game_sessions;
