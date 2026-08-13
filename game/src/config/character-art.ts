/**
 * Character artwork registry.
 *
 * Approved artwork supplied by the owner, split from the master expression
 * sheets into one image per character state and served from the CDN.
 * This is the single source of truth for character/host imagery — components
 * never hardcode a URL.
 */
import type { CharacterState } from "./characters";
import type { AceAssetSlot } from "./ace";

import keaNeutral from "@/assets/characters/kea-neutral.png";
import keaWinning from "@/assets/characters/kea-winning.png";
import keaShocked from "@/assets/characters/kea-shocked.png";
import keaDefeated from "@/assets/characters/kea-defeated.png";
import kereruNeutral from "@/assets/characters/kereru-neutral.png";
import kereruWinning from "@/assets/characters/kereru-winning.png";
import kereruShocked from "@/assets/characters/kereru-shocked.png";
import kereruDefeated from "@/assets/characters/kereru-defeated.png";
import tuiNeutral from "@/assets/characters/tui-neutral.png";
import tuiWinning from "@/assets/characters/tui-winning.png";
import tuiShocked from "@/assets/characters/tui-shocked.png";
import tuiDefeated from "@/assets/characters/tui-defeated.png";
import piwakawakaNeutral from "@/assets/characters/piwakawaka-neutral.png";
import piwakawakaWinning from "@/assets/characters/piwakawaka-winning.png";
import piwakawakaShocked from "@/assets/characters/piwakawaka-shocked.png";
import piwakawakaDefeated from "@/assets/characters/piwakawaka-defeated.png";
import kiwiNeutral from "@/assets/characters/kiwi-neutral.png";
import kiwiWinning from "@/assets/characters/kiwi-winning.png";
import kiwiShocked from "@/assets/characters/kiwi-shocked.png";
import kiwiDefeated from "@/assets/characters/kiwi-defeated.png";
import korimakoNeutral from "@/assets/characters/korimako-neutral.png";
import korimakoWinning from "@/assets/characters/korimako-winning.png";
import korimakoShocked from "@/assets/characters/korimako-shocked.png";
import korimakoDefeated from "@/assets/characters/korimako-defeated.png";


export const CHARACTER_ART: Record<string, Record<CharacterState, string>> = {
  kea: {
    neutral: keaNeutral,
    winning: keaWinning,
    shocked: keaShocked,
    defeated: keaDefeated,
  },
  kereru: {
    neutral: kereruNeutral,
    winning: kereruWinning,
    shocked: kereruShocked,
    defeated: kereruDefeated,
  },
  tui: {
    neutral: tuiNeutral,
    winning: tuiWinning,
    shocked: tuiShocked,
    defeated: tuiDefeated,
  },
  piwakawaka: {
    neutral: piwakawakaNeutral,
    winning: piwakawakaWinning,
    shocked: piwakawakaShocked,
    defeated: piwakawakaDefeated,
  },
  kiwi: {
    neutral: kiwiNeutral,
    winning: kiwiWinning,
    shocked: kiwiShocked,
    defeated: kiwiDefeated,
  },
  korimako: {
    neutral: korimakoNeutral,
    winning: korimakoWinning,
    shocked: korimakoShocked,
    defeated: korimakoDefeated,
  },
};

/** Ace's four approved poses, mapped onto her stage slots. */
export const ACE_ART: Record<AceAssetSlot, string> = {
  idle: "/production/ace/welcome.webp",
  excited: "/production/ace/excited.webp",
  celebrating: "/production/ace/champion.webp",
  pointing: "/production/ace/presenting.webp",
  shocked: "/production/ace/shocked.webp",
  defeated: "/production/ace/shocked.webp",
};

export function characterArt(slug: string, state: CharacterState = "neutral") {
  return CHARACTER_ART[slug]?.[state] ?? null;
}

export function aceArt(slot: AceAssetSlot = "idle") {
  return ACE_ART[slot] ?? ACE_ART.idle;
}
