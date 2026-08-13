-- Content hardening pass 1.
-- Corrects or narrows launch-sensitive claims and records authoritative sources.
-- This migration deliberately does not mark the entire development bank as verified.

-- Aotearoa: avoid presenting a complex naming history as a single uncontested translation claim.
UPDATE public.questions
SET question_text = 'Which Māori-language name is commonly used for New Zealand?',
    explanation = 'Aotearoa is widely used as a Māori-language name for New Zealand.',
    source = 'https://www.rbnz.govt.nz/money-and-cash/banknotes-and-coins/banknotes-in-circulation/explore-banknote-features',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'What is the Māori name for New Zealand?';

-- Rakiura: retain the answer but use a sourced, concise explanation.
UPDATE public.questions
SET explanation = 'Rakiura is the Māori name for Stewart Island; Te Ara gives the meaning as “glowing skies”.',
    source = 'https://teara.govt.nz/en/stewart-islandrakiura/page-1',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'Stewart Island''s Māori name is Rakiura.';

-- Te reo Māori official-language claim: keep current legal context accurate.
UPDATE public.questions
SET explanation = 'Te reo Māori became an official language in 1987; the current framework is Te Ture mō Te Reo Māori 2016.',
    source = 'https://www.govt.nz/browse/history-culture-and-heritage/maori-language-culture-and-heritage/revitalising-te-reo-maori/',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'Te reo Māori is an official language of New Zealand.';

-- Hāngī: factual description backed by Te Ara.
UPDATE public.questions
SET explanation = 'Traditional Māori cookery uses a hāngī or umu — an earth oven.',
    source = 'https://teara.govt.nz/en/cooking/page-1',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'A hāngī is cooked in an above-ground clay oven.';

UPDATE public.questions
SET explanation = 'Hāngī (or umu) is a traditional Māori earth-oven cooking method.',
    source = 'https://teara.govt.nz/en/cooking/page-1',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'What is the traditional Māori earth oven called?';

-- Women's suffrage: authoritative historical wording.
UPDATE public.questions
SET explanation = 'In 1893 New Zealand became the first self-governing country in which women had the right to vote in parliamentary elections.',
    source = 'https://nzhistory.govt.nz/womens-suffrage-day',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text IN (
  'New Zealand was the first self-governing country to give women the vote in national elections.',
  'In which year did New Zealand become the first self-governing country to grant women the vote?',
  'In what year did New Zealand women win the right to vote?'
);

-- $1 coin: authoritative Reserve Bank source.
UPDATE public.questions
SET explanation = 'The $1 coin features a kiwi and a silver fern.',
    source = 'https://www.rbnz.govt.nz/money-and-cash/banknotes-and-coins/coins-in-circulation/coin-specifications-and-images-by-denomination',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text IN (
  'Which bird appears on New Zealand''s $1 coin?',
  'The bird on the New Zealand one dollar coin is a tūī.'
);

-- Waikato River: authoritative length source.
UPDATE public.questions
SET explanation = 'The Waikato River is New Zealand''s longest river at about 425 km.',
    source = 'https://teara.govt.nz/en/table/14687/new-zealands-longest-rivers',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text IN (
  'What is New Zealand''s longest river?',
  'Which is New Zealand''s longest river?',
  'The Clutha is New Zealand''s longest river.'
);

-- Lake Taupō: authoritative NIWA source.
UPDATE public.questions
SET explanation = 'Lake Taupō has a surface area of about 616 km² and is New Zealand''s largest lake.',
    source = 'https://niwa.co.nz/freshwater/lakes/how-new-zealands-deep-and-large-lakes-reflect-and-are-affected-climate-change',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text IN (
  'Which lake is New Zealand''s largest by surface area?',
  'What is New Zealand''s largest lake by surface area?'
);

-- Kākāpō: authoritative DOC source.
UPDATE public.questions
SET explanation = 'Kākāpō are nocturnal, flightless parrots and the world''s heaviest parrot species.',
    source = 'https://www.doc.govt.nz/nature/native-animals/birds/birds-a-z/kakapo/',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text IN (
  'The kākāpō is a flightless, nocturnal parrot.',
  'Which critically endangered New Zealand parrot is flightless and nocturnal?',
  'Which native bird is the world''s heaviest parrot?'
);

-- Tuatara: authoritative DOC source.
UPDATE public.questions
SET explanation = 'Tuatara are reptiles, but not lizards; they are the only surviving members of the order Sphenodontia.',
    source = 'https://www.doc.govt.nz/nature/native-animals/reptiles-and-frogs/tuatara/',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'The tuatara is a lizard.';

-- Whio: authoritative Reserve Bank source for the banknote reference.
UPDATE public.questions
SET explanation = 'Whio is the blue duck featured on the back of New Zealand''s $10 banknote.',
    source = 'https://www.rbnz.govt.nz/money-and-cash/banknotes-and-coins/banknotes-in-circulation/10-banknote',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'Which one is a real native New Zealand bird?'
  AND correct_answer ->> 'key' = 'a';

-- Rutherford: replace the inaccurate/pop-science “first split the atom” framing.
UPDATE public.questions
SET question_text = 'Which New Zealand-born scientist won the 1908 Nobel Prize in Chemistry for work on radioactivity?',
    explanation = 'Ernest Rutherford received the 1908 Nobel Prize in Chemistry for research on the disintegration of elements and radioactive substances.',
    source = 'https://www.nobelprize.org/prizes/chemistry/1908/summary/',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'Which New Zealand-born physicist first split the atom?';

UPDATE public.questions
SET explanation = 'Ernest Rutherford, born in Nelson, received the 1908 Nobel Prize in Chemistry for his radioactivity research.',
    source = 'https://www.nobelprize.org/prizes/chemistry/1908/rutherford/facts/',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'Which New Zealand-born scientist is known as the father of nuclear physics?';

-- Te Waipounamu: make the wording explicitly “a Māori name”, not the only possible traditional name.
UPDATE public.questions
SET question_text = 'Which of these is a Māori name used for the South Island?',
    explanation = 'Te Waipounamu / Te Wai Pounamu is a Māori name for the South Island; Te Ara records several traditional names.',
    source = 'https://teara.govt.nz/en/tapa-whenua-naming-places/print',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'Which name refers to the South Island?';

-- City of Sails: remove an unsupported “boats per capita” superlative while preserving the familiar nickname question.
UPDATE public.questions
SET explanation = 'Auckland is widely known by the nickname “City of Sails”.',
    updated_at = now()
WHERE question_text IN (
  'Which city is nicknamed the City of Sails?',
  'Which New Zealand city is nicknamed the City of Sails?',
  'Which city is known as the City of Sails?'
);

-- National sport wording is needlessly legalistic and difficult to source cleanly.
-- Replace it with a stable, non-ambiguous statement while retaining the same Yeah/Nah answer.
UPDATE public.questions
SET question_text = 'The All Blacks play rugby league.',
    correct_answer = '{"key":"nah"}'::jsonb,
    explanation = 'The All Blacks are New Zealand''s national men''s rugby union team.',
    source = 'https://www.allblacks.com/',
    last_verified = DATE '2026-08-13',
    updated_at = now()
WHERE question_text = 'Rugby league is officially New Zealand''s national sport, ahead of rugby union.';

-- Time-sensitive sheep ratio: keep the cultural joke out of the verified launch pool until it has a current Stats NZ source.
UPDATE public.questions
SET active = false,
    explanation = 'Disabled for launch: livestock-to-population ratios change over time and need a current statistical source.',
    updated_at = now()
WHERE question_text = 'New Zealand has more sheep than people.';
