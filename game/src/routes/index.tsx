import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShowdownHeader, MiharoWordmark, KiwiAsWordmark } from "@/components/IconicLogo";
import { BirdAvatar } from "@/components/BirdAvatar";
import { CHARACTERS } from "@/config/characters";
import { createRoom } from "@/lib/rooms.functions";
import { setHostToken } from "@/lib/player-session";
import { createFullGameCheckout } from "@/lib/payments.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mīharo: The Showdown | Iconic Games" },
      {
        name: "description",
        content:
          "A multiplayer living-room game show where the TV is the show and your phones are the controllers. Tonight's showdown: Kiwi As.",
      },
      { property: "og:title", content: "Mīharo: The Showdown | Iconic Games" },
      {
        property: "og:description",
        content:
          "The TV is the show, your phones are the controllers, Ace is the host. Up to six players, no downloads.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const create = useServerFn(createRoom);
  const checkout = useServerFn(createFullGameCheckout);

  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("iconic:showdown-full-access");
    if (saved) setAccessCode(saved);

    const params = new URLSearchParams(window.location.search);

    if (params.get("purchase") === "cancelled") {
      toast.message("Purchase cancelled — nothing was charged.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (params.get("purchase") === "success") {
      toast.success("Payment received! Check your email for your Mīharo access code.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleCreate(
    packSlug: "kiwi-as-quickie" | "kiwi-as-full" = "kiwi-as-quickie",
  ) {
    if (packSlug === "kiwi-as-full" && !accessCode.trim()) {
      toast.error("Enter your Full Game access code.");
      return;
    }

    setBusy(true);

    try {
      const result = await create({
        data: {
          packSlug,
          ...(packSlug === "kiwi-as-full"
            ? { accessCode: accessCode.trim().toUpperCase() }
            : {}),
        },
      });

      if (packSlug === "kiwi-as-full") {
        window.localStorage.setItem(
          "iconic:showdown-full-access",
          accessCode.trim().toUpperCase(),
        );
      }

      setHostToken(result.code, result.hostToken);

      await navigate({
        to: "/display/$code",
        params: { code: result.code },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't start a game.",
      );
      setBusy(false);
    }
  }

  async function buyFullGame() {
    if (!email.trim()) {
      toast.error("Enter the email you want your access code sent to.");
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
          "That email already owns the Full Game. Use the access code from your purchase email.",
        );
        return;
      }

      if (result.url) window.location.assign(result.url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't open checkout.",
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

      <section className="flex flex-1 flex-col justify-center py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-neon-magenta">
          The living-room game show
        </p>

        <h1 className="mt-3">
          <MiharoWordmark size="lg" />
        </h1>

        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          📺 The TV is the show. 📱 The phones are the controllers. 👩🏽 Ace is
          your host. 🐦 The birds are the players. Up to six of you, no
          downloads.
        </p>

        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Choose your showdown
          </h2>

          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            <li className="panel-glow flex flex-col gap-3 p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-neon-lime">
                Game pack 01 · 🇳🇿
              </span>

              <span className="font-display text-4xl">
                <KiwiAsWordmark />
              </span>

              <p className="text-sm text-muted-foreground">
                Ten free Kiwi challenges. No account or purchase needed.
              </p>

              <button
                onClick={() => handleCreate("kiwi-as-quickie")}
                disabled={busy}
                className="mt-2 rounded-xl bg-primary px-8 py-4 font-display text-xl text-primary-foreground shadow-[var(--glow-cyan)] disabled:opacity-60"
              >
                {busy ? "SETTING UP…" : "PLAY FREE QUICKIE"}
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
                All five rounds, 35 challenges, Mana and The Final.
                One purchase unlocks the Full Game permanently.
              </p>

              <p className="font-display text-3xl text-neon-lime">
                NZ$9.99
              </p>

              <div className="grid gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  New player
                </p>

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
                  className="rounded-xl bg-accent px-5 py-3 font-display text-lg text-foreground disabled:opacity-60"
                >
                  UNLOCK FULL GAME — NZ$9.99
                </button>
              </div>

              <div className="my-1 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Already bought it?
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="grid gap-2">
                <input
                  value={accessCode}
                  onChange={(event) =>
                    setAccessCode(event.target.value.toUpperCase())
                  }
                  type="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="MIH-XXXX-XXXX"
                  className="rounded-xl border-2 border-primary bg-background px-4 py-3 text-center font-display text-xl uppercase tracking-widest"
                />

                <button
                  onClick={() => handleCreate("kiwi-as-full")}
                  disabled={busy}
                  className="rounded-xl bg-primary px-5 py-4 font-display text-xl text-primary-foreground disabled:opacity-60"
                >
                  PLAY FULL GAME
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Your permanent access code is emailed after purchase. Keep it
                somewhere safe.
              </p>
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <Link
            to="/join"
            className="inline-block rounded-xl border-2 border-accent px-8 py-4 text-center font-display text-xl"
          >
            JOIN A GAME
          </Link>
        </div>
      </section>

      <section className="pb-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Pick your bird
        </h2>

        <ul className="mt-4 flex flex-wrap gap-4">
          {CHARACTERS.map((bird) => (
            <li key={bird.slug} className="flex flex-col items-center gap-2">
              <BirdAvatar slug={bird.slug} size="md" />
              <span className="text-sm font-semibold">{bird.name}</span>
              <span className="text-xs text-muted-foreground">
                {bird.personality}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
