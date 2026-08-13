
-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.showdown_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ roles ============
CREATE TYPE public.app_role AS ENUM ('owner','admin','user');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','admin'));
$$;

-- ============ game packs ============
CREATE TABLE public.game_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  is_free BOOLEAN NOT NULL DEFAULT false,
  price_nzd_cents INTEGER NOT NULL DEFAULT 0,
  question_count_target INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_packs TO anon, authenticated;
GRANT ALL ON public.game_packs TO service_role;
ALTER TABLE public.game_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packs public read" ON public.game_packs FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "packs admin manage" ON public.game_packs FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER game_packs_updated BEFORE UPDATE ON public.game_packs FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();

INSERT INTO public.game_packs (slug, title, subtitle, description, is_free, price_nzd_cents, question_count_target, sort_order) VALUES
('kiwi-as-quickie','Kiwi As — Quickie','Free mini game show','A complete 10-challenge Kiwi As mini game. Free, no account needed.', true, 0, 30, 1),
('kiwi-as-full','Kiwi As — Full Game','The full five-round showdown','Approximately 33 challenges across five rounds. One-time purchase, only the host needs it.', false, 999, 33, 2);

-- ============ characters ============
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  personality TEXT NOT NULL,
  accessory TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  tagline TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.characters TO anon, authenticated;
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "characters public read" ON public.characters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "characters admin manage" ON public.characters FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER characters_updated BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();

INSERT INTO public.characters (slug, name, personality, accessory, accent_color, sort_order) VALUES
('kea','Kea','cheeky','backwards cap','#7CF23A',1),
('kereru','Kererū','chilled','puffer vest','#3AD7F2',2),
('tui','Tūī','smooth','gold chain','#F2C63A',3),
('piwakawaka','Pīwakawaka','energetic','sports sweatband','#FF5FA2',4),
('kiwi','Kiwi','determined','red sneakers','#FF6B3A',5),
('korimako','Korimako','cool','sunglasses','#A66BFF',6);

CREATE TYPE public.character_state AS ENUM ('neutral','winning','shocked','defeated');
CREATE TABLE public.character_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  state public.character_state NOT NULL,
  asset_url TEXT,
  storage_path TEXT,
  alt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (character_id, state)
);
GRANT SELECT ON public.character_assets TO anon, authenticated;
GRANT ALL ON public.character_assets TO service_role;
ALTER TABLE public.character_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "character assets public read" ON public.character_assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "character assets admin manage" ON public.character_assets FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER character_assets_updated BEFORE UPDATE ON public.character_assets FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();

INSERT INTO public.character_assets (character_id, state)
SELECT c.id, s.state FROM public.characters c
CROSS JOIN (SELECT unnest(ARRAY['neutral','winning','shocked','defeated']::public.character_state[]) AS state) s;

-- ============ ace assets & audio ============
CREATE TABLE public.ace_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot TEXT NOT NULL UNIQUE,
  asset_url TEXT,
  storage_path TEXT,
  alt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ace_assets TO anon, authenticated;
GRANT ALL ON public.ace_assets TO service_role;
ALTER TABLE public.ace_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ace assets public read" ON public.ace_assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ace assets admin manage" ON public.ace_assets FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER ace_assets_updated BEFORE UPDATE ON public.ace_assets FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();
INSERT INTO public.ace_assets (slot) VALUES ('idle'),('excited'),('shocked'),('celebrating'),('pointing');

CREATE TABLE public.ace_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  label TEXT,
  audio_url TEXT,
  storage_path TEXT,
  transcript TEXT,
  weight INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ace_audio_event_idx ON public.ace_audio (event_key) WHERE active;
GRANT SELECT ON public.ace_audio TO anon, authenticated;
GRANT ALL ON public.ace_audio TO service_role;
ALTER TABLE public.ace_audio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ace audio public read" ON public.ace_audio FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "ace audio admin manage" ON public.ace_audio FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER ace_audio_updated BEFORE UPDATE ON public.ace_audio FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();

-- ============ questions ============
CREATE TYPE public.round_type AS ENUM ('sweet_as','choice_bro','yeah_nah','mana','showdown','quickie','sudden_death');
CREATE TYPE public.question_type AS ENUM ('multiple_choice','yeah_nah','ordering','image','two_choice','audio','location');

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_pack_id UUID NOT NULL REFERENCES public.game_packs(id) ON DELETE CASCADE,
  category TEXT,
  round_type public.round_type NOT NULL,
  question_type public.question_type NOT NULL DEFAULT 'multiple_choice',
  difficulty SMALLINT NOT NULL DEFAULT 2,
  question_text TEXT NOT NULL,
  answer_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer JSONB NOT NULL,
  explanation TEXT,
  source TEXT,
  last_verified DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  media_url TEXT,
  timer_seconds INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX questions_pack_round_idx ON public.questions (game_pack_id, round_type) WHERE active;
GRANT ALL ON public.questions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions admin manage" ON public.questions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL,
  option_text TEXT NOT NULL,
  media_url TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, option_key)
);
GRANT ALL ON public.question_options TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_options TO authenticated;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "question options admin manage" ON public.question_options FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ rooms ============
CREATE TYPE public.room_status AS ENUM ('lobby','in_progress','finished','expired');
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  game_pack_id UUID NOT NULL REFERENCES public.game_packs(id),
  host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  host_token_hash TEXT NOT NULL,
  status public.room_status NOT NULL DEFAULT 'lobby',
  max_players SMALLINT NOT NULL DEFAULT 6,
  display_connected BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '6 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rooms_code_idx ON public.rooms (code);
