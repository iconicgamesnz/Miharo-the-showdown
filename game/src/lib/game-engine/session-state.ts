/**
 * Shared (client-safe) types for the authoritative game session state.
 *
 * The single source of truth is `showdown_game_sessions.phase` + `showdown_game_sessions.state`.
 * Every device — TV and phones — renders from this. Clients never compute
 * scores, never decide when a question closes and never see the correct answer
 * until the server writes it into `state.reveal`.
 */

export type GamePhase =
  | "lobby"
  | "round_intro"
  /** Round 4 only: players pick their risk before the question exists. */
  | "risk_open"
  | "risk_locked"
  /** Round 5 only: "QUESTION n OF 5 — WORTH x" before the question appears. */
  | "question_value"
  | "question_open"
  | "question_locked"
  /** Round 4 only: a short beat showing who backed themselves, before grading. */
  | "risk_reveal"
  | "answer_reveal"
  | "round_complete"
  /** Terminal: the game is over, final ranking and winner(s) are persisted. */
  | "game_over";

/** Rounds the engine can currently run. */
export type EngineRound = "quickie" | "sweet_as" | "choice_bro" | "yeah_nah" | "mana" | "showdown";

/** Round 4 risk tiers. Server-side values live in `@/config/rounds`. */
export type RiskKey = "shell_be_right" | "hard_out" | "send_it";



/**
 * Presentation + interaction format of a challenge. The phone renderer and the
 * TV both switch on this, so new formats never need new routes.
 */
export type ChallengeFormat =
  | "single_choice"
  | "which_one_is_real"
  | "doesnt_belong"
  | "which_came_first"
  | "ordering"
  | "yeah_nah";


export type AnswerOption = {
  key: string;
  text: string;
  /** Secondary line revealed after grading (e.g. the year for "which came first"). */
  detail?: string;
};

/** Question payload as broadcast to devices — no correct answer inside. */
export type PublicQuestion = {
  sessionQuestionId: string;
  number: number;
  type: string;
  /** Interaction/presentation format; drives which control the phone renders. */
  format: ChallengeFormat;
  text: string;
  options: AnswerOption[];
  timerSeconds: number;
};

export type PlayerResult = {
  chosen: string | null;
  /** The exact option text the player saw and tapped — used to prove the record. */
  chosenText?: string | null;

  /** Submitted sequence for ordering challenges. */
  order?: string[] | null;
  correct: boolean;
  base: number;
  speed: number;
  heat: number;
  /** Signed point delta — Round 4 can be negative. */
  points: number;
  streak: number;
  responseMs: number | null;
  /** Round 4: the risk this player backed themselves with. */
  risk?: RiskKey | null;
  /** Round 4: true when the player never picked and was defaulted to x1. */
  riskAuto?: boolean;
};


export type ScoreRow = {
  playerId: string;
  nickname: string;
  characterId: string | null;
  score: number;
  streak: number;
};

export type RevealPayload = {
  correctKey?: string;
  correctText?: string;
  /** Ordered option keys for ordering challenges. */
  correctOrder?: string[];
  /** Option details (years etc.) unlocked at reveal time. */
  details?: Record<string, string>;
  explanation: string | null;
};

/** One player's authoritative end-of-game placement. */
export type FinalPlace = {
  place: number;
  playerId: string;
  nickname: string;
  characterId: string | null;
  score: number;
  /** Correct answers across the whole session — first tiebreak. */
  correctCount: number;
  /** Aggregate response time on correct answers, ms — second tiebreak. */
  correctMs: number;
  champion: boolean;
};

/** Persisted end-of-game summary. Written once, by the server. */
export type FinalSummary = {
  ranking: FinalPlace[];
  /** Player ids in first place. More than one means joint champions. */
  winners: string[];
  winnerNames: string[];
  /** When the staged reveal clock started — reveals replay identically on refresh. */
  revealStartedAt: string;
  completedAt: string;
  solo: boolean;
  soloLabel?: string;
  /** Set once the host starts a rematch: the new room code to move to. */
  rematchCode?: string;
};

export type SessionState = {
  round: EngineRound;
  roundName: string;
  /** Name of the round after this one, or null when nothing is built yet. */
  nextRoundName?: string | null;
  /** Sequence offset of this round inside `session_questions`. */
  offset: number;

  total: number;
  index: number;
  introUntil?: string;
  introLines?: string[];
  question?: PublicQuestion;
  startedAt?: string;
  closesAt?: string;
  revealUntil?: string;
  lockedCount: number;
  activeCount: number;
  /** Round 4 risk phase: deadline for picking a risk. */
  riskClosesAt?: string;
  /** Round 4 risk phase: how many players have locked a risk. */
  riskLockedCount?: number;
  /** Round 4: deadline of the "who backed themselves" beat before grading shows. */
  riskRevealUntil?: string;
  /** Round 4: every player's risk, only ever written at reveal time. */
  risks?: Record<string, RiskKey>;

  /** Round 5: what this question is worth, shown before it opens. */
  questionValue?: number;
  /** Round 5: deadline of the value card before the question appears. */
  valueUntil?: string;
  /** Round 5: persisted end-of-game ranking and winner(s). */
  final?: FinalSummary;

  reveal?: RevealPayload;
  results?: Record<string, PlayerResult>;
  scores: ScoreRow[];
};


export const EMPTY_STATE: SessionState = {
  round: "sweet_as",
  roundName: "Sweet As",
  nextRoundName: "Choice, Bro",
  offset: 0,
  total: 0,
  index: 0,
  lockedCount: 0,
  activeCount: 0,
  scores: [],
};

/** Milliseconds until an ISO deadline, floored at 0. */
export function msUntil(iso: string | undefined, now = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, new Date(iso).getTime() - now);
}

/** True when a format is answered with one tap. */
export function isSingleTap(format: ChallengeFormat) {
  return format !== "ordering";
}
