import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { IconicLogo } from "@/components/IconicLogo";
import { BirdAvatar } from "@/components/BirdAvatar";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { useGameSession } from "@/hooks/useGameSession";
import { PhoneGame } from "@/components/game/PhoneGame";
import { joinRoom, swapCharacter, leaveRoom, heartbeat, startGame } from "@/lib/rooms.functions";
import { playAgain, advanceRound } from "@/lib/game.functions";
import { getPlayerToken, setPlayerToken, clearPlayerToken, getHostToken } from "@/lib/player-session";
import { ROOM_RULES } from "@/config/rounds";

export const Route = createFileRoute("/play/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your controller — Mīharo: The Showdown" },
      { name: "description", content: "Your phone is the controller for this Mīharo: The Showdown game." },
      { property: "og:title", content: "Mīharo: The Showdown — Player controller" },
      { property: "og:description", content: "Pick your bird and get ready." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlayerRoute,
});

/**
 * PLAYER CONTROLLER MODE — mobile first, thumb-sized targets, and only the
 * information this player is allowed to see.
 */
function PlayerRoute() {
  const { code } = Route.useParams();
  const upper = code.toUpperCase();
  const { room, players, characters, loading, missing, refresh } = useRoomChannel(upper);

  const { phase, state } = useGameSession(upper, room?.id ?? null, true);

  const join = useServerFn(joinRoom);
  const swap = useServerFn(swapCharacter);
  const leave = useServerFn(leaveRoom);
  const ping = useServerFn(heartbeat);
  const again = useServerFn(playAgain);
  const start = useServerFn(startGame);
  const nextRound = useServerFn(advanceRound);

  const [token, setToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(getPlayerToken(upper));
  }, [upper]);

  const me = useMemo(() => {
    if (!token) return null;
    // The token itself is never stored client-visible on rows; we match on the
    // seat we joined with, tracked by nickname + character once joined.
    return players.find((p) => p.id === localStorage.getItem(`iconic:playerid:${upper}`)) ?? null;
  }, [players, token, upper]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      void ping({ data: { code: upper, playerToken: token } }).catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(id);
  }, [token, upper, ping]);

  const takenIds = new Set(players.filter((p) => p.character_id).map((p) => p.character_id));

  async function handleJoin() {
    if (!selected) {
      toast.error("Pick a bird first.");
      return;
    }
    setBusy(true);
    try {
      const result = await join({
        data: {
          code: upper,
          nickname,
          characterSlug: selected,
          ...(token ? { playerToken: token } : {}),
        },
      });
      setPlayerToken(upper, result.playerToken);
      localStorage.setItem(`iconic:playerid:${upper}`, result.playerId);
      setToken(result.playerToken);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't join.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSwap(slug: string) {
    if (!token) return;
    try {
      await swap({ data: { code: upper, playerToken: token, characterSlug: slug } });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That bird's taken.");
    }
  }

  async function handleLeave() {
    if (!token) return;
    await leave({ data: { code: upper, playerToken: token } }).catch(() => undefined);
    clearPlayerToken(upper);
    localStorage.removeItem(`iconic:playerid:${upper}`);
    setToken(null);
    await refresh();
  }

  // Either the device that created the room, or the host player's own seat.
  // Solo play relies on the second path: one phone, no separate host device.
  const hostControlToken = (typeof window !== "undefined" ? getHostToken(upper) : null) ?? (me?.is_host ? token : null);
  const isHostDevice = Boolean(hostControlToken);

  async function handleStart() {
    if (!hostControlToken) return;
    setBusy(true);
    try {
      await start({ data: { code: upper, hostToken: hostControlToken } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start.");
    } finally {
      setBusy(false);
    }
  }

  async function handleContinue() {
    if (!hostControlToken) return;
    setBusy(true);
    try {
      await nextRound({ data: { code: upper, hostToken: hostControlToken } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start the next round.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePlayAgain() {
    const hostToken = hostControlToken;
    if (!hostToken) return;
    setBusy(true);
    try {
      await again({ data: { code: upper, hostToken } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start the rematch.");
    } finally {
      setBusy(false);
    }
  }


  if (loading) return <Shell><p className="text-muted-foreground">Connecting…</p></Shell>;

  if (missing || !room) {
    return (
      <Shell>
        <h1 className="text-3xl">Room not found</h1>
        <p className="mt-2 text-muted-foreground">Check the code on the TV.</p>
        <Link to="/join" className="mt-6 rounded-xl bg-primary px-6 py-4 font-display text-primary-foreground">
          TRY ANOTHER CODE
        </Link>
      </Shell>
    );
  }

  if (phase !== "lobby" && me && token) {
    return (
      <Shell>
        <PhoneGame
          code={upper}
          playerToken={token}
          playerId={me.id}
          phase={phase}
          state={state}
          characters={characters}
          characterId={me.character_id}
          nickname={me.nickname}
          hostControls={
            phase === "round_complete" && isHostDevice && state.nextRoundName ? (
              <button
                onClick={handleContinue}
                disabled={busy}
                className="w-full rounded-xl bg-neon-lime py-4 font-display text-xl text-background disabled:opacity-50"
              >
                {busy ? "STARTING…" : "CONTINUE"}
              </button>
            ) : phase === "game_over" ? (
              <div className="grid gap-3">
                {isHostDevice && (
                  <button
                    onClick={handlePlayAgain}
                    disabled={busy}
                    className="w-full rounded-xl bg-neon-lime py-4 font-display text-xl text-background disabled:opacity-50"
                  >
                    {busy ? "SETTING UP…" : "PLAY AGAIN"}
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
                  className="w-full rounded-xl border border-border py-4 text-center font-display text-lg"
                >
                  BACK TO MĪHARO
                </Link>
              </div>
            ) : null
          }
        />
      </Shell>
    );
  }


  if (phase !== "lobby" && !me) {
    return (
      <Shell>
        <h1 className="text-3xl">Game in progress</h1>
        <p className="mt-2 text-muted-foreground">
          This game has already started. Hang about for the next one.
        </p>
      </Shell>
    );
  }

  const myCharacter = me?.character_id
    ? characters.find((c) => c.id === me.character_id)
    : null;

  if (me) {
    return (
      <Shell>
        <div className="w-full">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Room {room.code}</p>
          <h1 className="mt-1 text-3xl">You're in, {me.nickname}</h1>

          <div className="panel-glow mt-6 flex items-center gap-4 p-4">
            {myCharacter && (
              <BirdAvatar
                slug={myCharacter.slug}
                name={myCharacter.name}
                accentColor={myCharacter.accent_color}
                size="md"
              />
            )}
            <div>
              <p className="font-display text-2xl">{myCharacter?.name ?? "No bird"}</p>
              <p className="text-sm text-muted-foreground">
                {myCharacter?.personality} · {myCharacter?.accessory}
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Change bird
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {characters.map((c) => {
              const taken = takenIds.has(c.id) && c.id !== me.character_id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSwap(c.slug)}
                  disabled={taken}
                  aria-label={`Choose ${c.name}${taken ? " (taken)" : ""}`}
                  className="flex min-h-24 flex-col items-center gap-1 rounded-xl border border-border p-2 disabled:opacity-30"
                >
                  <BirdAvatar slug={c.slug} name={c.name} accentColor={c.accent_color} size="sm" />
                  <span className="text-xs">{c.name}</span>
                  {taken && <span className="text-[0.6rem] uppercase text-muted-foreground">taken</span>}
                </button>
              );
            })}
          </div>

          {isHostDevice ? (
            <div className="mt-6">
              <button
                onClick={handleStart}
                disabled={busy || players.length < ROOM_RULES.minPlayers}
                className="w-full rounded-xl bg-neon-lime py-4 font-display text-xl text-background disabled:opacity-50"
              >
                {busy ? "STARTING…" : "START THE SHOW"}
              </button>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {players.length}/{room.max_players} in. You can play solo or wait for more.
              </p>
            </div>
          ) : (
            <div className="panel mt-6 p-4">
              <p className="text-sm text-muted-foreground">
                Waiting for the host to start. {players.length}/{room.max_players} players in.
              </p>
            </div>
          )}

          <button
            onClick={handleLeave}
            className="mt-6 w-full rounded-xl border border-border py-4 text-sm font-semibold text-muted-foreground"
          >
            Leave the game
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="w-full">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Room {room.code}</p>
        <h1 className="mt-1 text-3xl">Get set up</h1>

        <label className="mt-6 block">
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Nickname</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={14}
            placeholder="Your name"
            className="mt-2 w-full rounded-xl border-2 border-input bg-surface px-4 py-4 text-xl outline-none focus:border-primary"
          />
        </label>

        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">Pick your bird</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {characters.map((c) => {
            const taken = takenIds.has(c.id);
            const isSelected = selected === c.slug;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c.slug)}
                disabled={taken}
                aria-pressed={isSelected}
                className={`flex min-h-28 flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition disabled:opacity-30 ${
                  isSelected ? "border-primary bg-secondary" : "border-border"
                }`}
              >
                <BirdAvatar
                  slug={c.slug}
                  name={c.name}
                  accentColor={c.accent_color}
                  state={taken ? "defeated" : isSelected ? "winning" : "neutral"}
                  size="lg"
                />

                <span className="w-full min-w-0">
                  <span className="block truncate font-display text-lg">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {taken ? "Taken" : c.personality}
                  </span>
                  {isSelected && (
                    <span className="text-[0.65rem] uppercase tracking-widest text-primary">
                      Selected
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleJoin}
          disabled={busy || !nickname.trim() || !selected}
          className="mt-6 w-full rounded-xl bg-primary py-5 font-display text-xl text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Joining…" : "JOIN THE GAME"}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 py-6">
      <IconicLogo size="sm" />
      <div className="flex flex-1 flex-col items-start">{children}</div>
    </main>
  );
}
