/**
 * Server-only Kiwi As game engine.
 *
 * The engine is a small explicit state machine persisted on `showdown_game_sessions`:
 *
 *   lobby -> round_intro -> question_open -> question_locked
 *         -> answer_reveal -> (next question | round_complete)
 *
 * It is round-agnostic: `ROUNDS` supplies pacing, and each question row carries
 * its own `challenge_format` + `timer_seconds`, so Round 2 (Choice, Bro) reuses
 * the exact same machine as Round 1 (Sweet As).
 *
 * Devices call `tickSession` on a loop; every transition is guarded by a
 * conditional UPDATE on the current phase so only one caller can advance the
 * machine. All deadlines are server timestamps stored in `state`, so a device
 * with a skewed or paused clock can never open, close or extend a question.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  EMPTY_STATE,
  type ChallengeFormat,
  type EngineRound,
  type FinalPlace,
  type FinalSummary,
  type GamePhase,
  type PlayerResult,
  type PublicQuestion,
  type RevealPayload,
  type RiskKey,
  type SessionState,
  type ScoreRow,
} from "@/lib/game-engine/session-state";
import { speedBonus, streakBonus, nextStreak, applyPoints, manaPoints } from "@/lib/game-engine/scoring";
import { SCORING, MANA_RISKS, FINAL, soloLabel } from "@/config/rounds";



type Admin = SupabaseClient<Database>;

export type RoundConfig = {
  round: EngineRound;
  name: string;
  questionCount: number;
  timerSeconds: number;
  introMs: number;
  introLines: string[];
  lockPauseMs: number;
  revealMs: number;
  /** Ordering challenges need a beat longer to read the correct sequence. */
  orderingRevealMs?: number;
  lateGraceMs: number;
  next: EngineRound | null;
  nextName: string | null;
  /** Round 4 only: risk-selection timer, in seconds. */
  riskSeconds?: number;
  /** Round 4 only: pause between risks locking and the question appearing. */
  riskPauseMs?: number;
  /** Round 4 only: how long "who backed themselves" shows before grading. */
  riskRevealMs?: number;
};


/**
 * Pacing: FAST BY DEFAULT, DRAMATIC ONLY WHEN IT MATTERS.
 *
 * `lockPauseMs` is the beat between the last player locking in and the reveal;
 * `revealMs` is how long the result holds before the next question. Longer
 * holds are reserved for round intros, the Mana risk reveal, The Final's last
 * question and the champion sequence.
 */
export const ROUNDS: Record<EngineRound, RoundConfig> = {
  quickie: {
    round: "quickie",
    name: "Kiwi As Quickie",
    questionCount: 10,
    timerSeconds: 12,
    introMs: 3000,
    introLines: ["The Quickie.", "Ten challenges. One winner. Sweet as."],
    lockPauseMs: 350,
    revealMs: 2400,
    lateGraceMs: 1200,
    next: null,
    nextName: null,
  },
  sweet_as: {
    round: "sweet_as",
    name: "Sweet As",
    questionCount: 7,
    timerSeconds: 12,
    introMs: 3500,
    introLines: ["Sweet As.", "Let's see what you know."],
    lockPauseMs: 400,
    revealMs: 2800,
    lateGraceMs: 1200,
    next: "choice_bro",
    nextName: "Choice, Bro",
  },
  choice_bro: {
    round: "choice_bro",
    name: "Choice, Bro",
    questionCount: 6,
    timerSeconds: 12,
    introMs: 3500,
    introLines: ["Choice, Bro.", "Things are about to get a little trickier."],
    lockPauseMs: 400,
    revealMs: 3000,
    orderingRevealMs: 4000,
    lateGraceMs: 1200,
    next: "yeah_nah",
    nextName: "Quick As",
  },
  // Quick As is the fastest round in the show: 5s statements, a ~300ms beat and
  // a two-second verdict, so eight statements land in about a minute.
  yeah_nah: {
    round: "yeah_nah",
    name: "Quick As",
    questionCount: 10,
    timerSeconds: 5,
    introMs: 2200,
    introLines: ["Quick As ⚡", "Ten questions. Five seconds each. Go with your gut."],
    lockPauseMs: 150,
    revealMs: 1200,
    lateGraceMs: 300,
    next: "mana",
    nextName: "Put Your Mana Where Your Mouth Is",
  },
  // Round 4 runs two phases per question: an 8s risk selection, a short beat,
  // then the 12s question. No speed bonus, no Heat points — just nerve.
  mana: {
    round: "mana",
    name: "Put Your Mana Where Your Mouth Is",
    questionCount: 7,
    timerSeconds: 12,
    introMs: 5000,
    introLines: [
      "Put your mana where your mouth is.",
      "Back yourself — pick your risk before you see the question.",
    ],
    lockPauseMs: 500,
    revealMs: 3000,
    lateGraceMs: 1200,
    riskSeconds: 8,
    riskPauseMs: 500,
    riskRevealMs: 600,
    next: "showdown",
    nextName: "The Final",
  },
  // Round 5 — The Final. Familiar controls, escalating stakes. Timers and
  // question values are per-index (`FINAL`), no speed bonus, no Heat points,
  // no negatives, and no overall leaderboard until the game is over.
  showdown: {
    round: "showdown",
    name: "The Final",
    questionCount: 5,
    timerSeconds: 10,
    introMs: 4000,
    introLines: ["Well… here we are.", "The Final. Everything you've done got you here."],
    lockPauseMs: 400,
    revealMs: 2800,
    lateGraceMs: 1200,
    next: null,
    nextName: null,
  },
};





/** Back-compat alias used by older call sites. */
export const ROUND1 = ROUNDS.sweet_as;

type SessionRow = {
  id: string;
  room_id: string;
  phase: string;
  status: string;
  current_index: number;
  state: unknown;
};

export function readState(row: { state: unknown }): SessionState {
  const s = row.state;
  if (!s || typeof s !== "object") return { ...EMPTY_STATE };
  return { ...EMPTY_STATE, ...(s as Partial<SessionState>) } as SessionState;
}

function roundConfig(state: SessionState): RoundConfig {
  return ROUNDS[state.round] ?? ROUNDS.sweet_as;
}

export async function loadContext(admin: Admin, code: string) {
  const { data: room } = await admin
    .from("rooms")
    .select("id, code, status, game_pack_id, host_token_hash, max_players")
    .eq("code", code)
    .maybeSingle();
  if (!room) return null;
  const { data: session } = await admin
    .from("showdown_game_sessions")
    .select("id, room_id, phase, status, current_index, state")
    .eq("room_id", room.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return null;
  return { room, session: session as SessionRow };
}

async function activePlayers(admin: Admin, roomId: string) {
  const { data } = await admin
    .from("room_players")
    .select("id, nickname, character_id, score, streak, status")
    .eq("room_id", roomId)
    .neq("status", "left")
    .order("joined_at", { ascending: true });
  return data ?? [];
}

/** Shapes an already-loaded player list into a scoreboard — no extra query. */
function toScoreboard(players: Awaited<ReturnType<typeof activePlayers>>): ScoreRow[] {
  return players
    .map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      characterId: p.character_id,
      score: p.score,
      streak: p.streak,
    }))
    .sort((a, b) => b.score - a.score);
}

