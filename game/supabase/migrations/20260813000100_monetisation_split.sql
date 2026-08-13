-- Separate the free Kiwi As Quickie from the paid five-round game and add durable ownership.

-- 1) Copy the existing five-round development bank into the paid pack.
INSERT INTO public.questions (
  game_pack_id, category, round_type, question_type, challenge_format, difficulty,
  question_text, media_url, answer_options, correct_answer, explanation, timer_seconds,
  active, source, last_verified, created_at, updated_at
)
SELECT
  full_pack.id, q.category, q.round_type, q.question_type, q.challenge_format, q.difficulty,
  q.question_text, q.media_url, q.answer_options, q.correct_answer, q.explanation, q.timer_seconds,
  q.active, q.source, q.last_verified, now(), now()
FROM public.questions q
JOIN public.game_packs quickie_pack ON quickie_pack.id = q.game_pack_id AND quickie_pack.slug = 'kiwi-as-quickie'
CROSS JOIN LATERAL (SELECT id FROM public.game_packs WHERE slug = 'kiwi-as-full' LIMIT 1) full_pack
WHERE q.round_type IN ('sweet_as','choice_bro','yeah_nah','mana','showdown')
  AND NOT EXISTS (
    SELECT 1 FROM public.questions existing
    WHERE existing.game_pack_id = full_pack.id
      AND existing.round_type = q.round_type
      AND existing.question_text = q.question_text
  );

-- 2) Build the actual free 10-question Quickie from accessible single-choice questions.
INSERT INTO public.questions (
  game_pack_id, category, round_type, question_type, challenge_format, difficulty,
  question_text, media_url, answer_options, correct_answer, explanation, timer_seconds,
  active, source, last_verified, created_at, updated_at
)
SELECT
  q.game_pack_id, q.category, 'quickie'::public.round_type, q.question_type,
  COALESCE(q.challenge_format, 'single_choice'), q.difficulty, q.question_text, q.media_url,
  q.answer_options, q.correct_answer, q.explanation, LEAST(q.timer_seconds, 12),
  true, COALESCE(q.source, 'quickie-seed'), q.last_verified, now(), now()
FROM public.questions q
JOIN public.game_packs p ON p.id = q.game_pack_id AND p.slug = 'kiwi-as-quickie'
WHERE q.round_type = 'sweet_as'
  AND COALESCE(q.challenge_format, 'single_choice') = 'single_choice'
  AND NOT EXISTS (
    SELECT 1 FROM public.questions existing
    WHERE existing.game_pack_id = q.game_pack_id
      AND existing.round_type = 'quickie'
      AND existing.question_text = q.question_text
  )
ORDER BY q.created_at, q.id
LIMIT 10;

UPDATE public.game_packs SET question_count_target = 10, is_free = true, price_nzd_cents = 0
WHERE slug = 'kiwi-as-quickie';
UPDATE public.game_packs SET question_count_target = 33, is_free = false, price_nzd_cents = 999
WHERE slug = 'kiwi-as-full';

-- 3) Durable ownership belongs to an authenticated host, not to a room or browser.
CREATE TABLE IF NOT EXISTS public.pack_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_pack_id UUID NOT NULL REFERENCES public.game_packs(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_pack_id)
);
ALTER TABLE public.pack_entitlements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.pack_entitlements TO authenticated;
GRANT ALL ON public.pack_entitlements TO service_role;
DROP POLICY IF EXISTS "own entitlements read" ON public.pack_entitlements;
CREATE POLICY "own entitlements read" ON public.pack_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id AND revoked_at IS NULL);
CREATE INDEX IF NOT EXISTS pack_entitlements_user_idx ON public.pack_entitlements(user_id) WHERE revoked_at IS NULL;

-- Webhook retries must be idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_provider_reference_unique
  ON public.purchases(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;
