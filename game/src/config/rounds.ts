/**
 * Kiwi As — round definitions and scoring rules.
 *
 * Data only. The engine reads these; UI never hardcodes scoring.
 */

export type RoundType =
  | "sweet_as"
  | "choice_bro"
  | "yeah_nah"
  | "mana"
  | "showdown"
  | "quickie"
  | "sudden_death";

export type RoundDefinition = {
  type: RoundType;
  order: number;
  name: string;
  tagline: string;
  questionCount: number;
  defaultTimerSeconds: number;
  speedBonus: boolean;
  description: string;
};

export const FULL_GAME_ROUNDS: RoundDefinition[] = [
  {
    type: "sweet_as",
    order: 1,
    name: "Sweet As",
    tagline: "Warm up, no pressure",
    questionCount: 5,
    defaultTimerSeconds: 12,
    speedBonus: true,
    description: "Accessible NZ general knowledge. Mostly four-option multiple choice.",
  },
  {
    type: "choice_bro",
    order: 2,
    name: "Choice, Bro",
    tagline: "Mixed-up challenges",
    questionCount: 5,
    defaultTimerSeconds: 12,
    speedBonus: true,
    description: "Ordering, odd-one-out, which-came-first, image ID and more.",
  },
  {
    type: "yeah_nah",
    order: 3,
    name: "Quick As",
    tagline: "Rapid fire, gut instinct",
    questionCount: 8,
    defaultTimerSeconds: 5,
    speedBonus: true,
    description: "Eight statements. Yeah or Nah. Five seconds each.",
  },
  {
    type: "mana",
    order: 4,
    name: "Put Your Mana Where Your Mouth Is",
    tagline: "Back yourself",
    questionCount: 5,
    defaultTimerSeconds: 12,
    speedBonus: false,
    description: "Choose your risk before you see the question.",
  },
  {
    type: "showdown",
    order: 5,
    name: "The Final",
    tagline: "It's all on the line",
    questionCount: 5,
    defaultTimerSeconds: 10,
    speedBonus: false,
    description: "Five escalating-value questions. No speed or Heat points; final totals stay hidden until game over.",
  },
];

export const QUICKIE_ROUNDS: RoundDefinition[] = [
  {
    type: "quickie",
    order: 1,
    name: "Kiwi As Quickie",
    tagline: "Ten challenges, one winner",
    questionCount: 10,
    defaultTimerSeconds: 18,
    speedBonus: true,
    description: "A complete free mini game show using the free question bank.",
  },
];

/** Standard scoring. */
export const SCORING = {
  baseCorrect: 1000,
  /** Choice, Bro ordering challenges are worth more — all-or-nothing. */
  orderingCorrect: 1500,
  maxSpeedBonus: 500,
  /** Quick As is fast and cheap: 750 base + up to 250 speed = 1,000 before Heat. */
  yeahNahCorrect: 750,
  yeahNahMaxSpeed: 250,
  streak: { 2: 100, 3: 200, 4: 300, 5: 400 } as Record<number, number>,
  maxStreakBonus: 400,
} as const;


/**
 * Round Five — The Final.
 *
 * The Final's drama comes from escalating question values, not from bonuses:
 * no speed bonus, no Heat points, no negatives. Earlier rounds still matter
 * because nothing here is multiplied or reset.
 */
export const FINAL = {
  /** Points for a correct answer, per question index (0-based). */
  values: [1000, 1500, 2000, 2500, 3000],
  /** Server-authoritative timer per question index, in seconds. */
  timers: [10, 10, 10, 10, 15],
  /** How long the "QUESTION n OF 5 — WORTH x" card holds. */
  valueMs: 1200,
  /** The last question gets a longer, staged build-up. */
  finalValueMs: 3400,

  /** Solo endings get an encouraging label — never an insulting one. */
  soloLabels: [
    { min: 0, label: "SWEET AS" },
    { min: 9000, label: "CHOICE!" },
    { min: 16000, label: "ABSOLUTELY ICONIC" },
  ],
} as const;

/** Label for a solo final score. Thresholds live in `FINAL.soloLabels`. */
export function soloLabel(score: number): string {
  let label: string = FINAL.soloLabels[0]!.label;
  for (const tier of FINAL.soloLabels) if (score >= tier.min) label = tier.label;
  return label;
}


/** Round Four risk levels. */
export const MANA_RISKS = [
  { key: "shell_be_right", label: "She'll Be Right", multiplier: 1, correct: 1000, wrong: 0 },
  { key: "hard_out", label: "Hard Out", multiplier: 2, correct: 2000, wrong: -1000 },
  { key: "send_it", label: "Send It", multiplier: 3, correct: 3000, wrong: -2000 },
] as const;
export type ManaRiskKey = (typeof MANA_RISKS)[number]["key"];

export const ROOM_RULES = {
  maxPlayers: 6,
  minPlayers: 1,
  codeLength: 4,
  roomTtlHours: 6,
} as const;
