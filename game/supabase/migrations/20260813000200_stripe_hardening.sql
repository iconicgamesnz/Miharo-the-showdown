-- Harden Stripe lifecycle handling: payment intent linkage, webhook idempotency,
-- and durable refund/expiry state.

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS provider_payment_intent TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_payment_intent_unique
  ON public.purchases(provider, provider_payment_intent)
  WHERE provider_payment_intent IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.stripe_webhook_events TO service_role;
REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;
