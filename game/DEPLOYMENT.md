# Deploying Mīharo: The Showdown without Lovable

This repository is intended to be deployable independently of the Lovable editor. It is a TanStack Start application (not a static-only Vite SPA) and includes server-side game/payment code, so deploy it to a host that can run the built server output.

## Recommended workflow

1. Put this repository in a private GitHub repository.
2. Create a **preview** deployment before touching the public domain.
3. Configure the environment variables below in the host dashboard.
4. Build with `npm run build`.
5. Test room creation, phone join, realtime play, Quickie, Full Game entitlement and Stripe test checkout on the preview URL.
6. Only after the preview passes, promote/attach the production domain.

## Required environment variables

Public/browser-safe:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server-only:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (when payments are enabled)
- `STRIPE_WEBHOOK_SECRET` (when payments are enabled)

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or `STRIPE_WEBHOOK_SECRET` with a `VITE_` prefix.

## Database

Apply the SQL migrations in `supabase/migrations/` to the production Supabase project in chronological order before enabling the matching application code. The monetisation/content/Quickie migrations added during launch hardening are required for those features.

## Stripe

Keep Stripe in test mode until the entire purchase → webhook → entitlement → restore → refund path passes. See `MONETISATION_SETUP.md`.

The webhook endpoint is:

`/api/stripe-webhook`

Configure Stripe to send the events listed in `MONETISATION_SETUP.md` to the deployed HTTPS URL for that route.

## Custom domain

Do not point `playmiharo.co.nz` at a new host until the preview deployment is working. Use the host's preview URL first. When ready, add the custom domain in the hosting dashboard and update DNS exactly as that provider instructs.

## Rollback

Keep the current Lovable deployment live until the independent deployment passes. If a production deployment fails, roll back to the previous known-good deployment rather than editing production directly.

## Local verification

```bash
npm install
npm run build
npm run dev
```

The exported source intentionally does not include `node_modules`; dependencies must be installed on the machine/CI runner that builds it.
