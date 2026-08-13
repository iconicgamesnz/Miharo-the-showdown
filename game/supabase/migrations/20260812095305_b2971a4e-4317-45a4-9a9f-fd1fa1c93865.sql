CREATE TABLE public.player_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_question_id uuid NOT NULL REFERENCES public.session_questions(id) ON DELETE CASCADE,
  room_player_id uuid NOT NULL REFERENCES public.room_players(id) ON DELETE CASCADE,
  risk_key text NOT NULL,
  auto_assigned boolean NOT NULL DEFAULT false,
  locked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (session_question_id, room_player_id)
);

-- Risk choices are private until the engine reveals them, so only the server
-- (service role) may touch this table. No anon/authenticated grants at all.
GRANT ALL ON public.player_risks TO service_role;

ALTER TABLE public.player_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player risks service only"
  ON public.player_risks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.questions
  (game_pack_id, category, round_type, question_type, challenge_format, difficulty,
   question_text, answer_options, correct_answer, explanation, source, timer_seconds, active)
SELECT
  '74cbc17d-f549-40b7-b29b-a2ae621ad4a8'::uuid,
  v.category,
  'mana'::round_type,
  'multiple_choice'::question_type,
  'single_choice',
  v.difficulty,
  v.question_text,
  v.answer_options::jsonb,
  v.correct_answer::jsonb,
  v.explanation,
  'development seed',
  12,
  true
