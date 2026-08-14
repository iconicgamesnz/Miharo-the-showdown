import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShowdownHeader,
  MiharoWordmark,
  KiwiAsWordmark,
} from "@/components/IconicLogo";
import { BirdAvatar } from "@/components/BirdAvatar";
import { CHARACTERS } from "@/config/characters";
import { createRoom } from "@/lib/rooms.functions";
import {
  setHostToken,
  setPlayerToken,
} from "@/lib/player-session";
import { createFullGameCheckout } from "@/lib/payments.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mīharo: The Showdown | Iconic Games" },
      {
        name: "description",
        content:
          "A multiplayer living-room game show where the TV is the show and your phones are the controllers.",
      },
    ],
  }),
  component: Home,
});

type SetupMode = "quickie" | "full" | null;

function Home() {
  const navigate = useNavigate();
  const create = useServerFn(createRoom);
  const checkout = useServerFn(createFullGameCheckout);

  const [busy, setBusy] = useState(false);
  const [setupMode, setSetupMode] = useState<SetupMode>(null);

  const [nickname, setNickname] = useState("");
  const [selectedBird, setSelectedBird] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const savedNickname = window.localStorage.getItem(
      "iconic:showdown-nickname",
    );
    const savedBird = window.localStorage.getItem(
      "iconic:showdown-bird",
    );
    const savedAccess = window.localStorage.getItem(
      "iconic:showdown-full-access",
    );

    if (savedNickname) setNickname(savedNickname);
    if (savedBird) setSelectedBird(savedBird);
    if (savedAccess) setAccessCode(savedAccess);

    const params = new URLSearchParams(window.location.search);

    if (params.get("purchase") === "cancelled") {
      toast.message("Purchase cancelled — nothing was charged.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (params.get("purchase") === "success") {
      toast.success(
        "Payment received! Check your email for your Mīharo access code.",
      );
      setSetupMode("full");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function createShowdown() {
    if (!setupMode) return;

    if (!nickname.trim()) {
      toast.error("Enter your nickname.");
      return;
    }

    if (!selectedBird) {
      toast.error("Pick your bird.");
      return;
    }

    if (setupMode === "full" && !accessCode.trim()) {
      toast.error("Enter your Full Showdown access code.");
      return;
    }

    setBusy(true);

    try {
      const result = await create({
        data: {
          packSlug:
            setupMode === "full"
              ? "kiwi-as-full"
              : "kiwi-as-quickie",
          hostNickname: nickname.trim(),
          hostCharacterSlug: selectedBird,
          ...(setupMode === "full"
            ? {
                accessCode: accessCode.trim().toUpperCase(),
              }
            : {}),
        },
      });

      window.localStorage.setItem(
        "iconic:showdown-nickname",
        nickname.trim(),
      );

      window.localStorage.setItem(
        "iconic:showdown-bird",
        selectedBird,
      );

      if (setupMode === "full") {
        window.localStorage.setItem(
          "iconic:showdown-full-access",
          accessCode.trim().toUpperCase(),
        );
      }

      setHostToken(result.code, result.hostToken);

      if (result.playerToken) {
        setPlayerToken(result.code, result.playerToken);
      }

      // IMPORTANT: tells /play that this phone already owns Player 1.
      if (result.playerId) {
        window.localStorage.setItem(
          `iconic:playerid:${result.code.toUpperCase()}`,
          result.playerId,
        );
      }

      await navigate({
        to: "/play/$code",
        params: { code: result.code },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't start your Showdown.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function buyFullShowdown() {
    if (!email.trim()) {
      toast.error("Enter the email for your access code.");
      return;
    }

    setBusy(true);

    try {
      const result = await checkout({
        data: {
          packSlug: "kiwi-as-full",
          email: email.trim(),
          returnUrl: window.location.href,
        },
      });

      if (result.alreadyOwned) {
        toast.message(
          "That email already owns the Full Showdown. Use your existing access code.",
        );
        return;
      }

      if (result.url) {
        window.location.assign(result.url);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't open checkout.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8">
      <header className="flex items-start justify-between">
        <ShowdownHeader />

        <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
          Play Mīharo
        </span>
      </header>

      <section className="py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-neon-magenta">
          The living-room game show
        </p>

        <h1 className="mt-3">
          <MiharoWordmark size="lg" />
        </h1>

        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          📺 The TV is the show. 📱 Phones are the controllers.
          👩🏽 Ace is your host. 🐦 Up to six players.
        </p>

        {!setupMode ? (
          <>
            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Choose your showdown
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <section className="panel-glow flex flex-col gap-4 p-6">
                  <span className="text-xs uppercase tracking-[0.3em] text-neon-lime">
                    Free · 🇳🇿
                  </span>

                  <span className="font-display text-4xl">
                    <KiwiAsWordmark />
                  </span>

                  <h3 className="font-display text-xl">
                    BOOST IT FREE
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    Ten Kiwi challenges. No account or purchase needed.
                  </p>

                  <button
                    type="button"
                    onClick={() => setSetupMode("quickie")}
                    className="mt-auto rounded-xl bg-primary px-8 py-4 font-display text-xl text-primary-foreground"
                  >
                    START BOOST IT FREE
                  </button>
                </section>

                <section className="panel-glow flex flex-col gap-4 p-6">
                  <span className="text-xs uppercase tracking-[0.3em] text-neon-magenta">
                    Permanent unlock
                  </span>

                  <h3 className="font-display text-3xl">
                    KIWI AS — FULL SHOWDOWN
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    Five rounds, 35 challenges, Mana and The Final.
                  </p>

                  <p className="font-display text-3xl text-neon-lime">
                    NZ$9.99
                  </p>

                  <button
                    type="button"
                    onClick={() => setSetupMode("full")}
                    className="rounded-xl bg-primary px-8 py-4 font-display text-xl text-primary-foreground"
                  >
                    START FULL SHOWDOWN
                  </button>
                </section>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/join"
                className="block rounded-xl border-2 border-accent px-8 py-4 text-center font-display text-xl"
              >
                JOIN SOMEONE ELSE'S GAME
              </Link>
            </div>
          </>
        ) : (
          <section className="panel-glow mt-8 p-6">
            <button
              type="button"
              onClick={() => setSetupMode(null)}
              className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground"
            >
              ← BACK
            </button>

            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neon-lime">
              {setupMode === "full"
                ? "Kiwi As — Full Showdown"
                : "Kiwi As — Boost It Free"}
            </p>

            <h2 className="mt-2 font-display text-3xl">
              GET SET UP
            </h2>

            {setupMode === "full" && (
              <div className="mt-6">
                <label className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Access code
                </label>

                <input
                  value={accessCode}
                  onChange={(event) =>
                    setAccessCode(event.target.value.toUpperCase())
                  }
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="MIH-XXXX-XXXX"
                  className="mt-2 w-full rounded-xl border-2 border-primary bg-background px-4 py-4 text-center font-display text-xl uppercase tracking-widest"
                />
              </div>
            )}

            <div className="mt-6">
              <label className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Nickname
              </label>

              <input
                value={nickname}
                onChange={(event) =>
                  setNickname(event.target.value)
                }
                maxLength={20}
                placeholder="Your name"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-4 text-lg"
              />
            </div>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Pick your bird
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CHARACTERS.map((bird) => {
                  const selected =
                    selectedBird === bird.slug;

                  return (
                    <button
                      key={bird.slug}
                      type="button"
                      onClick={() =>
                        setSelectedBird(bird.slug)
                      }
                      className={`rounded-xl border-2 p-3 transition ${
                        selected
                          ? "border-neon-lime bg-neon-lime/10"
                          : "border-border"
                      }`}
                    >
                      <BirdAvatar
                        slug={bird.slug}
                        size="md"
                      />

                      <span className="mt-2 block font-display text-sm">
                        {bird.name}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {bird.personality}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={createShowdown}
              disabled={busy}
              className="mt-8 w-full rounded-xl bg-neon-lime px-8 py-4 font-display text-xl text-background disabled:opacity-50"
            >
              {busy
                ? "SETTING UP…"
                : setupMode === "full"
                  ? "JOIN THE FULL SHOWDOWN"
                  : "START BOOST IT FREE"}
            </button>

            {setupMode === "full" && (
              <div className="mt-8 border-t border-border pt-6">
                <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
                  Don't have access yet?
                </p>

                <div className="mt-3 grid gap-2">
                  <input
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    type="email"
                    inputMode="email"
                    placeholder="Email for your access code"
                    className="rounded-xl border border-border bg-background px-4 py-3"
                  />

                  <button
                    type="button"
                    onClick={buyFullShowdown}
                    disabled={busy}
                    className="rounded-xl border-2 border-accent px-5 py-3 font-display"
                  >
                    UNLOCK FULL SHOWDOWN — NZ$9.99
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
