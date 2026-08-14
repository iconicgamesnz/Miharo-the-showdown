import { useEffect, useMemo, useRef, useState } from "react";
import { BirdAvatar } from "@/components/BirdAvatar";
import { AceStage } from "@/components/AceStage";
import { KiwiAsWordmark } from "@/components/IconicLogo";
import { formatLabel, optionLabel, questionOptions } from "@/components/game/question-kinds";
import { useCountdown } from "@/hooks/useGameSession";
import { MANA_RISKS } from "@/config/rounds";

import { soundManager } from "@/lib/audio/sound-manager";
import type { GamePhase, SessionState } from "@/lib/game-engine/session-state";
import type { CharacterRow, LobbyPlayer } from "@/hooks/useRoomChannel";
import type { CharacterState } from "@/config/characters";

type Props = {
  phase: GamePhase;
  state: SessionState;
  players: LobbyPlayer[];
  characters: CharacterRow[];
  /** Player ids that pinged an accepted lock-in since the last authoritative recount. */
  pendingLockIds?: string[];
  /** Round 4: player ids that pinged a locked risk. Never says which risk. */
  pendingRiskIds?: string[];
  hostControls?: React.ReactNode;
};

const ROUND_NUMBER: Record<string, number> = {
  sweet_as: 1,
  choice_bro: 2,
  yeah_nah: 3,
  mana: 4,
  showdown: 5,
};

/** The Final's reveal beats, in ms from `final.revealStartedAt`. */
const REVEAL_LEAD_MS = 2400;
const REVEAL_STEP_MS = 2600;
const CHAMPION_HOLD_MS = 1400;

/** Re-renders on a clock. `intervalMs` of 0 parks the ticker. */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!intervalMs) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}




