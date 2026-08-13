-- Production-ready Kiwi As Quickie: exactly 10 verified, varied, accessible questions.
-- The Quickie is intentionally deterministic at the content-pool level: there are exactly
-- ten active Quickie rows, so every free game demonstrates the full curated set while the
-- engine can still shuffle their play order.

UPDATE public.questions q
SET active = false, updated_at = now()
FROM public.game_packs p
WHERE q.game_pack_id = p.id
  AND p.slug = 'kiwi-as-quickie'
  AND q.round_type = 'quickie';

WITH pack AS (SELECT id FROM public.game_packs WHERE slug = 'kiwi-as-quickie' LIMIT 1),
seed(category, question_text, answer_options, correct_answer, explanation, source) AS (
  VALUES
  ('Places', 'What is the capital city of New Zealand?',
    '[{"key":"a","text":"Auckland"},{"key":"b","text":"Wellington"},{"key":"c","text":"Christchurch"},{"key":"d","text":"Hamilton"}]'::jsonb,
    '{"key":"b"}'::jsonb,
    'Wellington has been New Zealand''s capital since 1865.',
    'https://nzhistory.govt.nz/page/capital-150-0'),
  ('Nature', 'What is New Zealand''s highest mountain?',
    '[{"key":"a","text":"Mount Taranaki"},{"key":"b","text":"Mount Ruapehu"},{"key":"c","text":"Aoraki / Mount Cook"},{"key":"d","text":"Mount Aspiring"}]'::jsonb,
    '{"key":"c"}'::jsonb,
    'Aoraki / Mount Cook is New Zealand''s tallest peak at 3,724 metres.',
    'https://www.doc.govt.nz/aorakinationalpark'),
  ('Icons', 'Which bird appears on New Zealand''s $1 coin?',
    '[{"key":"a","text":"Tūī"},{"key":"b","text":"Kiwi"},{"key":"c","text":"Kea"},{"key":"d","text":"Kererū"}]'::jsonb,
    '{"key":"b"}'::jsonb,
    'The $1 coin features two national symbols: the kiwi and ponga / silver fern.',
    'https://www.rbnz.govt.nz/money-and-cash/banknotes-and-coins/coins-in-circulation/coin-specifications-and-images-by-denomination'),
  ('People', 'Who was the first woman to become New Zealand Prime Minister following a general election?',
    '[{"key":"a","text":"Helen Clark"},{"key":"b","text":"Jenny Shipley"},{"key":"c","text":"Jacinda Ardern"},{"key":"d","text":"Dame Whina Cooper"}]'::jsonb,
    '{"key":"a"}'::jsonb,
    'Jenny Shipley was New Zealand''s first woman Prime Minister; Helen Clark was the first woman to become Prime Minister following a general election, in 1999.',
    'https://nzhistory.govt.nz/people/helen-clark'),
  ('Wildlife', 'Which statement about kiwi is true?',
    '[{"key":"a","text":"They can fly short distances"},{"key":"b","text":"They have a long tail"},{"key":"c","text":"They are flightless"},{"key":"d","text":"They are parrots"}]'::jsonb,
    '{"key":"c"}'::jsonb,
    'Kiwi are flightless birds with loose, hair-like feathers, strong legs and no tail.',
    'https://www.doc.govt.nz/kiwi'),
  ('Wildlife', 'Which New Zealand bird is a large, green, flightless parrot?',
    '[{"key":"a","text":"Kākāpō"},{"key":"b","text":"Kōkako"},{"key":"c","text":"Kererū"},{"key":"d","text":"Korimako"}]'::jsonb,
    '{"key":"a"}'::jsonb,
    'Kākāpō are nocturnal, flightless parrots and are the world''s heaviest parrot species.',
    'https://www.doc.govt.nz/nature/native-animals/birds/birds-a-z/kakapo/'),
  ('Wildlife', 'What kind of animal is a tuatara?',
    '[{"key":"a","text":"Bird"},{"key":"b","text":"Reptile"},{"key":"c","text":"Amphibian"},{"key":"d","text":"Mammal"}]'::jsonb,
    '{"key":"b"}'::jsonb,
    'Tuatara are rare reptiles found only in New Zealand and are the last survivors of an ancient reptile order.',
    'https://www.doc.govt.nz/nature/native-animals/reptiles-and-frogs/tuatara/'),
  ('Kai', 'What is a hāngī?',
    '[{"key":"a","text":"An earth-oven cooking method"},{"key":"b","text":"A type of fishing net"},{"key":"c","text":"A carved meeting house"},{"key":"d","text":"A woven cloak"}]'::jsonb,
    '{"key":"a"}'::jsonb,
    'Hāngī is a Māori method of cooking food using heated stones set into the ground.',
    'https://nzhistory.govt.nz/keyword/hangi'),
  ('Kiwi life', 'What are jandals?',
    '[{"key":"a","text":"Rubber sandals / thongs"},{"key":"b","text":"Woollen shirts"},{"key":"c","text":"Rain jackets"},{"key":"d","text":"Gumboots"}]'::jsonb,
    '{"key":"a"}'::jsonb,
    'Jandals is a New Zealand term for rubber thongs or sandals.',
    'https://teara.govt.nz/en/english-language-in-new-zealand/page-1'),
  ('History', 'In what year did New Zealand women win the right to vote in parliamentary elections?',
    '[{"key":"a","text":"1873"},{"key":"b","text":"1893"},{"key":"c","text":"1919"},{"key":"d","text":"1949"}]'::jsonb,
    '{"key":"b"}'::jsonb,
    'In 1893 New Zealand became the first self-governing country where women had the right to vote in parliamentary elections.',
    'https://nzhistory.govt.nz/womens-suffrage-day')
)
INSERT INTO public.questions (
  game_pack_id, category, round_type, question_type, challenge_format, difficulty,
  question_text, answer_options, correct_answer, explanation, timer_seconds,
  active, source, last_verified, created_at, updated_at
)
SELECT
  pack.id, seed.category, 'quickie'::public.round_type, 'multiple_choice'::public.question_type,
  'single_choice', 1, seed.question_text, seed.answer_options, seed.correct_answer,
  seed.explanation, 12, true, seed.source, DATE '2026-08-13', now(), now()