async function scoreboard(admin: Admin, roomId: string): Promise<ScoreRow[]> {
  return toScoreboard(await activePlayers(admin, roomId));
}


function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Spread the picked challenges so identical formats aren't back to back. */
function spreadFormats<T extends { challenge_format: string | null }>(items: T[]): T[] {
  const out: T[] = [];
  const pool = [...items];
  while (pool.length) {
    const last = out[out.length - 1]?.challenge_format ?? null;
    const index = pool.findIndex((q) => q.challenge_format !== last);
    out.push(...pool.splice(index >= 0 ? index : 0, 1));
  }
  // The greedy pass can only ever strand a duplicate at the very end (e.g. two
  // ordering challenges). Swap it backwards into the first slot where neither
  // neighbour shares its format so the round never finishes on a repeat.
  for (let i = out.length - 1; i > 0; i -= 1) {
    if (out[i]!.challenge_format !== out[i - 1]!.challenge_format) continue;
    const moving = out[i]!;
    for (let j = 1; j < i; j += 1) {
      const before = out[j - 1]!.challenge_format;
      const after = out[j]!.challenge_format;
      const displacedFits =
        out[j]!.challenge_format !== out[i - 1]!.challenge_format &&
        (i + 1 >= out.length || out[j]!.challenge_format !== out[i + 1]!.challenge_format);
      if (moving.challenge_format !== before && moving.challenge_format !== after && displacedFits) {
        out.splice(i, 1, out[j]!);
        out.splice(j, 1, moving);
        break;
      }
    }
  }
  return out;
}

const CHOICE_BRO_FORMATS = ["which_one_is_real", "which_came_first", "doesnt_belong", "ordering"];

type YeahNahRow = { id: string; challenge_format: string | null; correct_answer: unknown };

function answerKeyOf(row: { correct_answer: unknown }): string {
  const raw = row.correct_answer;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") return String((raw as { key?: unknown }).key ?? "");
  return "";
}

/**
 * Picks the round's statements with a roughly even YEAH/NAH split, then orders
 * them so players can't ride a pattern: no three identical answers in a row and
 * never a perfect alternation.
 */
function pickYeahNah<T extends YeahNahRow>(available: T[], count: number): T[] {
  const yeah = shuffle(available.filter((q) => answerKeyOf(q) === "yeah"));
  const nah = shuffle(available.filter((q) => answerKeyOf(q) !== "yeah"));
  const target = Math.min(count, available.length);
  const half = Math.floor(target / 2);
  const picked = [...yeah.slice(0, half), ...nah.slice(0, target - half)];
  // Backfill if one side is short.
  if (picked.length < target) {
    const pickedIds = new Set(picked.map((q) => q.id));
    picked.push(...shuffle(available.filter((q) => !pickedIds.has(q.id))).slice(0, target - picked.length));
  }

  const keys = (list: T[]) => list.map(answerKeyOf);
  const badRun = (list: T[]) => {
    const k = keys(list);
    for (let i = 2; i < k.length; i += 1) if (k[i] === k[i - 1] && k[i] === k[i - 2]) return true;
    return false;
  };
  const alternating = (list: T[]) => {
    const k = keys(list);
    return k.length > 3 && k.every((v, i) => i === 0 || v !== k[i - 1]);
  };

  let ordered = shuffle(picked);
  for (let attempt = 0; attempt < 40 && (badRun(ordered) || alternating(ordered)); attempt += 1) {
    ordered = shuffle(picked);
  }
  return ordered;
}


/**
 * Picks a round's questions once, at round start, and persists them as
 * `session_questions`. Every device then reads the same questions in the same
 * order — clients never randomise anything.
 *
 * Returns the sequence offset of this round plus how many challenges it holds.
 */
export async function startingRoundForPack(admin: Admin, packId: string): Promise<EngineRound> {
  const { data: pack } = await admin.from("game_packs").select("slug").eq("id", packId).maybeSingle();
  if (!pack) throw new Error("That game pack is missing.");
  return pack.slug === "kiwi-as-quickie" ? "quickie" : "sweet_as";
}