/** THE SHOW — 16:9 optimised game screen driven entirely by session state. */
export function TvGame({
  phase,
  state,
  players,
  characters,
  pendingLockIds,
  pendingRiskIds,
  hostControls,
}: Props) {
  const charById = useMemo(
    () => Object.fromEntries(characters.map((c) => [c.id, c])),
    [characters],
  );
  // Optimistic display only: never let the pings exceed the eligible roster, and
  // never let them drop below the authoritative count from the server recount.
  const activeCount = state.activeCount || players.length;
  const lockedDisplay = useMemo(() => {
    const eligible = new Set(players.map((p) => p.id));
    const pinged = new Set((pendingLockIds ?? []).filter((id) => eligible.has(id)));
    return Math.min(activeCount, Math.max(state.lockedCount, pinged.size));
  }, [players, pendingLockIds, state.lockedCount, activeCount]);
  const riskDisplay = useMemo(() => {
    const eligible = new Set(players.map((p) => p.id));
    const pinged = new Set((pendingRiskIds ?? []).filter((id) => eligible.has(id)));
    return Math.min(activeCount, Math.max(state.riskLockedCount ?? 0, pinged.size));
  }, [players, pendingRiskIds, state.riskLockedCount, activeCount]);
  const lastPhase = useRef<string>("");
  const lastUrgency = useRef<number>(-1);

  const deadline =
    phase === "round_intro"
      ? state.introUntil
      : phase === "answer_reveal"
        ? state.revealUntil
        : phase === "risk_open"
          ? state.riskClosesAt
          : phase === "risk_reveal"
            ? state.riskRevealUntil
            : state.closesAt;
  const remaining = useCountdown(deadline);
  const seconds = Math.ceil(remaining / 1000);
  const roundNumber = ROUND_NUMBER[state.round] ?? 1;
  const isYeahNah = state.round === "yeah_nah";
  const isMana = state.round === "mana";
  const isFinal = state.round === "showdown";
  const now = useNow(phase === "game_over" ? 200 : 0);




  useEffect(() => {
    const key = `${phase}:${state.index}`;
    if (lastPhase.current === key) return;
    lastPhase.current = key;
    if (phase === "round_intro") soundManager.playEvent("round_transition");
    if (phase === "question_open") soundManager.playEvent("question_reveal");
    if (phase === "question_locked") soundManager.playEvent("answer_lock");
    if (phase === "answer_reveal") soundManager.playEvent("correct");
    if (phase === "round_complete") soundManager.playEvent("leaderboard_move");
    if (phase === "question_value" && state.index === 0) soundManager.playEvent("showdown");
    if (phase === "game_over") soundManager.playEvent("winner_fanfare");
  }, [phase, state.index]);

  useEffect(() => {
    if (phase !== "question_open") return;
    if (seconds <= 3 && seconds > 0 && lastUrgency.current !== seconds) {
      lastUrgency.current = seconds;
      soundManager.playEvent("countdown");
    }
  }, [phase, seconds]);

  if (phase === "round_intro") {
    const [line1, line2] = state.introLines ?? [];
    // Round 4 intro has to teach the risk tiers before the first pick.
    if (isMana) {
      return (
        <section className="flex flex-1 flex-col items-center justify-center gap-[2vh] text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-neon-magenta">
            Round {roundNumber}
          </p>
          <h1 className="tv-heading uppercase leading-[1.05]">Put Your Mana Where Your Mouth Is</h1>
          <AceStage slot="pointing" size="presenter" line={line1 ?? "Alright team — time to back yourselves."} />
          <p className="tv-subheading text-muted-foreground">
            {line2 ?? "Time to put your mana where your mouth is."}
          </p>
          <div className="grid w-full max-w-6xl grid-cols-3 gap-6">
            {MANA_RISKS.map((risk) => (
              <div key={risk.key} className="panel px-6 py-5">
                <p className="font-display text-[clamp(1.4rem,3.4vh,2.4rem)] uppercase">{risk.label}</p>
                <p className="font-display text-4xl text-primary">x{risk.multiplier}</p>
                <p className="mt-2 text-neon-lime">+{risk.correct.toLocaleString()}</p>
                <p className="text-muted-foreground">
                  {risk.wrong === 0 ? "0" : risk.wrong.toLocaleString()} if you're wrong
                </p>
              </div>
            ))}
          </div>
          <p aria-live="polite" className="font-display text-3xl text-primary">
            Starting in {Math.max(1, seconds)}
          </p>
        </section>
      );
    }
    // Yeah Nah gets its own hot-start intro: the copy, then READY? 3-2-1 GO!

    if (isYeahNah) {
      const go = seconds <= 0;
      return (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-neon-magenta">
            Round {roundNumber}
          </p>
          <h1 className="tv-heading uppercase tracking-[0.1em] text-glow-cyan">Quick As ⚡</h1>
          <AceStage slot="excited" size="presenter" line={line1 ?? "Quick As. Five seconds. Trust your gut."} />
          <p className="tv-subheading text-muted-foreground">{line2}</p>
          {seconds <= 4 ? (
            <p aria-live="polite" className="font-display text-[clamp(4rem,14vh,10rem)] leading-none text-neon-lime">
              {go ? "GO!" : seconds}
            </p>
          ) : (
            <p className="font-display text-4xl tracking-[0.4em] text-primary">READY?</p>
          )}
        </section>
      );
    }
    // THE FINAL — the last standings anyone sees before the totals go dark.
    if (isFinal) {
      return (
        <section className="flex flex-1 flex-col items-center justify-center gap-[2vh] text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-neon-magenta">
            Round {roundNumber}
          </p>
          <h1 className="tv-heading uppercase tracking-[0.08em] text-glow-cyan">The Final</h1>
          <p className="tv-subheading text-muted-foreground">
            {line2 ?? "Five questions. Scores go dark until the end."}
          </p>
          <ol className="mx-auto grid w-full max-w-4xl gap-2">
            {state.scores.map((row, index) => (
              <li
                key={row.playerId}
                className={`panel flex items-center gap-4 px-5 py-3 ${index === 0 ? "panel-glow" : ""}`}
              >
                <span className="w-10 font-display text-2xl text-muted-foreground">{index + 1}</span>
                <span className="flex-1 text-left font-display text-2xl">{row.nickname}</span>
                <span className="font-display text-3xl text-primary">
                  {row.score.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
          <AceStage slot="pointing" assetOverride="/production/ace/final.webp" size="presenter" className="ace-enter" line={line1 ?? "This is it. Everything comes down to The Final."} />
          <p aria-live="polite" className="font-display text-3xl text-primary">
            Starting in {Math.max(1, seconds)}
          </p>
        </section>
      );
    }
    return (

      <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-neon-magenta">
          Round {roundNumber}
        </p>
        <h1 className="tv-heading uppercase">{state.roundName}</h1>
        <p className="tv-subheading text-muted-foreground">{line2 ?? "Here we go."}</p>
        <AceStage slot={state.round === "sweet_as" ? "excited" : "pointing"} size="presenter" line={line1 ?? state.roundName} />
        <p aria-live="polite" className="font-display text-3xl text-primary">
          Starting in {Math.max(1, seconds)}
        </p>
      </section>
    );
  }


  // THE FINAL — "QUESTION n OF 5 — WORTH x" before every question.
  if (phase === "question_value") {
    const last = state.index + 1 >= state.total;
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-neon-magenta">
          The Final
        </p>
        <h1 className="font-display text-[clamp(2.4rem,8vh,5.5rem)] uppercase tracking-[0.1em]">
          Question {state.index + 1} of {state.total}
        </h1>
        <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">Worth</p>
        <p
          aria-live="polite"
          className={`font-display leading-none text-primary text-glow-cyan ${
            last ? "text-[clamp(5rem,22vh,16rem)]" : "text-[clamp(4rem,16vh,12rem)]"
          }`}
        >
          {(state.questionValue ?? 0).toLocaleString()}
        </p>
        {last && (
          <p className="font-display text-[clamp(1.6rem,5vh,3.5rem)] uppercase text-neon-magenta">
            Last question. Everything's on the line.
          </p>
        )}
        <AceStage slot="pointing" assetOverride="/production/ace/final.webp" size="reaction" line={last ? "Last one. Make it iconic." : "Here we go."} />
      </section>
    );
  }

  // THE WINNER SEQUENCE — staged from last place up to the champion.
  if (phase === "game_over") {
    const final = state.final;
    const ranking = final?.ranking ?? [];
    const started = final ? new Date(final.revealStartedAt).getTime() : now;
    const elapsed = Math.max(0, now - started);
    const champions = ranking.filter((r) => r.champion);
    const others = ranking.filter((r) => !r.champion);
    const shown = Math.min(
      others.length,
      Math.max(0, Math.floor((elapsed - REVEAL_LEAD_MS) / REVEAL_STEP_MS)),
    );
    const championsUp =
      elapsed >= REVEAL_LEAD_MS + others.length * REVEAL_STEP_MS + CHAMPION_HOLD_MS;
    // Bottom-up: the lowest place lands first.
    const revealed = others.slice(others.length - shown);

    if (final?.solo) {
      const me = ranking[0];
      const character = me?.characterId ? charById[me.characterId] : null;
      return (
        <section className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">Final score</p>
          <p className="font-display text-[clamp(4rem,18vh,13rem)] leading-none text-primary text-glow-cyan">
            {(me?.score ?? 0).toLocaleString()}
          </p>
          <h1 className="tv-heading uppercase text-neon-lime">{final.soloLabel}</h1>
          {character && (
            <BirdAvatar
              slug={character.slug}
              name={character.name}
              accentColor={character.accent_color}
              state="winning"
              size="lg"
            />
          )}
          <AceStage
            slot="celebrating"
            size="presenter"
            line={`Congratulations ${me?.nickname ?? "champion"} — ${(me?.score ?? 0).toLocaleString()} points. THAT WAS ICONIC.`}
          />
          {hostControls}
        </section>
      );
    }

    return (
      <section className="flex flex-1 flex-col gap-[2vh] py-[1vh]">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-neon-magenta">
            <KiwiAsWordmark /> · The Final
          </p>
          <h1 className="tv-heading uppercase">
            {championsUp
              ? champions.length > 1
                ? "Joint champions!"
                : "Tonight's champion"
              : "The results…"}
          </h1>
        </header>

        <ol className="mx-auto grid w-full max-w-5xl gap-2">
          {revealed.map((row) => {
            const character = row.characterId ? charById[row.characterId] : null;
            return (
              <li key={row.playerId} className="panel flex items-center gap-5 px-6 py-3">
                <span className="w-14 font-display text-3xl text-muted-foreground">{row.place}</span>
                {character && (
                  <BirdAvatar
                    slug={character.slug}
                    name={character.name}
                    accentColor={character.accent_color}
                    state="neutral"
                    size="sm"
                  />
                )}
                <span className="flex-1 font-display text-2xl">{row.nickname}</span>
                <span className="font-display text-3xl text-primary">
                  {row.score.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ol>

        {championsUp ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-[2vh]">
            <div className="flex flex-wrap items-end justify-center gap-8">
              {champions.map((row) => {
                const character = row.characterId ? charById[row.characterId] : null;
                return (
                  <div key={row.playerId} className="panel-glow ace-reaction flex flex-col items-center gap-2 bg-background/70 px-10 py-6 backdrop-blur-sm">
                    {character && (
                      <div className="scale-125">
                      <BirdAvatar
                        slug={character.slug}
                        name={character.name}
                        accentColor={character.accent_color}
                        state="winning"
                        size="lg"
                      />
                      </div>
                    )}
                    <span className="font-display text-[clamp(2rem,7vh,4.5rem)] uppercase leading-none text-neon-lime">
                      {row.nickname}
                    </span>
                    <span className="font-display text-4xl text-primary">
                      {row.score.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="font-display text-[clamp(2rem,6vh,5rem)] uppercase tracking-[0.12em] text-neon-lime text-glow-cyan">
              THAT WAS ICONIC.
            </p>

            <AceStage
              slot="celebrating"
              size="presenter"
              line={
                champions.length > 1
                  ? `Congratulations ${champions.map((row) => row.nickname).join(" & ")} — ${(champions[0]?.score ?? 0).toLocaleString()} points. THAT WAS ICONIC.`
                  : `Congratulations ${champions[0]?.nickname ?? "champion"} — ${(champions[0]?.score ?? 0).toLocaleString()} points. THAT WAS ICONIC.`
              }
            />
            {hostControls}
          </div>
        ) : (
          <p aria-live="polite" className="mt-auto text-center tv-subheading text-muted-foreground">
            Counting down to first place…
          </p>
        )}
      </section>
    );
  }

  if (phase === "round_complete") {

    return (
      <section className="flex flex-1 flex-col gap-6 py-4">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-neon-magenta">
            Round {roundNumber}
          </p>
          <h1 className="tv-heading uppercase">{state.roundName} — Results</h1>
        </header>
        <ol className="mx-auto grid w-full max-w-5xl gap-3">
          {state.scores.map((row, index) => {
            const character = row.characterId ? charById[row.characterId] : null;
            return (
              <li
                key={row.playerId}
                className={`panel flex items-center gap-5 px-6 py-4 ${index === 0 ? "panel-glow" : ""}`}
              >
                <span className="w-12 font-display text-3xl text-muted-foreground">{index + 1}</span>
                {character && (
                  <BirdAvatar
                    slug={character.slug}
                    name={character.name}
                    accentColor={character.accent_color}
                    state={index === 0 ? "winning" : "neutral"}
                    size="md"
                  />
                )}
                <span className="flex-1 font-display text-3xl">{row.nickname}</span>
                {row.streak >= 2 && (
                  <span className="rounded-full border border-border px-3 py-1 text-sm text-neon-magenta">
                    🔥 {row.streak}
                  </span>
                )}
                <span className="font-display text-4xl text-primary">{row.score.toLocaleString()}</span>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-col items-center gap-4">
          <AceStage slot="excited" size="reaction" line={state.round === "sweet_as" ? "Not bad." : "Choice."} />
          <p className="text-muted-foreground">
            {state.nextRoundName
              ? `${state.nextRoundName} — coming next.`
              : "That's all that's built so far."}
          </p>
          {hostControls}
        </div>
      </section>
    );
  }

  // ROUND 4 PHASE A — risks are picked blind. The TV never shows who picked what.
  if (phase === "risk_open" || phase === "risk_locked") {
    const waiting = phase === "risk_locked";
    return (
      <section className="flex flex-1 flex-col gap-[2vh] py-[1vh]">
        <header className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-neon-magenta">
              <KiwiAsWordmark /> · Put your mana where your mouth is
            </p>
            <p className="font-display text-2xl tracking-widest text-muted-foreground">
              QUESTION {state.index + 1} OF {state.total}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Risks locked</p>
              <p aria-live="polite" className="font-display text-3xl">
                {riskDisplay} / {activeCount}
              </p>
            </div>
            {!waiting && (
              <div
                className={`grid size-[clamp(5rem,11vh,8rem)] place-items-center rounded-full border-8 transition ${
                  seconds <= 3 ? "scale-110 border-neon-magenta text-neon-magenta" : "border-primary text-primary"
                }`}
                role="timer"
              >
                <span className="font-display text-[clamp(2.4rem,6vh,4.5rem)] leading-none">{seconds}</span>
              </div>
            )}
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
          <h1 className="tv-heading uppercase">
            {waiting ? "Risks are in" : "Back yourself. Pick your risk."}
          </h1>
          <div className="grid w-full max-w-6xl grid-cols-3 gap-6">
            {MANA_RISKS.map((risk) => (
              <div key={risk.key} className="panel px-6 py-6">
                <p className="font-display text-[clamp(1.4rem,3.6vh,2.6rem)] uppercase">{risk.label}</p>
                <p className="font-display text-5xl text-primary">x{risk.multiplier}</p>
                <p className="mt-3 font-display text-2xl text-neon-lime">
                  +{risk.correct.toLocaleString()}
                </p>
                <p className="font-display text-2xl text-muted-foreground">
                  {risk.wrong === 0 ? "0" : risk.wrong.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <p className="tv-subheading text-muted-foreground">
            {waiting ? "Question incoming…" : "No takebacks. Pick before you see the question."}
          </p>
        </div>
      </section>
    );
  }

  // ROUND 4 — a short beat showing who backed themselves, before grading.
  if (phase === "risk_reveal") {
    const risks = state.risks ?? {};
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
        <h1 className="tv-heading uppercase text-glow-cyan">Who backed themselves?</h1>
        <ul className="flex flex-wrap justify-center gap-6">
          {players.map((player) => {
            const character = player.character_id ? charById[player.character_id] : null;
            const risk = MANA_RISKS.find((r) => r.key === risks[player.id]) ?? MANA_RISKS[0];
            return (
              <li key={player.id} className="panel flex flex-col items-center gap-2 px-6 py-4">
                {character && (
                  <BirdAvatar
                    slug={character.slug}
                    name={character.name}
                    accentColor={character.accent_color}
                    state="neutral"
                    size="md"
                  />
                )}
                <span className="font-display text-2xl">{player.nickname}</span>
                <span className="font-display text-xl uppercase text-primary">
                  {risk?.label} x{risk?.multiplier}
                </span>
              </li>
            );
          })}
        </ul>
        <AceStage slot="excited" size="reaction" line="Risks are locked. Let’s see who backed themselves." />
      </section>
    );
  }


  const question = state.question;
  if (!question) {
    return (
      <section className="grid flex-1 place-items-center">
        <p className="tv-subheading text-muted-foreground">Getting the next one ready…</p>
      </section>
    );
  }

  const options = questionOptions(question);
  const revealing = phase === "answer_reveal";
  const correctKey = state.reveal?.correctKey;
  const correctOrder = state.reveal?.correctOrder ?? [];
  const details = state.reveal?.details ?? {};
  const ordering = question.format === "ordering";
  const binary = question.format === "which_came_first";

  const yeahNah = question.format === "yeah_nah";

  // Ace's read on the room, derived from the graded results.
  const graded = revealing ? Object.values(state.results ?? {}) : [];
  const correctCount = graded.filter((r) => r.correct).length;
  const bigStreak = graded.some((r) => r.correct && r.streak >= 3);
  const aceLine = !revealing
    ? undefined
    : graded.length === 0
      ? "Nobody? Bold."
      : correctCount === 0
        ? yeahNah
          ? "Yeah… nah."
          : "Yeah… that went well."
        : correctCount === graded.length
          ? "Too easy!"
          : correctCount === 1
            ? yeahNah
              ? "One of you actually knew that."
              : "One genius. The rest of you… questionable."
            : bigStreak
              ? "Someone's absolutely flying."
              : "Some of you were paying attention.";

  // Ace's reaction pose. Shocked is rationed so it stays funny: it only comes
  // out when the room got wiped out, never after every individual wrong answer.
  const aceSlot: "excited" | "shocked" | "pointing" =
    !revealing || graded.length === 0
      ? "pointing"
      : correctCount === 0
        ? "shocked"
        : correctCount === graded.length || bigStreak
          ? "excited"
          : "pointing";

  // Ordering reveals animate into the authoritative sequence.
  const displayOptions = ordering && revealing && correctOrder.length
    ? correctOrder.map((key) => options.find((o) => o.key === key)).filter(Boolean).map((o) => o!)
    : options;

  const playerStrip = (
    <ul className="flex flex-wrap gap-4">
      {players.map((player) => {
        const character = player.character_id ? charById[player.character_id] : null;
        const result = revealing ? state.results?.[player.id] : undefined;
        const lost = Boolean(result) && (result?.points ?? 0) < 0;
        const reaction: CharacterState = result
          ? result.correct
            ? "winning"
            : lost
              ? "shocked"
              : "defeated"
          : "neutral";
        const score = state.scores.find((s) => s.playerId === player.id)?.score ?? player.score;
        const manaRisk = isMana && result ? MANA_RISKS.find((r) => r.key === result.risk) : null;
        return (
          <li key={player.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
            {character && (
              <BirdAvatar
                slug={character.slug}
                name={character.name}
                accentColor={character.accent_color}
                state={reaction}
                size="sm"
              />
            )}
            <span>
              <span className="block font-display text-lg leading-tight">{player.nickname}</span>
              <span className="block text-sm text-primary">{score.toLocaleString()}</span>
              {manaRisk && (
                <span className="block text-xs uppercase tracking-widest text-muted-foreground">
                  {manaRisk.label} x{manaRisk.multiplier}
                </span>
              )}
            </span>
            {result && (
              <span
                className={`font-display text-lg ${
                  result.correct ? "text-neon-lime" : lost ? "text-neon-magenta" : "text-muted-foreground"
                }`}
              >
                {isMana
                  ? result.points > 0
                    ? `+${result.points.toLocaleString()}`
                    : result.points.toLocaleString()
                  : result.correct
                    ? `+${result.points.toLocaleString()}`
                    : "—"}
              </span>
            )}
          </li>
        );

      })}
    </ul>
  );

  // YEAH NAH — its own presentation. One huge statement, two verdict plates,
  // and a reveal that lands instantly rather than reading like a quiz grid.
  if (yeahNah) {
    const urgent = !revealing && seconds <= 2;
    const correctIsYeah = correctKey === "yeah";
    return (
      <section className="flex flex-1 flex-col gap-[2vh] py-[1vh]">
        <header className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-neon-magenta">
              <KiwiAsWordmark /> · Quick As ⚡ · {question.category ?? "Random As"}
            </p>
            <p className="font-display text-2xl tracking-widest text-muted-foreground">
              {question.category?.toUpperCase() ?? "RANDOM AS"} · QUESTION {question.number} OF {state.total}
            </p>
          </div>
          {!revealing ? (
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Locked in</p>
                <p aria-live="polite" className="font-display text-3xl">
                  {lockedDisplay} / {activeCount}
                </p>
              </div>
              <div
                className={`grid size-[clamp(5rem,11vh,8rem)] place-items-center rounded-full border-8 transition ${
                  urgent
                    ? "scale-110 border-neon-magenta text-neon-magenta"
                    : "border-primary text-primary"
                }`}
                role="timer"
                aria-live="off"
              >
                <span className="font-display text-[clamp(2.4rem,6vh,4.5rem)] leading-none">{seconds}</span>
              </div>
            </div>
          ) : (
            <p className="font-display text-3xl text-neon-lime">VERDICT</p>
          )}
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">
          <p className="text-balance font-display text-[clamp(2rem,7.5vh,5.5rem)] uppercase leading-[1.05]">
            {question.text}
          </p>

          {!revealing ? (
            <div className="grid w-full max-w-5xl grid-cols-2 gap-6">
              <Verdict symbol="👍" word="YEAH" hint="Reckon it's true" tone="primary" />
              <Verdict symbol="👎" word="NAH" hint="Reckon it's rubbish" tone="magenta" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-[clamp(3rem,12vh,8rem)] leading-none text-neon-lime">
                {correctIsYeah ? "YEAH! 👍" : "NAH! 👎"}
              </p>
              <p className="font-display text-3xl uppercase tracking-[0.4em] text-muted-foreground">
                {correctIsYeah ? "True" : "False"}
              </p>
              {state.reveal?.explanation && (
                <p className="tv-subheading max-w-4xl text-muted-foreground">{state.reveal.explanation}</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-6">
          {playerStrip}
          <AceStage
            slot={revealing ? aceSlot : "pointing"}
            size="reaction"
            {...(revealing && aceLine ? { line: aceLine } : {})}
            className="flex shrink-0"
          />
        </div>
      </section>
    );
  }


  return (
    <section className="flex flex-1 flex-col gap-[2vh] py-[1vh]">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-neon-magenta">
            <KiwiAsWordmark /> · {state.roundName} · {formatLabel(question.format)}
          </p>
          <p className="font-display text-2xl tracking-widest text-muted-foreground">
            {question.category?.toUpperCase() ?? "RANDOM AS"} · QUESTION {question.number} OF {state.total}
          </p>
        </div>
        {!revealing ? (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Locked in</p>
              <p aria-live="polite" className="font-display text-3xl">
                {lockedDisplay} / {activeCount}
              </p>
            </div>
            <div
              className={`grid size-[clamp(4.5rem,9vh,7rem)] place-items-center rounded-2xl border-4 ${
                seconds <= 3 ? "border-neon-magenta text-neon-magenta" : "border-primary text-primary"
              }`}
              role="timer"
              aria-live="off"
            >
              <span className="font-display text-[clamp(2rem,4.5vh,3.5rem)] leading-none">{seconds}</span>
            </div>
          </div>
        ) : (
          <p className="font-display text-2xl text-neon-lime">ANSWER</p>
        )}
      </header>

      <h1 className="text-balance font-display text-[clamp(1.8rem,5vh,4rem)] leading-tight">
        {question.text}
      </h1>

      {ordering && !revealing && (
        <p className="tv-subheading text-muted-foreground">
          Four to sort — arrange them on your phone, then LOCK IT IN.
        </p>
      )}

      <ul className={`grid gap-3 ${binary ? "md:grid-cols-2" : ordering ? "" : "md:grid-cols-2"}`}>
        {displayOptions.map((option, index) => {
          const isCorrect = revealing && !ordering && option.key === correctKey;
          const detail = revealing ? details[option.key] : undefined;
          const earlier = revealing && binary && option.key === correctKey;
          return (
            <li
              key={option.key}
              className={`panel flex items-center gap-4 transition duration-500 ${
                binary ? "flex-col justify-center px-6 py-8 text-center" : "px-5 py-4"
              } ${
                isCorrect
                  ? "border-neon-lime bg-secondary shadow-[0_0_40px_rgba(0,0,0,0.35)]"
                  : revealing && !ordering
                    ? "opacity-40"
                    : ""
              } ${ordering && revealing ? "border-neon-lime" : ""}`}
            >
              {!binary && (
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border font-display text-xl">
                  {ordering ? index + 1 : optionLabel(index)}
                </span>
              )}
              <span className={`font-display ${binary ? "text-[clamp(1.4rem,3.4vh,2.4rem)]" : "text-[clamp(1rem,2.6vh,1.9rem)]"}`}>
                {option.text}
              </span>
              {detail && <span className="font-display text-xl text-primary">{detail}</span>}
              {earlier && <span className="font-display text-xl text-neon-lime">⏪ FIRST</span>}
              {isCorrect && !binary && (
                <span className="ml-auto font-display text-2xl text-neon-lime">✅ CORRECT</span>
              )}
            </li>
          );
        })}
      </ul>

      {revealing && ordering && (
        <p className="font-display text-xl text-neon-lime">✅ That's the correct order</p>
      )}

      {revealing && state.reveal?.explanation && (
        <p className="tv-subheading text-muted-foreground">{state.reveal.explanation}</p>
      )}

      <div className="mt-auto flex items-end justify-between gap-6">
        {playerStrip}
        <AceStage
          slot={revealing ? aceSlot : "pointing"}
          size="reaction"
          {...(revealing && aceLine ? { line: aceLine } : {})}
          className="flex shrink-0"
        />
      </div>
    </section>
  );
}

/**
 * A Yeah Nah verdict plate. Deliberately not a generic green/red quiz button:
 * each side carries its own symbol, word and hint so colour is never the only
 * cue, and the two plates read from across the room.
 */
function Verdict({
  symbol,
  word,
  hint,
  tone,
}: {
  symbol: string;
  word: string;
  hint: string;
  tone: "primary" | "magenta";
}) {
  const accent = tone === "primary" ? "border-primary text-primary" : "border-neon-magenta text-neon-magenta";
  return (
    <div className={`panel flex flex-col items-center gap-2 border-4 py-[3vh] ${accent}`}>
      <span aria-hidden="true" className="text-[clamp(2.5rem,7vh,5rem)] leading-none">
        {symbol}
      </span>
      <span className="font-display text-[clamp(2rem,6vh,4.5rem)] uppercase leading-none tracking-[0.15em]">
        {word}?
      </span>
      <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{hint}</span>
    </div>
  );
}