FROM pack CROSS JOIN seed
WHERE NOT EXISTS (
  SELECT 1 FROM public.questions existing
  WHERE existing.game_pack_id = pack.id
    AND existing.round_type = 'quickie'
    AND existing.question_text = seed.question_text
);

-- Reactivate the curated rows on re-run (keeps the migration idempotent for dev resets).
WITH pack AS (SELECT id FROM public.game_packs WHERE slug = 'kiwi-as-quickie' LIMIT 1),
curated(question_text) AS (VALUES
 ('What is the capital city of New Zealand?'),
 ('What is New Zealand''s highest mountain?'),
 ('Which bird appears on New Zealand''s $1 coin?'),
 ('Who was the first woman to become New Zealand Prime Minister following a general election?'),
 ('Which statement about kiwi is true?'),
 ('Which New Zealand bird is a large, green, flightless parrot?'),
 ('What kind of animal is a tuatara?'),
 ('What is a hāngī?'),
 ('What are jandals?'),
 ('In what year did New Zealand women win the right to vote in parliamentary elections?')
)
UPDATE public.questions q
SET active = true, last_verified = DATE '2026-08-13', updated_at = now()
FROM pack, curated
WHERE q.game_pack_id = pack.id
  AND q.round_type = 'quickie'
  AND q.question_text = curated.question_text;

UPDATE public.game_packs
SET title = 'Kiwi As — Quickie',
    subtitle = '10 free Kiwi challenges',
    description = 'A complete 10-question taste of Mīharo: The Showdown. Free, no account needed.',
    question_count_target = 10,
    is_free = true,
    price_nzd_cents = 0,
    updated_at = now()
WHERE slug = 'kiwi-as-quickie';
