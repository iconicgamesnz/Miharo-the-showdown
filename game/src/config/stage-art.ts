/**
 * Production TV stage artwork registry.
 *
 * Each show beat has its own 16:9 plate. Dynamic copy, questions, players,
 * scores and winner data remain live HTML layered over these backgrounds.
 */
export const STAGE_KINDS = ["welcome", "round_intro", "question", "final", "champion"] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export const STAGE_ART: Record<StageKind, string> = {
  welcome: "/production/stage/welcome.webp",
  round_intro: "/production/stage/round-intro.webp",
  question: "/production/stage/question-reveal.webp",
  final: "/production/stage/final.webp",
  champion: "/production/stage/champion.webp",
};

export const MIHARO_LOGO_URL = "/production/brand/miharo-showdown-logo.webp";
export const ALL_STAGE_URLS = Array.from(new Set(Object.values(STAGE_ART)));

export function stageForPhase(phase: string, round: string): StageKind {
  if (phase === "lobby") return "welcome";
  if (phase === "game_over") return "champion";
  // The Final stays in the gold studio for intro, value cards, questions and reveals.
  if (round === "showdown") return "final";
  if (phase === "round_intro" || phase === "round_complete") return "round_intro";
  return "question";
}
