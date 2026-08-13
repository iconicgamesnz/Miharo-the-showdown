# ChatGPT code pass — launch blocker cleanup

This pass works from the exported Lovable source and deliberately avoids rewriting the multiplayer/game engine.

## Code changes

- Added `challengeId` to `OrderingControl` and pass `question.sessionQuestionId` from `PhoneGame`, preventing cross-question ordering draft leakage while preserving local draft state across realtime ticks.
- Made local owner-approved Ace production art authoritative in `AceStage`; removed the per-render Supabase `ace_assets` override query.
- Normalized all five TV stage backgrounds to 1920×1080 WebP.
- Aligned `FULL_GAME_ROUNDS` with the server engine (12s Sweet As/Choice/Mana, 5-question Final, no Final speed bonus).
- Removed obsolete `showdownPoints` / old Final scoring constants that are no longer used by the production Final engine.
- Corrected public copy from a nonfunctional “10-question Quickie” promise to an accurate “Free beta” label for the currently working full five-round experience.
- Added `LAUNCH_BLOCKERS.md` with the remaining paid-launch blockers.

## Validation limitation

The global TypeScript executable is available, but the exported project does not include `node_modules`, and dependency installation timed out in this environment. A full typecheck/build therefore cannot be honestly claimed for this pass. The edits are intentionally narrow and should be tested in a real browser/deployment before public launch.

## Monetisation architecture pass
- Added a real `quickie` engine round: 10 questions, one round, then authoritative game-over/champion flow.
- New rooms/rematches choose their starting round from the pack (`quickie` vs full five-round game).
- Added migration to clone the existing five-round bank into `kiwi-as-full` and seed 10 Quickie questions into `kiwi-as-quickie`.
- Added durable `pack_entitlements` ownership tied to Supabase Auth users.
- Paid room creation now verifies the host's authenticated entitlement server-side.
- Added email magic-link sign-in, NZ$9.99 Full Game card, ownership restore check, and Full Game launch button.
- Added Stripe Checkout session creation and signed webhook entitlement grant.
- Added `MONETISATION_SETUP.md` with production setup/test requirements.

## 2026-08-13 — Content hardening pass 1
- Added `20260813000300_content_hardening.sql`.
- Reworded/sourced launch-sensitive Māori-language, historical, science and national-claim questions.
- Replaced the inaccurate Rutherford “first split the atom” question.
- Disabled the time-sensitive sheep/population question pending a current statistical source.
- Added `CONTENT_AUDIT.md` and populated `last_verified` only for claims checked against authoritative sources.

## 2026-08-13 — Quickie launch pass
- Replaced the free Quickie pool with exactly 10 curated, sourced, verified launch questions.
- Quickie selection now excludes any question with `last_verified IS NULL`.
- Added a post-Quickie host CTA: `UNLOCK THE FULL SHOWDOWN · NZ$9.99`.
- Added `QUICKIE_LAUNCH.md` documenting the launch pool and editorial rule.
- Added migration `20260813000400_quickie_launch_pack.sql`.
