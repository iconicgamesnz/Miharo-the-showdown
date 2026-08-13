/**
 * Character configuration.
 *
 * Kept separate from gameplay logic so approved artwork can be swapped in
 * without touching the engine. The database (`characters` / `character_assets`)
 * is the source of truth at runtime; this file provides the launch definitions
 * and the placeholder art fallback used until approved assets are uploaded.
 */

export const CHARACTER_STATES = ["neutral", "winning", "shocked", "defeated"] as const;
export type CharacterState = (typeof CHARACTER_STATES)[number];

export type CharacterSlug =
  | "kea"
  | "kereru"
  | "tui"
  | "piwakawaka"
  | "kiwi"
  | "korimako";

export type CharacterDefinition = {
  slug: CharacterSlug;
  name: string;
  personality: string;
  accessory: string;
  /** Placeholder accent used for the asset slot until artwork is supplied. */
  accentVar: string;
};

export const CHARACTERS: CharacterDefinition[] = [
  { slug: "kea", name: "Kea", personality: "cheeky", accessory: "backwards cap", accentVar: "var(--neon-lime)" },
  { slug: "kereru", name: "Kererū", personality: "chilled", accessory: "puffer vest", accentVar: "var(--neon-cyan)" },
  { slug: "tui", name: "Tūī", personality: "smooth", accessory: "gold chain", accentVar: "var(--neon-amber)" },
  { slug: "piwakawaka", name: "Pīwakawaka", personality: "energetic", accessory: "sports sweatband", accentVar: "var(--neon-magenta)" },
  { slug: "kiwi", name: "Kiwi", personality: "determined", accessory: "red sneakers", accentVar: "oklch(0.72 0.19 40)" },
  { slug: "korimako", name: "Korimako", personality: "cool", accessory: "sunglasses", accentVar: "oklch(0.7 0.19 300)" },
];

export const CHARACTER_BY_SLUG: Record<string, CharacterDefinition> = Object.fromEntries(
  CHARACTERS.map((c) => [c.slug, c]),
);