CREATE INDEX rooms_expires_idx ON public.rooms (expires_at);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms public read" ON public.rooms FOR SELECT TO anon, authenticated USING (true);

CREATE TYPE public.player_status AS ENUM ('joining','ready','playing','disconnected','left');
CREATE TABLE public.room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  character_id UUID REFERENCES public.characters(id),
  nickname TEXT NOT NULL,
  player_token_hash TEXT NOT NULL,
  status public.player_status NOT NULL DEFAULT 'joining',
  is_host BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, character_id),
  UNIQUE (room_id, nickname)
);
CREATE INDEX room_players_room_idx ON public.room_players (room_id);
GRANT SELECT ON public.room_players TO anon, authenticated;
GRANT ALL ON public.room_players TO service_role;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room players public read" ON public.room_players FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER room_players_updated BEFORE UPDATE ON public.room_players FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();

-- ============ sessions & gameplay ============
CREATE TYPE public.session_status AS ENUM ('pending','active','paused','complete','abandoned');
CREATE TABLE public.showdown_game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_pack_id UUID NOT NULL REFERENCES public.game_packs(id),
  status public.session_status NOT NULL DEFAULT 'pending',
  current_round public.round_type,
  current_index INTEGER NOT NULL DEFAULT 0,
  phase TEXT NOT NULL DEFAULT 'lobby',
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX showdown_game_sessions_room_idx ON public.showdown_game_sessions (room_id);
GRANT SELECT ON public.showdown_game_sessions TO anon, authenticated;
GRANT ALL ON public.showdown_game_sessions TO service_role;
ALTER TABLE public.showdown_game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions public read" ON public.showdown_game_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER showdown_game_sessions_updated BEFORE UPDATE ON public.showdown_game_sessions FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();

CREATE TABLE public.session_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.showdown_game_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  round_type public.round_type NOT NULL,
  sequence INTEGER NOT NULL,
  asked_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  revealed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, sequence)
);
GRANT ALL ON public.session_questions TO service_role;
ALTER TABLE public.session_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.player_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_question_id UUID NOT NULL REFERENCES public.session_questions(id) ON DELETE CASCADE,
  room_player_id UUID NOT NULL REFERENCES public.room_players(id) ON DELETE CASCADE,
  answer JSONB,
  risk_multiplier SMALLINT,
  is_correct BOOLEAN,
  response_ms INTEGER,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_question_id, room_player_id)
);
GRANT ALL ON public.player_answers TO service_role;
ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.showdown_game_sessions(id) ON DELETE CASCADE,
  room_player_id UUID NOT NULL REFERENCES public.room_players(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  points INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX score_events_session_idx ON public.score_events (session_id);
GRANT SELECT ON public.score_events TO anon, authenticated;
GRANT ALL ON public.score_events TO service_role;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "score events public read" ON public.score_events FOR SELECT TO anon, authenticated USING (true);

-- ============ ace cards ============
CREATE TABLE public.ace_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  effect_key TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ace_cards TO anon, authenticated;
GRANT ALL ON public.ace_cards TO service_role;
ALTER TABLE public.ace_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ace cards public read" ON public.ace_cards FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "ace cards admin manage" ON public.ace_cards FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER ace_cards_updated BEFORE UPDATE ON public.ace_cards FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();

INSERT INTO public.ace_cards (slug, name, description, effect_key, config, sort_order) VALUES
('shell-be-right','She''ll Be Right','Protects your streak from one wrong answer.','protect_streak','{}'::jsonb,1),
('hard-out','Hard Out','Doubles the base score of your next correct answer.','double_next','{"multiplier":2}'::jsonb,2),
('have-a-geez','Have A Geez','Removes two wrong options where the format allows.','remove_two','{}'::jsonb,3),
('sneaky-bugger','Sneaky Bugger','Answer correctly and steal 300 points from the leader.','steal_points','{"points":300}'::jsonb,4);

CREATE TABLE public.player_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.showdown_game_sessions(id) ON DELETE CASCADE,
  room_player_id UUID NOT NULL REFERENCES public.room_players(id) ON DELETE CASCADE,
  ace_card_id UUID NOT NULL REFERENCES public.ace_cards(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);
CREATE INDEX player_cards_player_idx ON public.player_cards (room_player_id);
GRANT SELECT ON public.player_cards TO anon, authenticated;
GRANT ALL ON public.player_cards TO service_role;
ALTER TABLE public.player_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player cards public read" ON public.player_cards FOR SELECT TO anon, authenticated USING (true);

-- ============ purchases ============
CREATE TYPE public.purchase_status AS ENUM ('pending','paid','refunded','failed');
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_pack_id UUID NOT NULL REFERENCES public.game_packs(id),
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_reference TEXT,
  amount_nzd_cents INTEGER NOT NULL,
  status public.purchase_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_pack_id, provider_reference)
);
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own purchases read" ON public.purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER purchases_updated BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.showdown_set_updated_at();

-- ============ analytics ============
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  game_pack_id UUID REFERENCES public.game_packs(id) ON DELETE SET NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_key_idx ON public.analytics_events (event_key, created_at DESC);
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- ============ realtime ============
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_players REPLICA IDENTITY FULL;
ALTER TABLE public.showdown_game_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.showdown_game_sessions;
