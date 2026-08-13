# Kiwi As content audit — launch pass 1

Date: 2026-08-13

This pass hardens launch-sensitive questions that involve Māori language/culture, national claims, historical firsts, science wording, or facts that were previously unsupported. It does **not** certify the whole generated development bank.

## Corrected or narrowed

- Reworded the Aotearoa question to avoid presenting a complex naming history as a single uncontested formulation.
- Reworded the South Island / Te Waipounamu question to say it is **a** Māori name used for the island.
- Updated te reo Māori official-language copy with current 2016-law context.
- Sourced hāngī/umu as an earth-oven cooking method.
- Sourced 1893 women’s suffrage wording to NZHistory.
- Replaced the inaccurate “Rutherford first split the atom” question with his documented 1908 Nobel Prize achievement.
- Replaced the legalistic “rugby league is officially the national sport” Yeah/Nah item with a stable All Blacks rugby-union statement.
- Removed unsupported “most boats per capita” copy from City of Sails explanations.
- Disabled the time-sensitive “more sheep than people” item until a current Stats NZ source is attached.

## Authoritative sources used

- Manatū Taonga / NZHistory
- New Zealand Government / New Zealand Legislation
- Reserve Bank of New Zealand
- Department of Conservation
- NIWA
- Te Ara Encyclopedia of New Zealand
- NobelPrize.org

## Still requiring review before a broad public launch

The remaining development questions should still receive an editorial pass for:

- exact Māori orthography/macrons and culturally appropriate framing;
- brand/product facts that can change;
- current population/statistical claims;
- superlatives such as “largest”, “deepest”, “only”, or “first” where the source is not already recorded;
- pop-culture dates and release claims;
- fake-place / fake-word distractors that could accidentally be real words or names;
- duplicated facts across Quickie and Full Game.

The database `last_verified` field should be treated as the source of truth: a NULL date means the question is still development content, not editorially verified launch content.