export async function createRoundQuestions(
  admin: Admin,
  sessionId: string,
  packId: string,
  round: EngineRound = "sweet_as",
) {
  const cfg = ROUNDS[round];

  const { data: already } = await admin
    .from("session_questions")
    .select("sequence")
    .eq("session_id", sessionId)
    .eq("round_type", round)
    .order("sequence", { ascending: true });
  if (already && already.length > 0) {
    return { offset: already[0]!.sequence - 1, total: already.length };
  }

  const { data: maxRow } = await admin
    .from("session_questions")
    .select("sequence")
    .eq("session_id", sessionId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  const offset = maxRow?.sequence ?? 0;

  let poolQuery = admin
    .from("questions")
    .select("id, category, challenge_format, correct_answer")
    .eq("game_pack_id", packId)
    .eq("round_type", round)
    .eq("active", true);

  // The free Quickie is the public first impression of the product. Never serve
  // an editorially-unverified development question in that launch experience.
  if (round === "quickie") poolQuery = poolQuery.not("last_verified", "is", null);

  const { data: pool } = await poolQuery;

  // A question already used earlier in this same session is never reused.
  const { data: usedRows } = await admin
    .from("session_questions")
    .select("question_id")
    .eq("session_id", sessionId);
  const used = new Set((usedRows ?? []).map((r) => r.question_id));

  const all = pool ?? [];
  const available = all.filter((q) => !used.has(q.id));
  if (available.length === 0) throw new Error(`No ${cfg.name} challenges are available yet.`);

  const pickAcrossCategories = (items: typeof available, count: number) => {
    const byCategory = new Map<string, typeof available>();

    for (const question of items) {
      const key = question.category?.trim() || "Random As";
      byCategory.set(key, [...(byCategory.get(key) ?? []), question]);
    }

    const buckets = shuffle(
      [...byCategory.values()].map((bucket) => shuffle(bucket))
    );

    const picked: typeof available = [];

    for (let pass = 0; picked.length < count && pass < 20; pass += 1) {
      for (const bucket of buckets) {
        const next = bucket[pass];
        if (next && picked.length < count) picked.push(next);
      }
    }

    return picked.slice(0, count);
  };

  let chosen: { id: string; challenge_format: string | null }[];

  if (round === "choice_bro") {
    // One of each supported format, then a random extra, then de-clumped.
    const byFormat = new Map<string, typeof available>();
    for (const q of available) {
      const key = q.challenge_format ?? "single_choice";
      byFormat.set(key, [...(byFormat.get(key) ?? []), q]);
    }
    const picked: typeof available = [];
    for (const format of CHOICE_BRO_FORMATS) {
      const bucket = shuffle(byFormat.get(format) ?? []);
      if (bucket[0]) picked.push(bucket[0]);
    }
    const pickedIds = new Set(picked.map((q) => q.id));
    const extras = shuffle(available.filter((q) => !pickedIds.has(q.id)));
    while (picked.length < Math.min(cfg.questionCount, available.length) && extras.length) {
      picked.push(extras.shift()!);
    }
    chosen = spreadFormats(picked).slice(0, cfg.questionCount);
  } else if (round === "yeah_nah") {
    chosen = pickYeahNah(available, cfg.questionCount);
  } else if (round === "showdown") {
    // The Final: a varied set of already-taught formats, never two of the same
    // format back to back, and never a question this session has already asked.
    const byFormat = new Map<string, typeof available>();
    for (const q of available) {
      const key = q.challenge_format ?? "single_choice";
      byFormat.set(key, [...(byFormat.get(key) ?? []), q]);
    }
    const buckets = shuffle([...byFormat.values()].map((bucket) => shuffle(bucket)));
    const picked: typeof available = [];
    // Round-robin across formats so five questions span as many formats as exist.
    for (let pass = 0; picked.length < cfg.questionCount && pass < 8; pass += 1) {
      for (const bucket of buckets) {
        const next = bucket[pass];
        if (next && picked.length < cfg.questionCount) picked.push(next);
      }
    }
    chosen = spreadFormats(picked).slice(0, cfg.questionCount);
  } else {
    chosen = pickAcrossCategories(available, Math.min(cfg.questionCount, available.length));
  }



  await admin.from("session_questions").insert(
    chosen.map((question, index) => ({
      session_id: sessionId,
      question_id: question.id,
      round_type: round,
      sequence: offset + index + 1,
    })),
  );

  return { offset, total: chosen.length };
}

export async function beginRoundIntro(
  admin: Admin,
  sessionId: string,
  roomId: string,
  total: number,
  round: EngineRound = "sweet_as",
  offset = 0,
) {
  const cfg = ROUNDS[round];
  const state: SessionState = {
    ...EMPTY_STATE,
    round,
    roundName: cfg.name,
    nextRoundName: cfg.nextName,
    offset,
    total,
    index: 0,
    introUntil: new Date(Date.now() + cfg.introMs).toISOString(),
    introLines: cfg.introLines,
    scores: await scoreboard(admin, roomId),
  };
  await admin
    .from("showdown_game_sessions")
    .update({
      status: "active",
      phase: "round_intro" satisfies GamePhase,
      current_round: round,
      current_index: 0,
      started_at: new Date().toISOString(),
      state: state as never,
    })
    .eq("id", sessionId);
}

type QuestionRow = {
  id: string;
  question_text: string;
  question_type: string;
  challenge_format: string | null;
  answer_options: unknown;
  correct_answer: unknown;
  explanation: string | null;
  timer_seconds: number;
};

type SessionQuestionRow = {
  id: string;
  sequence: number;
  question_id: string;
  questions: QuestionRow | null;
};

const QUESTION_SELECT =
  "id, sequence, question_id, questions(id, category, question_text, question_type, challenge_format, answer_options, correct_answer, explanation, timer_seconds)";

async function loadSessionQuestion(admin: Admin, sessionId: string, sequence: number) {
  const { data } = await admin
    .from("session_questions")
    .select(QUESTION_SELECT)
    .eq("session_id", sessionId)
    .eq("sequence", sequence)
    .maybeSingle();
  return (data as SessionQuestionRow | null) ?? null;
}

async function countRoundQuestions(admin: Admin, sessionId: string, round: EngineRound) {
  const { count } = await admin
    .from("session_questions")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("round_type", round);
  return count ?? 0;
}

type RawOption = { key: string; text: string; detail?: string };

function rawOptions(q: QuestionRow): RawOption[] {
  return Array.isArray(q.answer_options) ? (q.answer_options as RawOption[]) : [];
}

function formatOf(q: QuestionRow): ChallengeFormat {
  const raw = q.challenge_format ?? "";
  if (
    raw === "which_one_is_real" ||
    raw === "doesnt_belong" ||
    raw === "which_came_first" ||
    raw === "ordering" ||
    raw === "yeah_nah"
  ) {
    return raw;
  }
  if (q.question_type === "yeah_nah") return "yeah_nah";
  return q.question_type === "ordering" ? "ordering" : "single_choice";
}

/**
 * YEAH NAH — canonical mapping. There are exactly two identifiers in the whole
 * system: `yeah` (TRUE) and `nah` (FALSE). Nothing anywhere may depend on array
 * position, string truthiness or a shuffled index.
 */
export const YEAH = "yeah";
export const NAH = "nah";
const YEAH_NAH_OPTIONS = [
  { key: YEAH, text: "Yeah" },
  { key: NAH, text: "Nah" },
];
const YEAH_ALIASES = new Set(["yeah", "yes", "true", "t", "y", "1"]);

/** Folds any stored/submitted representation onto `yeah` | `nah`. */
export function canonicalYeahNah(value: string): typeof YEAH | typeof NAH {
  return YEAH_ALIASES.has(value.trim().toLowerCase()) ? YEAH : NAH;
}

function toPublicQuestion(row: SessionQuestionRow, number: number, timerSeconds: number): PublicQuestion {
  const q = row.questions!;
  const format = formatOf(q);
  // Options are shuffled ONCE, here, at open time, and the shuffled list is
  // persisted into session state — every device (TV and every phone) renders
  // that same list, and grading matches on the stable option key, never on a
  // position. Clients never reshuffle.
  // Quick As is the exception: canonical YEAH left, NAH right, always.
  const raw = rawOptions(q).map((o) => ({ key: String(o.key), text: String(o.text) }));
  const options = format === "yeah_nah" ? YEAH_NAH_OPTIONS.map((o) => ({ ...o })) : shuffle(raw);

  return {
    sessionQuestionId: row.id,
    number,
    type: q.question_type,
    category: q.category ?? null,
    format,
    text: q.question_text,
    options,
    timerSeconds,
  };
}

/* ------------------------------------------------------------------ *
 * Round 4 — Put Your Mana Where Your Mouth Is
 *
 * Two phases per question. Players commit to a risk tier BEFORE the
 * question exists on any device, so nothing about the question can inform
 * the bet. Risks live in `player_risks`, a service-role-only table, so no
 * device can read another player's risk before the engine reveals it.
 * ------------------------------------------------------------------ */

const RISK_KEYS = MANA_RISKS.map((r) => r.key) as readonly string[];
const DEFAULT_RISK: RiskKey = "shell_be_right";

function isRiskKey(value: string): value is RiskKey {
  return RISK_KEYS.includes(value);
}

/** The `session_questions` row the current risk phase belongs to. */
async function currentRiskRow(admin: Admin, session: SessionRow, state: SessionState) {
  return loadSessionQuestion(admin, session.id, state.offset + state.index + 1);
}

async function riskRows(admin: Admin, sessionQuestionId: string) {
  const { data } = await admin
    .from("player_risks")
    .select("room_player_id, risk_key, auto_assigned")
    .eq("session_question_id", sessionQuestionId);
  return data ?? [];
}

/** Opens the risk-selection phase for question `index` (0-based in round). */
async function openRiskPhase(admin: Admin, session: SessionRow, index: number, fromPhase: GamePhase) {
  const prev = readState(session);
  const cfg = roundConfig(prev);
  const now = Date.now();
  const [players, total] = await Promise.all([
    activePlayers(admin, session.room_id),
    prev.total
      ? Promise.resolve(prev.total)
      : countRoundQuestions(admin, session.id, prev.round),
  ]);
  const state: SessionState = {
    ...EMPTY_STATE,
    round: prev.round,
    roundName: cfg.name,
    nextRoundName: cfg.nextName,
    offset: prev.offset,
    total,
    index,
    riskClosesAt: new Date(now + (cfg.riskSeconds ?? 8) * 1000).toISOString(),
    riskLockedCount: 0,
    lockedCount: 0,
    activeCount: players.length,
    scores: toScoreboard(players),
  };

  const { data: won } = await admin
    .from("showdown_game_sessions")
    .update({ phase: "risk_open" satisfies GamePhase, current_index: index, state: state as never })
    .eq("id", session.id)
    .eq("phase", fromPhase)
    .select("id");
  return Boolean(won && won.length > 0);
}

/**
 * Closes risk selection: anyone who didn't pick is defaulted to She'll Be Right
 * (x1), then the machine waits one beat before the question appears.
 */
async function closeRiskPhase(admin: Admin, session: SessionRow, fromPhase: GamePhase) {
  const state = readState(session);
  const cfg = roundConfig(state);
  const [row, players] = await Promise.all([
    currentRiskRow(admin, session, state),
    activePlayers(admin, session.room_id),
  ]);
  if (!row) return false;

  const { data: won } = await admin
    .from("showdown_game_sessions")
    .update({ phase: "risk_locked" satisfies GamePhase })
    .eq("id", session.id)
    .eq("phase", fromPhase)
    .select("id");
  if (!won || won.length === 0) return false;

  const existing = new Set((await riskRows(admin, row.id)).map((r) => r.room_player_id));
  const missing = players.filter((p) => !existing.has(p.id));

  const now = Date.now();
  await Promise.all([
    missing.length
      ? admin.from("player_risks").insert(
          missing.map((p) => ({
            session_question_id: row.id,
            room_player_id: p.id,
            risk_key: DEFAULT_RISK,
            auto_assigned: true,
          })),
        )
      : Promise.resolve(),
    admin
      .from("showdown_game_sessions")
      .update({
        state: {
          ...state,
          riskLockedCount: players.length,
          activeCount: players.length,
          // The question appears once this beat elapses.
          closesAt: new Date(now + (cfg.riskPauseMs ?? 1000)).toISOString(),
        } as never,
      })
      .eq("id", session.id),
  ]);

  return true;
}

/** Records one player's risk. Rejected once the risk phase has closed. */
export async function recordRisk(
  admin: Admin,
  code: string,
  playerTokenHash: string,
  riskKey: string,
) {
  const ctx = await loadContext(admin, code);
  if (!ctx) throw new Error("That game isn't running.");
  const { room, session } = ctx;
  const state = readState(session);
  const cfg = roundConfig(state);
  if (state.round !== "mana") throw new Error("No risk to take right now.");
  if (session.phase !== "risk_open") throw new Error("Risks are locked.");
  if (!isRiskKey(riskKey)) throw new Error("Unknown risk.");
  const closesAt = state.riskClosesAt ? new Date(state.riskClosesAt).getTime() : 0;
  const now = Date.now();
  if (now > closesAt + cfg.lateGraceMs) throw new Error("Too slow — risks are locked.");

  const [{ data: player }, row] = await Promise.all([
    admin
      .from("room_players")
      .select("id, status")
      .eq("room_id", room.id)
      .eq("player_token_hash", playerTokenHash)
      .maybeSingle(),
    currentRiskRow(admin, session, state),
  ]);
  if (!player || player.status === "left") throw new Error("You're not in this game.");
  if (!row) throw new Error("That question has moved on.");

  const { data: already } = await admin
    .from("player_risks")
    .select("id, risk_key")
    .eq("session_question_id", row.id)
    .eq("room_player_id", player.id)
    .maybeSingle();
  if (already) return { locked: true, duplicate: true as const, risk: already.risk_key };

  const { error } = await admin.from("player_risks").insert({
    session_question_id: row.id,
    room_player_id: player.id,
    risk_key: riskKey,
  });
  if (error && !error.message.includes("duplicate")) throw new Error("Couldn't lock that risk in.");

  const [players, allRisks] = await Promise.all([
    activePlayers(admin, room.id),
    riskRows(admin, row.id),
  ]);
  const eligible = new Set(players.map((p) => p.id));
  const locked = new Set(allRisks.map((r) => r.room_player_id).filter((id) => eligible.has(id)))
    .size;

  await admin
    .from("showdown_game_sessions")
    .update({
      state: { ...state, riskLockedCount: locked, activeCount: players.length } as never,
    })
    .eq("id", session.id)
    .eq("phase", "risk_open");

  return { locked: true, duplicate: false as const, risk: riskKey };
}

/* ------------------------------------------------------------------ *
 * Round 5 — The Final
 *
 * Every question is preceded by a value card, and the question's worth
 * escalates: 1,000 / 1,500 / 2,000 / 2,500 / 3,000. Timers and values are
 * configuration (`FINAL`), never baked into components, and the overall
 * leaderboard is deliberately withheld until the game is over.
 * ------------------------------------------------------------------ */

function finalValue(index: number) {
  return FINAL.values[index] ?? FINAL.values[FINAL.values.length - 1]!;
}

function finalTimer(index: number) {
  return FINAL.timers[index] ?? FINAL.timers[FINAL.timers.length - 1]!;
}

/** Shows "QUESTION n OF 5 — WORTH x" before the question opens. */
async function openValueCard(admin: Admin, session: SessionRow, index: number, fromPhase: GamePhase) {
  const prev = readState(session);
  const cfg = roundConfig(prev);
  const now = Date.now();
  const players = await activePlayers(admin, session.room_id);
  const total = prev.total || (await countRoundQuestions(admin, session.id, prev.round));
  const last = index >= total - 1;
  const state: SessionState = {
    ...EMPTY_STATE,
    round: prev.round,
    roundName: cfg.name,
    nextRoundName: cfg.nextName,
    offset: prev.offset,
    total,
    index,
    questionValue: finalValue(index),
    valueUntil: new Date(now + (last ? FINAL.finalValueMs : FINAL.valueMs)).toISOString(),
    lockedCount: 0,
    activeCount: players.length,
    // The Final hides running totals — nothing but the value card here.
    scores: [],
  };
  const { data: won } = await admin
    .from("showdown_game_sessions")
    .update({
      phase: "question_value" satisfies GamePhase,
      current_index: index,
      state: state as never,
    })
    .eq("id", session.id)
    .eq("phase", fromPhase)
    .select("id");
  return Boolean(won && won.length > 0);
}

/** Opens the question at `index` (0-based within the round). */

async function openQuestion(admin: Admin, session: SessionRow, index: number, fromPhase: GamePhase) {
  const prev = readState(session);
  const cfg = roundConfig(prev);
  const isFinal = prev.round === "showdown";
  const [row, players, total] = await Promise.all([
    loadSessionQuestion(admin, session.id, prev.offset + index + 1),
    activePlayers(admin, session.room_id),
    prev.total ? Promise.resolve(prev.total) : countRoundQuestions(admin, session.id, prev.round),
  ]);
  if (!row || !row.questions) return false;
  const timerSeconds = isFinal
    ? finalTimer(index)
    : row.questions.timer_seconds || cfg.timerSeconds;
  const now = Date.now();
  const state: SessionState = {
    ...EMPTY_STATE,
    round: prev.round,
    roundName: cfg.name,
    nextRoundName: cfg.nextName,
    offset: prev.offset,
    total,
    index,
    question: toPublicQuestion(row, index + 1, timerSeconds),
    startedAt: new Date(now).toISOString(),
    closesAt: new Date(now + timerSeconds * 1000).toISOString(),
    lockedCount: 0,
    activeCount: players.length,
    ...(isFinal ? { questionValue: finalValue(index) } : {}),
    // Running totals stay hidden through The Final.
    scores: isFinal ? [] : toScoreboard(players),
  };

  const { data: won } = await admin
    .from("showdown_game_sessions")
    .update({ phase: "question_open" satisfies GamePhase, current_index: index, state: state as never })
    .eq("id", session.id)
    .eq("phase", fromPhase)
    .select("id");
  if (!won || won.length === 0) return false;
  await admin
    .from("session_questions")
    .update({ asked_at: new Date(now).toISOString() })
    .eq("id", row.id);
  return true;
}


function sameOrder(a: unknown, b: string[]) {
  return Array.isArray(a) && a.length === b.length && a.every((v, i) => String(v) === b[i]);
}

/**
 * Closes the current question, grades every answer server-side and writes the
 * reveal payload. Scores, streaks and score events are all produced here.
 */
async function gradeQuestion(admin: Admin, session: SessionRow, fromPhase: GamePhase) {
  const state = readState(session);
  if (!state.question) return false;
  const cfg = roundConfig(state);


  // Claim the transition so two devices can't double-score. The grading reads
  // are read-only and idempotent, so they fly in parallel with the claim — if
  // the claim is lost we simply throw the reads away and write nothing.
  const sqid = state.question.sessionQuestionId;
  const isMana = state.round === "mana";
  const [{ data: won }, row, players, { data: answers }, manaRiskRows] = await Promise.all([
    admin
      .from("showdown_game_sessions")
      .update({ phase: "scoring" })
      .eq("id", session.id)
      .eq("phase", fromPhase)
      .select("id"),
    loadSessionQuestion(admin, session.id, state.offset + state.index + 1),
    activePlayers(admin, session.room_id),
    admin
      .from("player_answers")
      .select("id, room_player_id, answer, response_ms")
      .eq("session_question_id", sqid),
    isMana ? riskRows(admin, sqid) : Promise.resolve([]),
  ]);
  if (!won || won.length === 0) return false;
  const q = row?.questions;
  if (!row || !q) return false;




  const format = formatOf(q);
  const options = rawOptions(q);
  const details: Record<string, string> = {};
  for (const option of options) if (option.detail) details[String(option.key)] = String(option.detail);

  const correctRaw = q.correct_answer as { key?: string; order?: string[] } | string | null;
  const rawCorrectKey =
    typeof correctRaw === "string" ? correctRaw : String(correctRaw?.key ?? "");
  // Quick As stores TRUE/FALSE in a few shapes across the bank; fold them onto
  // the two canonical keys the players actually tapped.
  const correctKey = format === "yeah_nah" ? canonicalYeahNah(rawCorrectKey) : rawCorrectKey;
  const correctOrder =
    typeof correctRaw === "object" && Array.isArray(correctRaw?.order)
      ? correctRaw!.order!.map(String)
      : [];
  const correctText =
    format === "ordering"
      ? correctOrder
          .map((key) => options.find((o) => String(o.key) === key)?.text ?? key)
          .join(" → ")
      : format === "yeah_nah"
        ? correctKey === YEAH
          ? "Yeah"
          : "Nah"
        : (options.find((o) => String(o.key) === correctKey)?.text ?? correctKey);




  const timerSeconds = q.timer_seconds || cfg.timerSeconds;
  const isFinal = state.round === "showdown";
  const isQuickie = state.round === "quickie";
  const baseValue = isFinal
    ? finalValue(state.index)
    : format === "ordering"
      ? SCORING.orderingCorrect
      : format === "yeah_nah"
        ? SCORING.yeahNahCorrect
        : SCORING.baseCorrect;
  const speedCap = format === "yeah_nah" ? SCORING.yeahNahMaxSpeed : SCORING.maxSpeedBonus;
  const results: Record<string, PlayerResult> = {};

  // Round 4: the risk each player committed to before seeing the question.
  const risks = new Map<string, { key: RiskKey; auto: boolean }>();
  const revealedRisks: Record<string, RiskKey> = {};
  for (const r of manaRiskRows) {
    const key = isRiskKey(r.risk_key) ? r.risk_key : DEFAULT_RISK;
    risks.set(r.room_player_id, { key, auto: r.auto_assigned });
    revealedRisks[r.room_player_id] = key;
  }

  // Writes are collected and flushed together — the grading itself is pure.
  const writes: PromiseLike<unknown>[] = [];
  const scoreEvents: Record<string, unknown>[] = [];
  const newScores = new Map<string, { score: number; streak: number }>();


  for (const player of players) {
    const answer = (answers ?? []).find((a) => a.room_player_id === player.id);
    const payload =
      answer && answer.answer && typeof answer.answer === "object"
        ? (answer.answer as { key?: string; order?: string[] })
        : null;
    const rawChosen = payload?.key ? String(payload.key) : null;
    // Grade the exact key the player submitted, folded onto canonical Yeah/Nah.
    const chosen = rawChosen ? (format === "yeah_nah" ? canonicalYeahNah(rawChosen) : rawChosen) : null;
    // Echo the words that were on the player's screen, so the reveal can prove
    // it recorded what they tapped.
    const chosenText = chosen
      ? format === "yeah_nah"
        ? chosen === YEAH
          ? "Yeah"
          : "Nah"
        : (options.find((o) => String(o.key) === chosen)?.text ?? chosen)
      : null;
    const submittedOrder = Array.isArray(payload?.order) ? payload!.order!.map(String) : null;
    const correct =
      format === "ordering"
        ? Boolean(submittedOrder) && correctOrder.length > 0 && sameOrder(submittedOrder, correctOrder)
        : Boolean(chosen) && chosen === correctKey;


    const responseMs = answer?.response_ms ?? null;
    const streak = nextStreak(player.streak, correct);
    const risk = isMana ? (risks.get(player.id) ?? { key: DEFAULT_RISK, auto: true }) : null;
    // Round 4 pays purely on the risk taken: no speed bonus, no Heat points.
    // Round 5 pays purely on the question's escalating value — same idea.
    // Heat streaks still track in both so they carry for stats and continuity.
    const base = risk ? manaPoints(risk.key, correct) : correct ? baseValue : 0;
    const speed =
      risk || isFinal || !correct
        ? 0
        : speedBonus(responseMs ?? timerSeconds * 1000, timerSeconds, speedCap);
    const heat = risk || isFinal ? 0 : correct ? streakBonus(streak) : 0;
    const points = base + speed + heat;


    results[player.id] = {
      chosen,
      chosenText,
      order: submittedOrder,
      correct,
      base,
      speed,
      heat,
      points,
      streak,
      responseMs,
      ...(risk ? { risk: risk.key, riskAuto: risk.auto } : {}),
    };

    // Answer-integrity audit trail: what was stored vs what was graded.
    if (process.env["NODE_ENV"] !== "production") {
      console.log(
        "[answer-audit]",
        JSON.stringify({
          q: row.sequence,
          format,
          player: player.id.slice(0, 8),
          rawChosen,
          chosen,
          chosenText,
          correctKey,
          correct,
        }),
      );
    }



    const finalScore = applyPoints(player.score, points);
    newScores.set(player.id, { score: finalScore, streak });
    writes.push(
      admin.from("room_players").update({ score: finalScore, streak }).eq("id", player.id),
    );

    if (answer) {
      writes.push(
        admin
          .from("player_answers")
          .update({ is_correct: correct, points_awarded: points })
          .eq("id", answer.id),
      );
    }
    if (points !== 0) {
      scoreEvents.push({
        session_id: session.id,
        room_player_id: player.id,
        kind: `${state.round}_answer`,
        points,
        metadata: {
          base,
          speed,
          heat,
          streak,
          question: row.sequence,
          format,
          ...(risk ? { risk: risk.key, riskAuto: risk.auto } : {}),
        },
      });
    }
  }

  // One batched insert for score events — still exactly one row per scoring
  // player, written once inside the claimed transition.
  if (scoreEvents.length) writes.push(admin.from("score_events").insert(scoreEvents as never));
  writes.push(
    admin
      .from("session_questions")
      .update({ closed_at: new Date().toISOString(), revealed: true })
      .eq("id", row.id),
  );
  await Promise.all(writes);

  const reveal: RevealPayload = {
    correctKey,
    correctText,
    ...(correctOrder.length ? { correctOrder } : {}),
    ...(Object.keys(details).length ? { details } : {}),
    explanation: q.explanation,
  };

  const now = Date.now();
  const nextState: SessionState = {
    ...state,
    lockedCount: (answers ?? []).length,
    activeCount: players.length,
    reveal,
    results,
    ...(isMana ? { risks: revealedRisks } : {}),
    // Round 4 shows who backed themselves first, then the grading.
    ...(isMana
      ? { riskRevealUntil: new Date(now + (cfg.riskRevealMs ?? 1400)).toISOString() }
      : {}),
    revealUntil: new Date(
      now +
        (isMana ? (cfg.riskRevealMs ?? 1400) : 0) +
        (format === "ordering" ? (cfg.orderingRevealMs ?? cfg.revealMs) : cfg.revealMs),

    ).toISOString(),
    // The Final keeps the overall leaderboard hidden until the game is over.
    // Built from the scores we just wrote — no extra read-back round trip.
    scores: isFinal
      ? []
      : players
          .map((p) => ({
            playerId: p.id,
            nickname: p.nickname,
            characterId: p.character_id,
            score: newScores.get(p.id)?.score ?? p.score,
            streak: newScores.get(p.id)?.streak ?? p.streak,
          }))
          .sort((a, b) => b.score - a.score),

  };


  await admin
    .from("showdown_game_sessions")
    .update({
      phase: (isMana ? "risk_reveal" : "answer_reveal") satisfies GamePhase,
      state: nextState as never,
    })
    .eq("id", session.id);
  return true;
}



async function completeRound(admin: Admin, session: SessionRow) {
  const state = readState(session);
  const { question: _q, reveal: _r, revealUntil: _ru, closesAt: _c, ...rest } = state;
  const nextState: SessionState = {
    ...rest,
    scores: await scoreboard(admin, session.room_id),
  };
  await admin
    .from("showdown_game_sessions")
    .update({ phase: "round_complete" satisfies GamePhase, state: nextState as never })
    .eq("id", session.id)
    .eq("phase", "answer_reveal");
}

/**
 * End of game. Computes the authoritative ranking, persists it with the
 * winner(s) and a completion timestamp, and parks the session in `game_over`.
 *
 * Tiebreaks, in order: score, then correct answers across the whole game, then
 * the fastest aggregate response time on those correct answers. Players still
 * level after all three genuinely share the placement — nothing is decided by
 * a coin flip, and joint champions are a supported outcome.
 */
async function completeGame(admin: Admin, session: SessionRow) {
  const state = readState(session);

  // Claim the transition so two devices can never complete the game twice.
  const { data: won } = await admin
    .from("showdown_game_sessions")
    .update({ phase: "finalising" })
    .eq("id", session.id)
    .eq("phase", "answer_reveal")
    .select("id");
  if (!won || won.length === 0) return false;

  const players = await activePlayers(admin, session.room_id);

  // Whole-game answer stats, straight from the authoritative tables.
  const { data: sqRows } = await admin
    .from("session_questions")
    .select("id")
    .eq("session_id", session.id);
  const questionIds = (sqRows ?? []).map((r) => r.id);
  const stats = new Map<string, { correct: number; ms: number }>();
  if (questionIds.length) {
    const { data: answers } = await admin
      .from("player_answers")
      .select("room_player_id, is_correct, response_ms")
      .in("session_question_id", questionIds);
    for (const a of answers ?? []) {
      if (!a.is_correct) continue;
      const current = stats.get(a.room_player_id) ?? { correct: 0, ms: 0 };
      current.correct += 1;
      current.ms += a.response_ms ?? 0;
      stats.set(a.room_player_id, current);
    }
  }

  const rows = players
    .map((p) => {
      const s = stats.get(p.id) ?? { correct: 0, ms: 0 };
      return {
        playerId: p.id,
        nickname: p.nickname,
        characterId: p.character_id,
        score: p.score,
        correctCount: s.correct,
        correctMs: s.ms,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || b.correctCount - a.correctCount || a.correctMs - b.correctMs,
    );

  const tied = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    a.score === b.score && a.correctCount === b.correctCount && a.correctMs === b.correctMs;

  const ranking: FinalPlace[] = [];
  let place = 0;
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    // Standard competition ranking: genuine ties share a place.
    place = previous && tied(previous, row) ? place : index + 1;
    ranking.push({ ...row, place, champion: false });
  });
  for (const row of ranking) row.champion = row.place === 1;

  const winners = ranking.filter((r) => r.champion);
  const solo = players.length <= 1;
  const nowIso = new Date().toISOString();
  const final: FinalSummary = {
    ranking,
    winners: winners.map((w) => w.playerId),
    winnerNames: winners.map((w) => w.nickname),
    revealStartedAt: nowIso,
    completedAt: nowIso,
    solo,
    ...(solo ? { soloLabel: soloLabel(ranking[0]?.score ?? 0) } : {}),
  };

  const { question: _q, reveal: _r, revealUntil: _ru, closesAt: _c, results: _res, ...rest } = state;
  const nextState: SessionState = {
    ...rest,
    final,
    // Everything is public now: the full leaderboard is the payoff.
    scores: ranking.map((r) => ({
      playerId: r.playerId,
      nickname: r.nickname,
      characterId: r.characterId,
      score: r.score,
      streak: 0,
    })),
  };

  await admin
    .from("showdown_game_sessions")
    .update({
      phase: "game_over" satisfies GamePhase,
      status: "complete",
      ended_at: nowIso,
      state: nextState as never,
    })
    .eq("id", session.id);
  await admin.from("rooms").update({ status: "finished" }).eq("id", session.room_id);
  await admin.from("analytics_events").insert({
    event_key: "game_completed",
    room_id: session.room_id,
    properties: {
      players: players.length,
      winners: final.winnerNames,
      topScore: ranking[0]?.score ?? 0,
    },
  });
  return true;
}


/**
 * Advances the machine if — and only if — an authoritative deadline has passed.
 * Safe to call from any device at any frequency.
 */
export async function tick(admin: Admin, code: string) {
  const ctx = await loadContext(admin, code);
  if (!ctx) return { phase: "lobby" as GamePhase };
  const { session } = ctx;
  const state = readState(session);
  const cfg = roundConfig(state);
  const now = Date.now();
  const phase = session.phase as GamePhase | "scoring";

  const isMana = state.round === "mana";
  const isFinal = state.round === "showdown";
  const isQuickie = state.round === "quickie";

  if (phase === "round_intro") {
    if (state.introUntil && now >= new Date(state.introUntil).getTime()) {
      if (isMana) await openRiskPhase(admin, session, 0, "round_intro");
      else if (isFinal) await openValueCard(admin, session, 0, "round_intro");
      else await openQuestion(admin, session, 0, "round_intro");
    }
    return { phase };
  }

  // Round 5 — the value card holds, then the question opens.
  if (phase === "question_value") {
    if (state.valueUntil && now >= new Date(state.valueUntil).getTime()) {
      await openQuestion(admin, session, state.index, "question_value");
    }
    return { phase };
  }


  // Round 4 phase A — risk selection. Closes on the deadline, or the moment
  // every eligible player has committed.
  if (phase === "risk_open") {
    const closesAt = state.riskClosesAt ? new Date(state.riskClosesAt).getTime() : 0;
    if (now >= closesAt + cfg.lateGraceMs) {
      await closeRiskPhase(admin, session, phase);
      return { phase };
    }
    const [row, players] = await Promise.all([
      currentRiskRow(admin, session, state),
      activePlayers(admin, session.room_id),
    ]);
    if (row) {
      const eligible = new Set(players.map((p) => p.id));
      const locked = new Set(
        (await riskRows(admin, row.id)).map((r) => r.room_player_id).filter((id) => eligible.has(id)),
      ).size;

      if (players.length > 0 && locked >= players.length) {
        await closeRiskPhase(admin, session, phase);
      } else if (locked !== (state.riskLockedCount ?? 0) || players.length !== state.activeCount) {
        await admin
          .from("showdown_game_sessions")
          .update({
            state: { ...state, riskLockedCount: locked, activeCount: players.length } as never,
          })
          .eq("id", session.id)
          .eq("phase", "risk_open");
      }
    }
    return { phase };
  }

  if (phase === "risk_locked") {
    const openAt = state.closesAt ? new Date(state.closesAt).getTime() : 0;
    if (openAt && now >= openAt) await openQuestion(admin, session, state.index, "risk_locked");
    return { phase };
  }

  // Round 4 — the "who backed themselves" beat before the grading lands.
  if (phase === "risk_reveal") {
    if (state.riskRevealUntil && now >= new Date(state.riskRevealUntil).getTime()) {
      await admin
        .from("showdown_game_sessions")
        .update({ phase: "answer_reveal" satisfies GamePhase })
        .eq("id", session.id)
        .eq("phase", "risk_reveal");
    }
    return { phase };
  }


  if (phase === "question_open" || phase === "question_locked") {
    const closesAt = state.closesAt ? new Date(state.closesAt).getTime() : 0;
    if (now >= closesAt + cfg.lateGraceMs) {
      await gradeQuestion(admin, session, phase);
      return { phase };
    }
    // Self-healing lock counter: recount from the answers table so the TV shows
    // the truth for any player count, and close early once everyone is in.
    if (state.question) {
      const [{ data: rows }, players] = await Promise.all([
        admin
          .from("player_answers")
          .select("room_player_id")
          .eq("session_question_id", state.question.sessionQuestionId),
        activePlayers(admin, session.room_id),
      ]);
      const eligible = new Set(players.map((p) => p.id));
      const lockedCount = new Set(
        (rows ?? []).map((r) => r.room_player_id).filter((id) => eligible.has(id)),
      ).size;
      const everyoneIn = players.length > 0 && lockedCount >= players.length;
      if (lockedCount !== state.lockedCount || players.length !== state.activeCount || everyoneIn) {
        const nextCloses = everyoneIn
          ? new Date(Math.min(closesAt, now + cfg.lockPauseMs)).toISOString()
          : state.closesAt;
        await admin
          .from("showdown_game_sessions")
          .update({
            phase: everyoneIn ? ("question_locked" satisfies GamePhase) : phase,
            state: {
              ...state,
              lockedCount,
              activeCount: players.length,
              closesAt: nextCloses,
            } as never,
          })
          .eq("id", session.id)
          .in("phase", ["question_open", "question_locked"]);
      }
    }
    return { phase };
  }

  if (phase === "answer_reveal") {
    if (state.revealUntil && now >= new Date(state.revealUntil).getTime()) {
      const total = state.total || (await countRoundQuestions(admin, session.id, state.round));
      const nextIndex = state.index + 1;
      if (nextIndex >= total) {
        // The Final ends the game outright — no round results screen.
        if (isFinal || isQuickie) await completeGame(admin, session);
        else await completeRound(admin, session);
      } else if (isMana) {
        await openRiskPhase(admin, session, nextIndex, "answer_reveal");
      } else if (isFinal) {
        await openValueCard(admin, session, nextIndex, "answer_reveal");
      } else {
        await openQuestion(admin, session, nextIndex, "answer_reveal");
      }

    }
    return { phase };
  }


  return { phase };
}

/**
 * Host-triggered round change from the Round 1 results screen.
 * Builds the next round's challenges and rolls straight into its intro.
 * Scores and Heat carry over untouched.
 */
export async function startNextRound(admin: Admin, code: string, packId: string) {
  const ctx = await loadContext(admin, code);
  if (!ctx) throw new Error("That game isn't running.");
  const { session } = ctx;
  const state = readState(session);
  if (session.phase !== "round_complete") return { ok: false as const, reason: "not_ready" };
  const cfg = roundConfig(state);
  if (!cfg.next) return { ok: false as const, reason: "no_more_rounds" };

  const { offset, total } = await createRoundQuestions(admin, session.id, packId, cfg.next);
  if (total === 0) throw new Error(`No ${ROUNDS[cfg.next].name} challenges are available yet.`);

  // Guard the transition so two host taps can't double-start.
  const { data: won } = await admin
    .from("showdown_game_sessions")
    .update({ current_round: cfg.next })
    .eq("id", session.id)
    .eq("phase", "round_complete")
    .select("id");
  if (!won || won.length === 0) return { ok: false as const, reason: "already_started" };

  await beginRoundIntro(admin, session.id, session.room_id, total, cfg.next, offset);
  return { ok: true as const, round: cfg.next };
}

/**
 * Records one answer. Rejects late answers, unknown players, duplicate
 * submissions and answers for a question that is no longer the current one.
 * The client sends only its selection — never a score, never correctness.
 */
export async function recordAnswer(
  admin: Admin,
  code: string,
  playerTokenHash: string,
  sessionQuestionId: string,
  submission: { optionKey?: string; order?: string[] },
) {
  const ctx = await loadContext(admin, code);
  if (!ctx) throw new Error("That game isn't running.");
  const { room, session } = ctx;
  const state = readState(session);
  const cfg = roundConfig(state);

  // Timing races are normal — a tap landing just as the question closes is a
  // soft rejection, not an application error.
  if (session.phase !== "question_open" && session.phase !== "question_locked") {
    return { locked: false as const, late: true as const, duplicate: false as const };
  }
  if (!state.question || state.question.sessionQuestionId !== sessionQuestionId) {
    return { locked: false as const, late: true as const, duplicate: false as const };
  }
  const closesAt = state.closesAt ? new Date(state.closesAt).getTime() : 0;
  const now = Date.now();
  if (now > closesAt + cfg.lateGraceMs) {
    return { locked: false as const, late: true as const, duplicate: false as const };
  }


  const validKeys = new Set(state.question.options.map((o) => o.key));
  let answer: { key?: string; order?: string[] };
  if (state.question.format === "ordering") {
    const order = (submission.order ?? []).map(String);
    if (order.length !== validKeys.size || new Set(order).size !== order.length) {
      throw new Error("Put all four in order first.");
    }
    if (!order.every((key) => validKeys.has(key))) throw new Error("Unknown answer.");
    answer = { order };
  } else {
    const submitted = submission.optionKey ?? "";
    // Fold Quick As onto canonical keys, then require the key to be one of the
    // options this exact question actually showed. Nothing positional is used.
    const key =
      state.question.format === "yeah_nah" && submitted ? canonicalYeahNah(submitted) : submitted;
    if (!validKeys.has(key)) throw new Error("Unknown answer.");
    answer = { key };

  }

  const [{ data: player }, players] = await Promise.all([
    admin
      .from("room_players")
      .select("id, status")
      .eq("room_id", room.id)
      .eq("player_token_hash", playerTokenHash)
      .maybeSingle(),
    activePlayers(admin, room.id),
  ]);
  if (!player || player.status === "left") throw new Error("You're not in this game.");

  const { data: existing } = await admin
    .from("player_answers")
    .select("id")
    .eq("session_question_id", sessionQuestionId)
    .eq("room_player_id", player.id)
    .maybeSingle();
  if (existing) return { locked: true as const, duplicate: true as const, late: false as const };

  const startedAt = state.startedAt ? new Date(state.startedAt).getTime() : now;
  const responseMs = Math.max(0, now - startedAt);

  const { error } = await admin.from("player_answers").insert({
    session_question_id: sessionQuestionId,
    room_player_id: player.id,
    answer: answer as never,
    response_ms: responseMs,
  });
  if (error && !error.message.includes("duplicate")) throw new Error("Couldn't lock that in.");

  // Count the rows themselves — a head/count request can come back null and we
  // must never under-report how many players are locked in.
  const { data: lockedRows } = await admin
    .from("player_answers")
    .select("room_player_id")
    .eq("session_question_id", sessionQuestionId);

  const eligible = new Set(players.map((p) => p.id));
  const lockedCount = new Set(
    (lockedRows ?? []).map((r) => r.room_player_id).filter((id) => eligible.has(id)),
  ).size;

  const everyoneIn = players.length > 0 && lockedCount >= players.length;
  const newClosesAt = everyoneIn
    ? new Date(Math.min(closesAt, now + cfg.lockPauseMs)).toISOString()
    : state.closesAt;

  await admin
    .from("showdown_game_sessions")
    .update({
      phase: everyoneIn ? ("question_locked" satisfies GamePhase) : session.phase,
      state: { ...state, lockedCount, activeCount: players.length, closesAt: newClosesAt } as never,
    })
    .eq("id", session.id)
    .in("phase", ["question_open", "question_locked"]);

  return { locked: true as const, duplicate: false as const, late: false as const };
}

/** State a reconnecting phone needs: has it answered, and what did it send? */
export async function playerSnapshot(admin: Admin, code: string, playerTokenHash: string) {
  const ctx = await loadContext(admin, code);
  if (!ctx) return null;
  const { room, session } = ctx;
  const state = readState(session);
  const { data: player } = await admin
    .from("room_players")
    .select("id, nickname, character_id, score, streak, status")
    .eq("room_id", room.id)
    .eq("player_token_hash", playerTokenHash)
    .maybeSingle();
  if (!player) return null;

  let answeredKey: string | null = null;
  let answeredOrder: string[] | null = null;
  if (state.question) {
    const { data: answer } = await admin
      .from("player_answers")
      .select("answer")
      .eq("session_question_id", state.question.sessionQuestionId)
      .eq("room_player_id", player.id)
      .maybeSingle();
    if (answer?.answer && typeof answer.answer === "object") {
      const payload = answer.answer as { key?: string; order?: string[] };
      answeredKey = payload.key ? String(payload.key) : null;
      answeredOrder = Array.isArray(payload.order) ? payload.order.map(String) : null;
    }
  }

  // Round 4: a reconnecting phone needs to know its own risk — and only its own.
  let risk: RiskKey | null = null;
  if (state.round === "mana") {
    const row = await currentRiskRow(admin, session as SessionRow, state);
    if (row) {
      const { data: mine } = await admin
        .from("player_risks")
        .select("risk_key")
        .eq("session_question_id", row.id)
        .eq("room_player_id", player.id)
        .maybeSingle();
      if (mine?.risk_key && isRiskKey(mine.risk_key)) risk = mine.risk_key;
    }
  }

  return {
    playerId: player.id,
    nickname: player.nickname,
    characterId: player.character_id,
    score: player.score,
    streak: player.streak,
    answeredKey,
    answeredOrder,
    risk,
  };

}

/**
 * Host-triggered rematch from the game-over screen.
 *
 * Same room, same players, same code — a brand new session row. Old answers,
 * risks and questions stay attached to the finished session, so nothing from
 * the last game can leak into this one, and every device follows automatically
 * because they always read the newest session for the room.
 */
export async function startRematch(admin: Admin, code: string, packId: string) {
  const ctx = await loadContext(admin, code);
  if (!ctx) throw new Error("That game isn't running.");
  const { room, session } = ctx;
  if (session.phase !== "game_over") return { ok: false as const, reason: "not_finished" };

  // Claim the rematch so two taps can't spin up two sessions.
  const { data: claimed } = await admin
    .from("showdown_game_sessions")
    .update({ status: "abandoned" })
    .eq("id", session.id)
    .eq("status", "complete")
    .select("id");
  if (!claimed || claimed.length === 0) return { ok: false as const, reason: "already_started" };

  const { data: fresh } = await admin
    .from("showdown_game_sessions")
    .insert({ room_id: room.id, game_pack_id: packId, status: "pending", phase: "lobby" })
    .select("id")
    .maybeSingle();
  if (!fresh) throw new Error("Couldn't start the rematch.");

  const startRound = await startingRoundForPack(admin, packId);
  const { offset, total } = await createRoundQuestions(admin, fresh.id, packId, startRound);
  if (total === 0) throw new Error("No challenges are available right now.");

  await admin.from("rooms").update({ status: "in_progress" }).eq("id", room.id);
  await admin
    .from("room_players")
    .update({ score: 0, streak: 0, status: "playing" })
    .eq("room_id", room.id)
    .neq("status", "left");

  await beginRoundIntro(admin, fresh.id, room.id, total, startRound, offset);
  await admin.from("analytics_events").insert({
    event_key: "rematch_started",
    room_id: room.id,
    game_pack_id: packId,
    properties: { from_session: session.id },
  });
  return { ok: true as const, code: room.code };
}
