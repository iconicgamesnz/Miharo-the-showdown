import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BirdAvatar } from "@/components/BirdAvatar";
import { OrderingControl } from "@/components/game/controls/OrderingControl";
import { formatLabel, optionLabel, questionOptions } from "@/components/game/question-kinds";
import { announceLock, announceRisk, prewarmLocks, useCountdown } from "@/hooks/useGameSession";
import { soundManager } from "@/lib/audio/sound-manager";
import { submitAnswer, submitRisk, getPlayerSnapshot } from "@/lib/game.functions";
import { aceArt } from "@/config/character-art";
import { MANA_RISKS } from "@/config/rounds";
import type { GamePhase, RiskKey, SessionState } from "@/lib/game-engine/session-state";
import type { CharacterRow } from "@/hooks/useRoomChannel";

type Props = {
  code: string;
  playerToken: string;
  playerId: string | null;
  phase: GamePhase;
  state: SessionState;
  characters: CharacterRow[];
  characterId: string | null;
  nickname: string;
  /** Host-only actions (Play again / Home), rendered on the game-over screen. */
  hostControls?: React.ReactNode;
};


type Locked = { key?: string; order?: string[] } | null;

const RISK_COPY: Record<RiskKey, { blurb: string; tone: string }> = {
  shell_be_right: { blurb: "Play it safe. Wrong costs you nothing.", tone: "border-primary text-primary" },
  hard_out: { blurb: "Double or drop a grand.", tone: "border-neon-lime text-neon-lime" },
  send_it: { blurb: "Triple up — or lose two grand.", tone: "border-neon-magenta text-neon-magenta" },
};

function riskDef(key: RiskKey | null | undefined) {
  return MANA_RISKS.find((r) => r.key === key) ?? null;
}


/**
 * Phone controller during gameplay. One reusable renderer for every challenge
 * format — the control is chosen from `question.format`, never from the round.
 * A refresh mid-question restores exactly where the player was, including
 * whether their answer is already locked.
 */
