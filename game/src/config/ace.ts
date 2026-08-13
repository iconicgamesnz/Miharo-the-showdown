/**
 * Ace — host configuration.
 *
 * Ace's artwork and voice are supplied by the owner. Nothing here generates a
 * voice; this file only declares the gameplay events that voice clips can be
 * attached to (rows in `ace_audio`) and the artwork slots (`ace_assets`).
 */

export const ACE_ASSET_SLOTS = [
  "idle",
  "excited",
  "shocked",
  "celebrating",
  "pointing",
  "defeated",
] as const;
export type AceAssetSlot = (typeof ACE_ASSET_SLOTS)[number];

export const ACE_VOICE_EVENTS = [
  "welcome",
  "lobby",
  "round_intro",
  "all_correct",
  "all_wrong",
  "only_one_correct",
  "fastest_answer",
  "streak",
  "new_leader",
  "comeback",
  "ace_card_earned",
  "large_gamble",
  "gamble_failed",
  "tie",
  "sudden_death",
  "winner",
  "end_game",
  "quickie_conversion",
  "bird_reaction",
] as const;
export type AceVoiceEvent = (typeof ACE_VOICE_EVENTS)[number];
