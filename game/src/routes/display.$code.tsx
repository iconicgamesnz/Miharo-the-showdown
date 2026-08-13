import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { toast } from "sonner";
import { ShowdownHeader, KiwiAsWordmark } from "@/components/IconicLogo";
import { BirdAvatar } from "@/components/BirdAvatar";
import { AceStage } from "@/components/AceStage";
import { TvGame } from "@/components/game/TvGame";
import { TvStage, StageConfetti } from "@/components/tv/TvStage";
import { stageForPhase } from "@/config/stage-art";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { useGameSession } from "@/hooks/useGameSession";
import { useAceVoice } from "@/hooks/useAceVoice";
import { soundManager } from "@/lib/audio/sound-manager";
import { getHostToken } from "@/lib/player-session";
import { startGame } from "@/lib/rooms.functions";
import { advanceRound, playAgain } from "@/lib/game.functions";

import { ROOM_RULES } from "@/config/rounds";

export const Route = createFileRoute("/display/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Display — Mīharo: The Showdown" },
      { name: "description", content: "The Mīharo: The Showdown game show display for your TV or big screen." },
      { property: "og:title", content: "Mīharo: The Showdown — Display" },
      { property: "og:description", content: "Put this on the big screen and grab your phones." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DisplayRoute,
});

/**
 * DISPLAY / TV MODE.
 * Runs independently of the host's phone — open it on any browser attached to
 * a big screen. Structured so Cast support can be layered on later without
 * touching the multiplayer architecture. No native Cast is claimed today.
 */