export function PhoneGame({
  code,
  playerToken,
  playerId,
  phase,
  state,
  characters,
  characterId,
  nickname,
  hostControls,
}: Props) {

  const send = useServerFn(submitAnswer);
  const sendRisk = useServerFn(submitRisk);
  const snapshot = useServerFn(getPlayerSnapshot);
  const [locked, setLocked] = useState<Locked>(null);
  const [busy, setBusy] = useState(false);
  const [myRisk, setMyRisk] = useState<RiskKey | null>(null);
  const [riskBusy, setRiskBusy] = useState(false);
  const questionId = state.question?.sessionQuestionId ?? null;
  const lastQuestion = useRef<string | null>(null);
  const isMana = state.round === "mana";
  const isFinal = state.round === "showdown";
  const riskSlot = `${state.round}:${state.index}`;
  const lastRiskSlot = useRef<string>("");

  const character = useMemo(
    () => characters.find((c) => c.id === characterId) ?? null,
    [characters, characterId],
  );

  // Reconnect / new-question sync: ask the server what we already submitted.
  useEffect(() => {
    if (!questionId) {
      setLocked(null);
      return;
    }
    if (lastQuestion.current === questionId) return;
    lastQuestion.current = questionId;
    setLocked(null);
    void snapshot({ data: { code, playerToken } })
      .then((snap) => {
        if (!snap) return;
        if (snap.answeredOrder?.length) setLocked({ order: snap.answeredOrder });
        else if (snap.answeredKey) setLocked({ key: snap.answeredKey });
        if (snap.risk) setMyRisk(snap.risk);
      })
      .catch(() => undefined);
  }, [questionId, code, playerToken, snapshot]);

  // Round 4: restore (or clear) my risk whenever a new risk phase opens.
  useEffect(() => {
    if (!isMana) return;
    if (lastRiskSlot.current === riskSlot) return;
    lastRiskSlot.current = riskSlot;
    setMyRisk(null);
    void snapshot({ data: { code, playerToken } })
      .then((snap) => {
        if (snap?.risk) setMyRisk(snap.risk);
      })
      .catch(() => undefined);
  }, [isMana, riskSlot, code, playerToken, snapshot]);

  useEffect(() => {
    prewarmLocks(code);
  }, [code]);

  const remaining = useCountdown(
    phase === "answer_reveal"
      ? state.revealUntil
      : phase === "risk_open"
        ? state.riskClosesAt
        : state.closesAt,
  );
  const seconds = Math.ceil(remaining / 1000);
  const result = playerId ? state.results?.[playerId] : undefined;
  const myScore = state.scores.find((s) => s.playerId === playerId);

  async function lockIn(payload: { optionKey?: string; order?: string[] }) {
    if (locked || busy || !questionId) return;
    setBusy(true);
    setLocked(payload.order ? { order: payload.order } : payload.optionKey ? { key: payload.optionKey } : {});
    // Paint the TV counter now; the server recount confirms or corrects it.
    if (playerId) void announceLock(code, questionId, playerId);
    try {
      const res = await send({ data: { code, playerToken, sessionQuestionId: questionId, ...payload } });
      if (res && res.locked === false) {
        // The question closed under us — roll the tap back and say so, rather
        // than leaving a tap that looks locked but was never recorded.
        setLocked(null);
        if (playerId) void announceLock(code, questionId, playerId, false);
        if (res.late) toast.message("Just missed it — that one closed.");

      } else {
        soundManager.playEvent("answer_lock");
      }
    } catch (error) {
      setLocked(null);
      if (playerId) void announceLock(code, questionId, playerId, false);
      toast.error(error instanceof Error ? error.message : "Couldn't lock that in.");
    } finally {
      setBusy(false);
    }

  }

  /** Round 4: a risk is permanent the moment it's accepted. */
  async function lockRisk(key: RiskKey) {
    if (myRisk || riskBusy) return;
    setRiskBusy(true);
    setMyRisk(key);
    if (playerId) void announceRisk(code, riskSlot, playerId);
    try {
      await sendRisk({ data: { code, playerToken, riskKey: key } });
      soundManager.playEvent("answer_lock");
    } catch (error) {
      setMyRisk(null);
      if (playerId) void announceRisk(code, riskSlot, playerId, false);
      toast.error(error instanceof Error ? error.message : "Couldn't lock that risk in.");
    } finally {
      setRiskBusy(false);
    }
  }

  if (phase === "round_intro") {
    if (isMana) {
      return (
        <Panel>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Round 4</p>
          <h1 className="mt-1 font-display text-3xl uppercase leading-tight">
            Put Your Mana Where Your Mouth Is
          </h1>
          <p className="mt-3 font-display text-xl text-neon-magenta">Back yourself.</p>
          <ul className="mt-4 grid gap-2 text-left text-sm">
            {MANA_RISKS.map((risk) => (
              <li key={risk.key} className="rounded-xl border border-border px-3 py-2">
                <span className="font-display text-base">
                  {risk.label} <span className="text-primary">x{risk.multiplier}</span>
                </span>
                <span className="block text-muted-foreground">
                  Right +{risk.correct.toLocaleString()} · Wrong{" "}
                  {risk.wrong === 0 ? "0" : risk.wrong.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
          <AcePeek slot="pointing" />
        </Panel>
      );
    }
    if (state.round === "yeah_nah") {
      return (
        <Panel>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Round 3</p>
          <h1 className="mt-1 font-display text-5xl uppercase">Quick As ⚡</h1>
          <p className="mt-3 font-display text-2xl text-neon-magenta">Trust your gut.</p>
          <p className="mt-2 text-muted-foreground">Eyes on the big screen.</p>
          <AcePeek slot="excited" />
        </Panel>
      );
    }
    if (isFinal) {
      return (
        <Panel>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Round 5</p>
          <h1 className="mt-1 font-display text-5xl uppercase">The Final</h1>
          <p className="mt-3 font-display text-2xl text-neon-magenta">It's all on the line.</p>
          <p className="mt-2 text-muted-foreground">
            Five questions, worth more every time. Totals stay hidden until the end.
          </p>
          <AcePeek slot="pointing" />
        </Panel>
      );
    }
    return (

      <Panel>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {state.round === "quickie" ? "Quickie" : state.round === "sweet_as" ? "Round 1" : "Round 2"}
        </p>
        <h1 className="mt-1 font-display text-4xl uppercase">{state.roundName}</h1>
        <p className="mt-3 text-muted-foreground">Eyes on the big screen — here we go.</p>
      </Panel>
    );

  }

  // ROUND 4 PHASE A — pick your risk before the question exists.
  if (phase === "risk_open" || phase === "risk_locked") {
    const chosen = riskDef(myRisk);
    return (
      <div className="flex w-full flex-1 flex-col">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Mana · {state.index + 1} of {state.total}
          </p>
          {phase === "risk_open" && (
            <p className={`font-display text-3xl ${seconds <= 3 ? "text-neon-magenta" : ""}`} role="timer">
              {seconds}
            </p>
          )}
        </div>
        <h1 className="mt-3 font-display text-2xl uppercase leading-tight">
          {myRisk ? "Risk locked" : "Back yourself"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {myRisk ? "No takebacks. Question's coming." : "Pick before you see the question."}
        </p>

        <div className="mt-4 grid gap-3">
          {MANA_RISKS.map((risk) => {
            const mine = myRisk === risk.key;
            const copy = RISK_COPY[risk.key];
            return (
              <button
                key={risk.key}
                onClick={() => void lockRisk(risk.key)}
                disabled={Boolean(myRisk) || riskBusy || phase === "risk_locked"}
                aria-pressed={mine}
                className={`flex min-h-24 w-full flex-col items-start justify-center rounded-2xl border-4 px-4 py-3 text-left transition disabled:opacity-40 ${
                  mine ? "border-primary bg-secondary" : copy.tone
                }`}
              >
                <span className="font-display text-2xl uppercase">
                  {risk.label} <span className="text-base">x{risk.multiplier}</span>
                </span>
                <span className="text-xs text-muted-foreground">{copy.blurb}</span>
                <span className="mt-1 font-display text-sm">
                  +{risk.correct.toLocaleString()} / {risk.wrong === 0 ? "0" : risk.wrong.toLocaleString()}
                </span>
                {mine && <span className="mt-1 text-xs uppercase tracking-widest text-primary">Locked 🔒</span>}
              </button>
            );
          })}
        </div>

        <p aria-live="polite" className="mt-5 text-center font-display text-xl">
          {chosen ? `${chosen.label.toUpperCase()} x${chosen.multiplier} 🔒` : "Choose your risk."}
        </p>
      </div>
    );
  }

  // ROUND 4 — the beat where risks are shown before the answer lands.
  if (phase === "risk_reveal") {
    const chosen = riskDef(result?.risk ?? myRisk);
    return (
      <Panel>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Risks in</p>
        <h1 className="mt-2 font-display text-4xl uppercase">
          {chosen ? `${chosen.label} x${chosen.multiplier}` : "She'll Be Right x1"}
        </h1>
        <p className="mt-3 text-muted-foreground">Let's see how that went…</p>
      </Panel>
    );
  }




  // THE FINAL — the value card beat. Nothing to tap yet.
  if (phase === "question_value") {
    const last = state.index + 1 >= state.total;
    return (
      <Panel>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          The Final · {state.index + 1} of {state.total}
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">Worth</p>
        <h1 className="font-display text-6xl text-primary">
          {(state.questionValue ?? 0).toLocaleString()}
        </h1>
        <p className="mt-4 font-display text-xl">
          {last ? "Last one. Everything's on the line." : "Get ready…"}
        </p>
      </Panel>
    );
  }

  // GAME OVER — personal placement, then the champion celebration.
  if (phase === "game_over") {
    const final = state.final;
    const me = final?.ranking.find((r) => r.playerId === playerId);
    const champion = Boolean(me?.champion);
    const joint = (final?.winners.length ?? 0) > 1;
    return (
      <Panel>
        {final?.solo ? (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Final score</p>
            <h1 className="mt-1 font-display text-6xl text-primary">
              {(me?.score ?? 0).toLocaleString()}
            </h1>
            <p className="mt-2 font-display text-3xl text-neon-lime">{final.soloLabel}</p>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {champion ? (joint ? "Joint champion" : "Champion") : "You finished"}
            </p>
            <h1 className={`mt-1 font-display text-6xl ${champion ? "text-neon-lime" : ""}`}>
              {champion ? "🏆" : `#${me?.place ?? "-"}`}
            </h1>
            <p className="mt-2 font-display text-3xl text-primary">
              {(me?.score ?? 0).toLocaleString()}
            </p>
            {!champion && final?.winnerNames.length ? (
              <p className="mt-2 text-muted-foreground">
                {final.winnerNames.join(" & ")} took it out.
              </p>
            ) : null}
          </>
        )}
        {character && (
          <BirdAvatar
            slug={character.slug}
            name={character.name}
            accentColor={character.accent_color}
            state={champion || final?.solo ? "winning" : "neutral"}
            size="lg"
            className="mt-5"
          />
        )}
        <p className="mt-4 text-muted-foreground">
          {champion ? `Absolutely iconic, ${nickname}.` : `Good on ya, ${nickname}.`}
        </p>
        {hostControls && <div className="mt-6 w-full">{hostControls}</div>}
      </Panel>
    );
  }

  if (phase === "round_complete") {

    const rank = state.scores.findIndex((s) => s.playerId === playerId) + 1;
    return (
      <Panel>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {state.roundName} — results
        </p>
        <h1 className="mt-1 font-display text-4xl">
          {rank > 0 ? `#${rank}` : "Done"} · {myScore?.score.toLocaleString() ?? 0}
        </h1>
        {character && (
          <BirdAvatar
            slug={character.slug}
            name={character.name}
            accentColor={character.accent_color}
            state={rank === 1 ? "winning" : "neutral"}
            size="lg"
            className="mt-4"
          />
        )}
        <p className="mt-4 text-muted-foreground">
          {state.nextRoundName
            ? `${state.nextRoundName} coming next — hang tight, ${nickname}.`
            : `That's a wrap for now, ${nickname}.`}
        </p>
        {hostControls && <div className="mt-6 w-full">{hostControls}</div>}
      </Panel>
    );
  }

  if (phase === "answer_reveal") {
    const correctText = state.reveal?.correctText;
    // ROUND 4 — the outcome is all about the bet, and it can be negative.
    if (isMana) {
      const chosen = riskDef(result?.risk ?? myRisk);
      const delta = result?.points ?? 0;
      const win = Boolean(result?.correct);
      return (
        <Panel>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {chosen ? `${chosen.label} x${chosen.multiplier}` : "She'll Be Right x1"}
            {result?.riskAuto ? " · auto" : ""}
          </p>
          <h1 className={`mt-2 font-display text-4xl ${win ? "text-neon-lime" : "text-neon-magenta"}`}>
            {win ? "BACKED IT! ✅" : "OUCH ❌"}
          </h1>
          <p className={`mt-2 font-display text-5xl ${delta < 0 ? "text-neon-magenta" : ""}`}>
            {delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()}
          </p>
          <YouSaid text={result?.chosenText ?? null} />
          {!win && (
            <p className="mt-2 text-sm">
              Answer was <span className="font-display text-neon-lime">{correctText}</span>
            </p>
          )}

          {character && (
            <BirdAvatar
              slug={character.slug}
              name={character.name}
              accentColor={character.accent_color}
              state={win ? "winning" : delta < 0 ? "shocked" : "defeated"}
              size="lg"
              className="mt-5"
            />
          )}
          <p className="mt-5 text-sm text-muted-foreground">
            Total {(myScore?.score ?? 0).toLocaleString()} · next up in {Math.max(1, seconds)}
          </p>
        </Panel>
      );
    }
    // Yeah Nah reveals are a 3-second beat: one verdict, one number, no reading.

    if (state.round === "yeah_nah") {
      return (
        <Panel>
          <h1 className={`font-display text-5xl ${result?.correct ? "text-neon-lime" : "text-muted-foreground"}`}>
            {result?.correct ? "CHOICE! ✅" : "NOT THIS TIME ❌"}
          </h1>
          <p className="mt-2 font-display text-3xl">
            {result?.correct ? `+${result.points.toLocaleString()}` : "+0"}
          </p>
          <YouSaid text={result?.chosenText} />
          <p className="mt-1 text-sm text-muted-foreground">
            Answer was <span className="text-neon-lime">{correctText}</span>
          </p>
          {result && result.streak >= 2 && (
            <p className="mt-2 text-neon-magenta">🔥 {result.streak} in a row</p>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            Total {(myScore?.score ?? 0).toLocaleString()}
          </p>
        </Panel>
      );
    }
    // The Final: the points are the story, and running totals stay hidden.
    if (isFinal) {
      const win = Boolean(result?.correct);
      return (
        <Panel>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Question {state.index + 1} of {state.total} · worth{" "}
            {(state.questionValue ?? 0).toLocaleString()}
          </p>
          <h1 className={`mt-2 font-display text-5xl ${win ? "text-neon-lime" : "text-muted-foreground"}`}>
            {win ? "CHOICE! ✅" : "NOT THIS TIME ❌"}
          </h1>
          <p className="mt-2 font-display text-4xl">
            {win ? `+${(result?.points ?? 0).toLocaleString()}` : "+0"}
          </p>
          <YouSaid text={result?.chosenText} />
          {!win && correctText && (

            <p className="mt-2 text-sm">
              Answer was <span className="font-display text-neon-lime">{correctText}</span>
            </p>
          )}
          {character && (
            <BirdAvatar
              slug={character.slug}
              name={character.name}
              accentColor={character.accent_color}
              state={win ? "winning" : "defeated"}
              size="lg"
              className="mt-5"
            />
          )}
          <p className="mt-4 text-sm text-muted-foreground">Totals stay hidden till the end.</p>
        </Panel>
      );
    }
    // Ordering reveals read as a numbered sequence, not a run-on arrow string.

    const correctOrder = state.reveal?.correctOrder ?? [];
    const orderTexts = correctOrder.length
      ? correctOrder.map(
          (key) => state.question?.options.find((o) => o.key === key)?.text ?? key,
        )
      : null;

    return (
      <Panel>
        {result?.correct ? (
          <>
            <h1 className="font-display text-4xl text-neon-lime">CHOICE! ✅</h1>
            <p className="mt-3 font-display text-3xl">+{result.points.toLocaleString()} points</p>
            <YouSaid text={result.chosenText} />
            <p className="mt-1 text-sm text-muted-foreground">
              Base {result.base.toLocaleString()} · Speed +{result.speed} · Heat +{result.heat}
            </p>
            {result.streak >= 2 && (
              <p className="mt-2 text-neon-magenta">🔥 {result.streak}-answer streak</p>
            )}
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl text-muted-foreground">NOT THIS TIME ❌</h1>
            <YouSaid text={result?.chosenText} />

            {orderTexts ? (
              <div className="mt-3 text-left">
                <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
                  Correct order
                </p>
                <ol className="mt-2 grid gap-1">
                  {orderTexts.map((text, index) => (
                    <li key={text} className="font-display text-lg text-neon-lime">
                      {index + 1}. {text}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="mt-3">
                Correct answer: <span className="font-display text-xl text-neon-lime">{correctText}</span>
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">Streak reset.</p>
          </>
        )}
        {character && (
          <BirdAvatar
            slug={character.slug}
            name={character.name}
            accentColor={character.accent_color}
            state={result?.correct ? "winning" : "defeated"}
            size="lg"
            className="mt-5"
          />
        )}
        <p className="mt-5 text-sm text-muted-foreground">
          Total {(myScore?.score ?? 0).toLocaleString()} · next up in {Math.max(1, seconds)}
        </p>
      </Panel>
    );
  }

  const question = state.question;
  if (!question) {
    return (
      <Panel>
        <p className="text-muted-foreground">Getting the next challenge…</p>
      </Panel>
    );
  }

  const options = questionOptions(question);
  const ordering = question.format === "ordering";
  const binary = question.format === "which_came_first";

  // YEAH NAH — two thumb-sized plates, fixed positions (YEAH left, NAH right)
  // so muscle memory works at five seconds a statement.
  if (question.format === "yeah_nah") {
    const yeah = options.find((o) => o.key === "yeah") ?? options[0]!;
    const nah = options.find((o) => o.key === "nah") ?? options[1]!;
    return (
      <div className="flex w-full flex-1 flex-col">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Yeah Nah · {question.number} of {state.total}
          </p>
          <p className={`font-display text-3xl ${seconds <= 2 ? "text-neon-magenta" : ""}`} role="timer">
            {seconds}
          </p>
        </div>
        <h1 className="mt-3 text-balance font-display text-2xl leading-tight">{question.text}</h1>
        <div className="mt-5 grid grid-cols-2 gap-4">
          {[
            { opt: yeah, symbol: "👍", tone: "border-primary text-primary" },
            { opt: nah, symbol: "👎", tone: "border-neon-magenta text-neon-magenta" },
          ].map(({ opt, symbol, tone }) => {
            const isMine = locked?.key === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => void lockIn({ optionKey: opt.key })}
                disabled={Boolean(locked) || busy}
                aria-pressed={isMine}
                className={`flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border-4 transition disabled:opacity-40 ${
                  isMine ? "border-primary bg-secondary" : tone
                }`}
              >
                <span aria-hidden="true" className="text-5xl leading-none">
                  {symbol}
                </span>
                <span className="font-display text-3xl uppercase">{opt.text}</span>
                {isMine && <span className="text-xs uppercase tracking-widest text-primary">Locked 🔒</span>}
              </button>
            );
          })}
        </div>
        <p aria-live="polite" className="mt-5 text-center font-display text-xl">
          {locked ? "LOCKED IN 🔒" : "Gut call — go."}
        </p>
      </div>
    );
  }



  const myManaRisk = isMana ? riskDef(myRisk) : null;

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {isMana ? "Mana" : state.roundName} · {question.number} of {state.total}
        </p>
        <p className="font-display text-2xl" role="timer">
          {seconds}s
        </p>
      </div>
      {isMana ? (
        <p className="mt-2 rounded-xl border-2 border-primary px-3 py-2 text-center font-display text-xl uppercase text-primary">
          {myManaRisk ? `${myManaRisk.label} x${myManaRisk.multiplier}` : "She'll Be Right x1"}
        </p>
      ) : (
        <p className="mt-1 text-xs uppercase tracking-[0.25em] text-neon-magenta">
          {formatLabel(question.format)}
        </p>
      )}
      <h1 className="mt-2 text-balance font-display text-2xl leading-tight">{question.text}</h1>


      <div className="mt-5">
        {ordering ? (
          <OrderingControl
            challengeId={question.sessionQuestionId}
            options={options}
            locked={locked?.order ?? null}
            busy={busy}
            onLock={(order) => void lockIn({ order })}
          />
        ) : (
          <div className="grid gap-3">
            {options.map((option, index) => {
              const isMine = locked?.key === option.key;
              return (
                <button
                  key={option.key}
                  data-option-key={option.key}
                  onClick={() => void lockIn({ optionKey: option.key })}
                  disabled={Boolean(locked) || busy}
                  aria-pressed={isMine}
                  className={`flex w-full items-center gap-4 rounded-xl border-2 px-4 text-left transition disabled:opacity-40 ${
                    binary ? "min-h-28 py-6" : "min-h-16 py-4"
                  } ${isMine ? "border-primary bg-secondary" : "border-border"}`}
                >
                  {!binary && (
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border font-display">
                      {optionLabel(index)}
                    </span>
                  )}
                  <span className={`font-display ${binary ? "text-2xl" : "text-lg"}`}>{option.text}</span>
                  {isMine && <span className="ml-auto text-sm uppercase tracking-widest text-primary">🔒</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!ordering && (
        <p aria-live="polite" className="mt-5 text-center font-display text-xl">
          {locked ? "LOCKED IN 🔒" : "Pick one — quick as."}
        </p>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="w-full text-center">{children}</div>;
}

/**
 * Receipt line: the exact words the player tapped, straight from the server's
 * record of the submission. If what they tapped and what the game recorded ever
 * disagree, this is where it shows.
 */
function YouSaid({ text }: { text?: string | null | undefined }) {
  if (!text) return <p className="mt-2 text-sm text-muted-foreground">You didn't answer.</p>;
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      You said <span className="font-display text-base text-foreground">{text}</span>
    </p>
  );
}

/**
 * Ace on the phone. Small, silent and instant — she shows up at the beats where
 * players are already waiting (round intros), so she never costs pacing.
 */
function AcePeek({ slot = "idle" }: { slot?: "idle" | "excited" | "pointing" | "celebrating" | "shocked" | "defeated" }) {
  return (
    <img
      src={aceArt(slot)}
      alt="Ace, host of Mīharo: The Showdown"
      className="mx-auto mt-4 h-28 w-auto object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
    />
  );
}
