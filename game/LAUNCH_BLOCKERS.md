# Mīharo: The Showdown — launch blocker audit

## Fixed in this pass

- **Ordering draft identity:** the ordering controller now keys local draft state by the unique `sessionQuestionId`, not only generic option keys (`a|b|c|d`). This prevents one ordering challenge from inheriting another challenge's draft state while still protecting the draft from realtime refresh snap-back.
- **Ace production art precedence:** local approved presenter art is now authoritative. Historical `ace_assets` rows can no longer silently replace the new launch artwork.
- **TV stage sharpness:** the five production stage plates were normalized to 1920×1080 WebP so the browser is not enlarging a 1672×941 source on a 1080p television.
- **Round config drift:** public/static round definitions now match the actual server engine for timers and the five-question Final. Obsolete old Showdown scoring code was removed to reduce the risk of accidentally reintroducing pre-Final scoring rules.
- **Beta copy:** the current published build actually runs the full five-round experience from the free pack. Public copy now says **Free beta** rather than promising a 10-question Quickie that the current engine does not run.

## Still blocks a paid public launch

1. **Payments / entitlements are not implemented.** `createRoom` explicitly blocks the paid `kiwi-as-full` pack and contains a placeholder comment for entitlement checks. Do not advertise a paid full game until a payment provider and server-verified entitlement flow are added.
2. **Free-vs-paid pack data needs cleanup.** The development migrations seed the working multi-round content into `kiwi-as-quickie`. Before monetisation, create a real Quickie flow/question bank and move/copy production full-game content into `kiwi-as-full` deliberately.
3. **Question content is development content.** Existing seeded questions need a factual/cultural editorial pass and `last_verified` dates before a public launch, especially te reo Māori, history, date comparisons, and cultural claims.
4. **Bird art is still Lovable-CDN-backed.** `src/assets/characters/*.asset.json` resolves through `/__l5e/assets-v1/...`. It works on the current Lovable deployment, but a future deployment outside Lovable will need those 24 character PNGs localized into `public/production/characters/` and the registry switched to local URLs.
5. **Full browser regression run is still needed on this source pass.** This environment does not have the project dependency tree installed, so a real build/browser test could not be executed here. Manual testing on the current published site remains important after applying this patch.

## Not required to launch a free beta

- Ace voiceover: valuable polish, but text + presenter assets can ship first.
- Native Chromecast: useful later; TV browser / mirroring / HDMI are valid beta display paths.
- Full admin dashboard: useful operationally, but not required for a controlled beta if content is already seeded.


## Content verification pass 1

A first launch-sensitive content hardening migration is now included. High-risk Māori-language/cultural, historical, science and national-claim items were narrowed or sourced. The remaining rows with `last_verified IS NULL` still need editorial review before a broad public launch. See `CONTENT_AUDIT.md`.