function DisplayRoute() {
  const { code } = Route.useParams();
  const upper = code.toUpperCase();
  const { room, players, characters, loading, missing } = useRoomChannel(upper);
  const { phase, state, pendingLockIds, pendingRiskIds } = useGameSession(upper, room?.id ?? null, true);
  const { say } = useAceVoice();
  const start = useServerFn(startGame);
  const nextRound = useServerFn(advanceRound);
  const again = useServerFn(playAgain);
  const [qr, setQr] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  async function handleContinue() {
    const hostToken = getHostToken(upper);
    if (!hostToken) {
      toast.error("Only the host device can move things on.");
      return;
    }
    setAdvancing(true);
    try {
      await nextRound({ data: { code: upper, hostToken } });
      soundManager.playEvent("round_transition");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start the next round.");
    } finally {
      setAdvancing(false);
    }
  }

  async function handlePlayAgain() {
    const hostToken = getHostToken(upper);
    if (!hostToken) {
      toast.error("Only the host device can start a rematch.");
      return;
    }
    setAdvancing(true);
    try {
      await again({ data: { code: upper, hostToken } });
      soundManager.playEvent("game_start");
      toast.success("Rematch! Sweet As is back up.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start the rematch.");
    } finally {
      setAdvancing(false);
    }
  }




  const joinUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/play/${upper}`),
    [upper],
  );

  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, {
      width: 420,
      margin: 1,
      color: { dark: "#050914", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [joinUrl]);

  const charById = useMemo(
    () => Object.fromEntries(characters.map((c) => [c.id, c])),
    [characters],
  );

  function enableSound() {
    soundManager.unlock();
    setUnlocked(true);
    say("welcome");
  }

  async function handleStart() {
    const hostToken = getHostToken(upper);
    if (!hostToken) {
      toast.error("This device isn't the host. Start from the device that created the game.");
      return;
    }
    try {
      await start({ data: { code: upper, hostToken } });
      soundManager.playEvent("game_start");
      toast.success("Here we go — Sweet As is up.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start.");
    }
  }

  if (loading) {
    return <CentredMessage title="Warming up the studio…" />;
  }
  if (missing || !room) {
    return (
      <CentredMessage
        title="That room's gone"
        body="The code doesn't match an active game. Start a new one."
        action={
          <Link to="/" className="rounded-xl bg-primary px-6 py-3 font-display text-primary-foreground">
            BACK TO HOME
          </Link>
        }
      />
    );
  }

  const isHostDevice = typeof window !== "undefined" && Boolean(getHostToken(upper));

  return (
    <TvStage
      kind={stageForPhase(phase, state.round)}
      {...(phase === "game_over" ? { effects: <StageConfetti /> } : {})}
    >
    <main className="flex min-h-full w-full flex-1 flex-col">

      <header className="flex items-center justify-between">
        <ShowdownHeader />
        <div className="flex items-center gap-3">
          {!unlocked ? (
            <button
              onClick={enableSound}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
            >
              Enable sound
            </button>
          ) : (
            <button
              onClick={() => {
                const next = !muted;
                setMuted(next);
                soundManager.setMuted(next);
              }}
              aria-pressed={muted}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
            >
              {muted ? "Unmute" : "Mute"}
            </button>
          )}
          <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            Display mode
          </span>
        </div>
      </header>

      {phase !== "lobby" ? (
        <TvGame
          phase={phase}
          state={state}
          players={players}
          characters={characters}
          pendingLockIds={pendingLockIds}
          pendingRiskIds={pendingRiskIds}
          hostControls={
            phase === "game_over" ? (
              <div className="flex flex-wrap items-center justify-center gap-4">
                {isHostDevice && (
                  <button
                    onClick={handlePlayAgain}
                    disabled={advancing}
                    className="rounded-xl bg-neon-lime px-8 py-4 font-display text-xl text-background disabled:opacity-50"
                  >
                    {advancing ? "SETTING UP…" : "PLAY AGAIN"}
                  </button>
                )}
                {state.round === "quickie" && (
                  <Link
                    to="/"
                    className="rounded-xl bg-accent px-6 py-4 text-center font-display text-lg text-foreground"
                  >
                    UNLOCK THE FULL SHOWDOWN · NZ$9.99
                  </Link>
                )}
                <Link
                  to="/"
                  className="rounded-xl border border-border px-8 py-4 font-display text-xl"
                >
                  BACK TO MĪHARO
                </Link>
              </div>
            ) : isHostDevice ? (
              state.nextRoundName ? (

                <button
                  onClick={handleContinue}
                  disabled={advancing}
                  className="rounded-xl bg-neon-lime px-8 py-4 font-display text-xl text-background disabled:opacity-50"
                >
                  {advancing ? "STARTING…" : "CONTINUE"}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <p className="font-display text-2xl text-neon-magenta">
                    {state.nextRoundName
                      ? `${state.nextRoundName.toUpperCase()} — COMING NEXT`
                      : "THAT'S ALL FOR NOW"}
                  </p>
                  <button
                    disabled
                    title="The next round arrives in a future build"
                    className="rounded-xl border border-border px-8 py-4 font-display text-xl opacity-60"
                  >
                    CONTINUE
                  </button>
                </div>
              )
            ) : null
          }


        />
      ) : (

       <>
      <div className="grid flex-1 items-center gap-[3vw] py-[3vh] lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-neon-magenta">
            Tonight's showdown
          </p>
          <h1 className="tv-heading mt-2">
            <KiwiAsWordmark /> <span aria-hidden="true">🇳🇿</span>
          </h1>
          <p className="mt-1 text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Free beta · a Mīharo: The Showdown game pack
          </p>

          <div className="panel-glow mt-[3vh] inline-flex flex-col px-8 py-6">
            <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Room code
            </span>
            <span className="font-display text-[clamp(3rem,9vw,8rem)] leading-none tracking-[0.15em] text-primary text-glow-cyan">
              {room.code}
            </span>
          </div>

          <AceStage
            className="mt-[3vh]"
            slot="idle"
            size="presenter"
            line={
              players.length === 0
                ? "Right then — get those phones out and scan the code."
                : `${players.length} in. ${ROOM_RULES.maxPlayers - players.length} spots left.`
            }
          />
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="panel grid place-items-center p-5">
            {qr ? (
              <img src={qr} alt={`QR code to join room ${room.code}`} className="w-[clamp(140px,18vw,260px)]" />
            ) : (
              <div className="grid h-40 w-40 place-items-center text-sm text-muted-foreground">
                Loading QR…
              </div>
            )}
          </div>
          <p className="max-w-xs text-center tv-subheading text-muted-foreground">
            Scan, or head to <span className="text-foreground">{joinUrl.replace(/^https?:\/\//, "")}</span>
          </p>
        </div>
      </div>

      <section aria-label="Players in the lobby">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            In the room
          </h2>
          <span className="font-display text-xl">
            {players.length}/{room.max_players}
          </span>
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-4 md:grid-cols-6">
          {Array.from({ length: room.max_players }).map((_, index) => {
            const player = players[index];
            const character = player?.character_id ? charById[player.character_id] : null;
            return (
              <li
                key={player?.id ?? `empty-${index}`}
                className="panel flex flex-col items-center gap-2 px-2 py-4"
              >
                {player && character ? (
                  <>
                    <BirdAvatar
                      slug={character.slug}
                      name={character.name}
                      accentColor={character.accent_color}
                      size="lg"
                    />
                    <span className="font-display text-lg">{player.nickname}</span>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      {character.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="grid size-32 place-items-center rounded-2xl border-2 border-dashed border-border text-muted-foreground">
                      <span aria-hidden="true" className="font-display text-3xl">
                        ?
                      </span>
                    </div>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      Waiting
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="mt-[3vh] flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Round 1 — Sweet As — is ready. Five questions, twelve seconds each.
        </p>
        {isHostDevice && room.status === "lobby" && (
          <button
            onClick={handleStart}
            disabled={players.length < ROOM_RULES.minPlayers}
            className="rounded-xl bg-neon-lime px-8 py-4 font-display text-xl text-background disabled:opacity-50"
          >
            START THE SHOW
          </button>
        )}
      </footer>
       </>
      )}
    </main>
    </TvStage>

  );
}

function CentredMessage({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="tv-heading">{title}</h1>
        {body && <p className="mt-4 text-lg text-muted-foreground">{body}</p>}
        {action && <div className="mt-8">{action}</div>}
      </div>
    </main>
  );
}
