# Mīharo monetisation setup

## Product split
- `kiwi-as-quickie`: free, 10-question single-round mini game, no account required.
- `kiwi-as-full`: NZ$9.99 one-time host unlock, full five-round / 33-question game.
- Only the host needs the paid entitlement. Joining players remain anonymous/account-free.

## Ownership
Paid ownership is attached to a Supabase Auth user in `pack_entitlements`. The host signs in by email magic link before purchase. This makes the unlock restorable on another browser/device after signing in with the same email.

## Stripe configuration required before charging anyone
Set these server environment variables on the production host:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Create a Stripe webhook pointing to:
- `/api/stripe-webhook`

Subscribe it to:
- `checkout.session.completed`

The app creates Checkout Sessions server-side. The webhook is the only path that grants an entitlement; returning to the success URL alone does not unlock anything.

## Supabase configuration required
1. Apply migration `20260813000100_monetisation_split.sql`.
2. Ensure Email auth is enabled.
3. Add the production site URL and redirect URL to Supabase Auth allowed redirect URLs.
4. Regenerate Supabase TypeScript types after applying the migration when convenient (the exported types file has been updated manually for this source package).

## Before launch
- Run one free Quickie end-to-end and confirm it ends after 10 questions.
- Run one Stripe test-mode purchase, verify `purchases.status = paid`, and verify a `pack_entitlements` row is created.
- Sign out/in on another browser with the same email and confirm Full Game shows as owned.
- Verify a non-owner cannot create `kiwi-as-full` by calling the room endpoint directly.
- Complete the full five-round paid game and a rematch.
- Test Stripe webhook retry/idempotency.
- Establish a refund/revocation procedure before taking live payments. The current webhook grants on successful checkout; refunds should be manually revoked until automated refund handling is added.

## Important
Do not switch Stripe to live mode until the question bank has completed factual/cultural verification and the production purchase flow has passed test mode.
