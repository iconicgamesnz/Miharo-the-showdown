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
      {
        property: "og:title",
        content: "Mīharo: The Showdown | Iconic Games",
      },
      {
        property: "og:description",
        content:
          "The TV is the show, your phones are the controllers, Ace is the host. Up to six players.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const create = useServerFn(createRoom);
  const checkout = useServerFn(createFullGameCheckout);

  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [selectedBird, setSelectedBird] = useState("");
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    const savedAccess = window.localStorage.getItem(
      "iconic:showdown-full-access",
    );
    const savedNickname = window.localStorage.getItem(
      "iconic:showdown-nickname",
    );
    const savedBird = window.localStorage.getItem(
      "iconic:showdown-bird",
    );

    if (savedAccess) setAccessCode(savedAccess);
    if (savedNickname) setNickname(savedNickname);
    if (savedBird) setSelectedBird(savedBird);

    const params = new URLSearchParams(window.location.search);

    if (params.get("purchase") === "cancelled") {
      toast.message("Purchase cancelled — nothing was charged.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (params.get("purchase") === "success") {
      toast.success(
        "Payment received! Check your email for your Mīharo access code.",
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function validatePlayer() {
    if (!nickname.trim()) {
      toast.error("Enter your player name first.");
      return false;
    }

    if (!selectedBird) {
      toast.error("Pick your bird first.");
      return false;
    }

    return true;
  }

  async function handleCreate(
    packSlug: "kiwi-as-quickie" | "kiwi-as-full",
  ) {
    if (!validatePlayer()) return;

    if (packSlug === "kiwi-as-full" && !accessCode.trim()) {
      toast.error("Enter your Full Game access code.");
      return;
    }

    setBusy(true);

    try {
      const result = await create({
        data: {
          packSlug,
          hostNickname: nickname.trim(),
          hostCharacterSlug: selectedBird,
          ...(packSlug === "kiwi-as-full"
            ? { accessCode: accessCode.trim().toUpperCase() }
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

      if (packSlug === "kiwi-as-full") {
        window.localStorage.setItem(
          "iconic:showdown-full-access",
          accessCode.trim().toUpperCase(),
        );
      }

      setHostToken(result.code, result.hostToken);

      if (result.playerToken) {
        setPlayerToken(result.code, result.playerToken);
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
      setBusy(false);
    }
  }

  async function buyFullGame() {
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
          "That email already owns the Full Game. Use your existing access code.",
        );
        return;
      }

      if (result.url) window.location.assign(result.url);
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
          👩🏽 Ace is your host. 🐦 Pick a bird and battle it out.
        </p>

        <div className="panel-glow mt-8 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neon-lime">
            Player 1
          </p>

          <h2 className="mt-2 font-display text-2xl">
            WHO ARE YOU PLAYING AS?
          </h2>

          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={20}
            placeholder="Your player name"
            className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-lg"
          />

          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {CHARACTERS.map((bird) => {
              const selected = selectedBird === bird.slug;

              return (
                <button
                  key={bird.slug}
                  type="button"
                  onClick={() => setSelectedBird(bird.slug)}
                  className={`rounded-xl border-2 p-2 transition ${
                    selected
                      ? "border-neon-lime bg-neon-lime/10"
                      : "border-border"
                  }`}
                >
                  <BirdAvatar slug={bird.slug} size="md" />

                  <span className="mt-1 block text-xs font-semibold">
                    {bird.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Choose your showdown
          </h2>

          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            <li className="panel-glow flex flex-col gap-3 p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-neon-lime">
                Free · 🇳🇿
              </span>

              <span className="font-display text-4xl">
                <KiwiAsWordmark />
              </span>

              <p className="text-sm text-muted-foreground">
                Ten Kiwi challenges. No account or purchase needed.
              </p>

              <button
                onClick={() => handleCreate("kiwi-as-quickie")}
                disabled={busy}
                className="mt-auto rounded-xl bg-primary px-8 py-4 font-display text-xl text-primary-foreground disabled:opacity-60"
              >
                {busy ? "SETTING UP…" : "START FREE QUICKIE"}
              </button>
            </li>

            <li className="panel-glow flex flex-col gap-4 p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-neon-magenta">
                Full game · permanent unlock
              </span>

              <span className="font-display text-3xl">
                KIWI AS — FULL SHOWDOWN
              </span>

              <p className="text-sm text-muted-foreground">
                Five rounds, 35 challenges, Mana and The Final.
              </p>

              <p className="font-display text-3xl text-neon-lime">
                NZ$9.99
              </p>

              <div className="grid gap-2">
                <input
                  value={accessCode}
                  onChange={(event) =>
                    setAccessCode(event.target.value.toUpperCase())
                  }
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="MIH-XXXX-XXXX"
                  className="rounded-xl border-2 border-primary bg-background px-4 py-3 text-center font-display text-lg uppercase tracking-widest"
                />

                <button
                  onClick={() => handleCreate("kiwi-as-full")}
                  disabled={busy}
                  className="rounded-xl bg-primary px-5 py-4 font-display text-xl text-primary-foreground disabled:opacity-60"
                >
                  {busy ? "SETTING UP…" : "START FULL SHOWDOWN"}
                </button>
              </div>

              <div className="my-1 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Need access?
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                inputMode="email"
                placeholder="Email for your access code"
                className="rounded-xl border border-border bg-background px-4 py-3"
              />

              <button
                onClick={buyFullGame}
                disabled={busy}
                className="rounded-xl border-2 border-accent px-5 py-3 font-display text-lg disabled:opacity-60"
              >
                UNLOCK FULL GAME — NZ$9.99
              </button>
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <Link
            to="/join"
            className="inline-block rounded-xl border-2 border-accent px-8 py-4 text-center font-display text-xl"
          >
            JOIN SOMEONE ELSE'S GAME
          </Link>
        </div>
      </section>
    </main>
  );
}