FROM (VALUES
  ('geography',1,'What is the capital city of New Zealand?','[{"key":"a","text":"Wellington"},{"key":"b","text":"Auckland"},{"key":"c","text":"Christchurch"},{"key":"d","text":"Dunedin"}]','{"key":"a"}','Wellington has been the capital since 1865.'),
  ('culture',1,'What is the Māori name for New Zealand?','[{"key":"a","text":"Aotearoa"},{"key":"b","text":"Rakiura"},{"key":"c","text":"Te Ika-a-Māui"},{"key":"d","text":"Waipounamu"}]','{"key":"a"}','Aotearoa is commonly translated as "land of the long white cloud".'),
  ('geography',2,'What is New Zealand''s highest mountain?','[{"key":"a","text":"Aoraki / Mount Cook"},{"key":"b","text":"Mount Taranaki"},{"key":"c","text":"Mount Ruapehu"},{"key":"d","text":"Mount Aspiring"}]','{"key":"a"}','Aoraki / Mount Cook stands about 3,724 metres.'),
  ('food',2,'Lemon & Paeroa is named after which New Zealand town?','[{"key":"a","text":"Paeroa"},{"key":"b","text":"Palmerston North"},{"key":"c","text":"Picton"},{"key":"d","text":"Pahiatua"}]','{"key":"a"}','The famous L&P bottle sits in Paeroa, Waikato.'),
  ('brands',2,'Which New Zealand chocolate maker is based in Porirua?','[{"key":"a","text":"Whittaker''s"},{"key":"b","text":"Cadbury"},{"key":"c","text":"Griffin''s"},{"key":"d","text":"Pascall"}]','{"key":"a"}','Whittaker''s has manufactured in Porirua since 1966.'),
  ('film',1,'Which New Zealand director made The Lord of the Rings trilogy?','[{"key":"a","text":"Peter Jackson"},{"key":"b","text":"Taika Waititi"},{"key":"c","text":"Jane Campion"},{"key":"d","text":"Niki Caro"}]','{"key":"a"}','Peter Jackson directed all three films, shot in New Zealand.'),
  ('music',2,'Which New Zealand musician released the song Royals in 2013?','[{"key":"a","text":"Lorde"},{"key":"b","text":"Kimbra"},{"key":"c","text":"Bic Runga"},{"key":"d","text":"Ladyhawke"}]','{"key":"a"}','Royals was Lorde''s breakout single.'),
  ('geography',2,'Which strait separates the North and South Islands?','[{"key":"a","text":"Cook Strait"},{"key":"b","text":"Foveaux Strait"},{"key":"c","text":"Bass Strait"},{"key":"d","text":"Torres Strait"}]','{"key":"a"}','Foveaux Strait separates the South Island from Stewart Island.'),
  ('geography',3,'What is New Zealand''s longest river?','[{"key":"a","text":"Waikato River"},{"key":"b","text":"Clutha River"},{"key":"c","text":"Whanganui River"},{"key":"d","text":"Rangitīkei River"}]','{"key":"a"}','The Waikato runs about 425 km.'),
  ('geography',1,'Which New Zealand city is nicknamed the City of Sails?','[{"key":"a","text":"Auckland"},{"key":"b","text":"Wellington"},{"key":"c","text":"Napier"},{"key":"d","text":"Nelson"}]','{"key":"a"}','Auckland sits between two harbours.'),
  ('sport',1,'What is the name of New Zealand''s national men''s rugby union team?','[{"key":"a","text":"All Blacks"},{"key":"b","text":"Black Caps"},{"key":"c","text":"Kiwis"},{"key":"d","text":"Tall Blacks"}]','{"key":"a"}','The Black Caps play cricket and the Tall Blacks basketball.'),
  ('geography',2,'What is New Zealand''s largest lake by surface area?','[{"key":"a","text":"Lake Taupō"},{"key":"b","text":"Lake Te Anau"},{"key":"c","text":"Lake Wakatipu"},{"key":"d","text":"Lake Wānaka"}]','{"key":"a"}','Lake Taupō fills a huge volcanic caldera.'),
  ('wildlife',2,'Which critically endangered New Zealand parrot is flightless and nocturnal?','[{"key":"a","text":"Kākāpō"},{"key":"b","text":"Kea"},{"key":"c","text":"Kākā"},{"key":"d","text":"Kākāriki"}]','{"key":"a"}','The kākāpō is the world''s heaviest parrot.'),
  ('history',3,'In which year did New Zealand become the first self-governing country to grant women the vote?','[{"key":"a","text":"1893"},{"key":"b","text":"1901"},{"key":"c","text":"1919"},{"key":"d","text":"1873"}]','{"key":"a"}','The Electoral Act passed in September 1893.'),
  ('food',1,'Which dessert is a meringue base topped with cream and fruit?','[{"key":"a","text":"Pavlova"},{"key":"b","text":"Lamington"},{"key":"c","text":"Afghan"},{"key":"d","text":"Louise cake"}]','{"key":"a"}','Its origin is famously disputed with Australia.'),
  ('tv',2,'Which long-running New Zealand soap is set in the fictional suburb of Ferndale?','[{"key":"a","text":"Shortland Street"},{"key":"b","text":"Outrageous Fortune"},{"key":"c","text":"Go Girls"},{"key":"d","text":"The Brokenwood Mysteries"}]','{"key":"a"}','Shortland Street first aired in 1992.'),
  ('geography',3,'Which island is New Zealand''s third-largest?','[{"key":"a","text":"Stewart Island / Rakiura"},{"key":"b","text":"Waiheke Island"},{"key":"c","text":"Great Barrier Island"},{"key":"d","text":"Chatham Island"}]','{"key":"a"}','Rakiura sits south of Foveaux Strait.'),
  ('geography',1,'Which New Zealand city is best known for geysers, mud pools and geothermal activity?','[{"key":"a","text":"Rotorua"},{"key":"b","text":"Taupō"},{"key":"c","text":"Gisborne"},{"key":"d","text":"Whangārei"}]','{"key":"a"}','Rotorua sits on the Taupō Volcanic Zone.'),
  ('culture',2,'What is the traditional Māori earth oven called?','[{"key":"a","text":"Hāngī"},{"key":"b","text":"Hongi"},{"key":"c","text":"Hīkoi"},{"key":"d","text":"Haka"}]','{"key":"a"}','A hongi is a greeting; a hīkoi is a walk or march.'),
  ('science',3,'Which New Zealand-born scientist is known as the father of nuclear physics?','[{"key":"a","text":"Ernest Rutherford"},{"key":"b","text":"William Pickering"},{"key":"c","text":"Maurice Wilkins"},{"key":"d","text":"Beatrice Tinsley"}]','{"key":"a"}','Rutherford appears on the New Zealand $100 note.')
) AS v(category, difficulty, question_text, answer_options, correct_answer, explanation);