import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShowdownHeader, MiharoWordmark, KiwiAsWordmark } from "@/components/IconicLogo";
import { BirdAvatar } from "@/components/BirdAvatar";
import { CHARACTERS } from "@/config/characters";
import { createRoom } from "@/lib/rooms.functions";
import { setHostToken } from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";
import { createFullGameCheckout, getFullGameAccess, getPurchaseStatus } from "@/lib/payments.functions";

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
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [fullUnlocked, setFullUnlocked] = useState(false);
  const checkout = useServerFn(createFullGameCheckout);
  const access = useServerFn(getFullGameAccess);
  const purchaseStatus = useServerFn(getPurchaseStatus);

  useEffect(() => {
    let alive = true;
      async function sync(session: any = null) {
        if (session === null) session = (await supabase.auth.getSession()).data.session;
      if (!alive) return;
      setSignedInEmail(session?.user.email ?? null);
      setAccessToken(session?.access_token ?? null);
      if (session?.access_token) {
        try { setFullUnlocked((await access({ data: { accessToken: session.access_token } })).unlocked); }
        catch { setFullUnlocked(false); }
      } else setFullUnlocked(false);
    }
    void sync();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { void sync(session); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [access]);


  useEffect(() => {
    if (!accessToken) return;
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");
    const checkoutSessionId = params.get("session_id");
    if (purchase === "cancelled") {
      toast.message("Purchase cancelled — nothing was charged.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (purchase !== "success" || !checkoutSessionId) return;

    let cancelled = false;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      try {
        const result = await purchaseStatus({ data: { accessToken, checkoutSessionId } });
        if (cancelled) return;
        if (result.unlocked) {
          setFullUnlocked(true);
          toast.success("Kiwi As — Full Game is unlocked.");
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
        if (result.status === "failed" || result.status === "refunded") {
          toast.error("That purchase isn't active. No unlock was granted.");
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
      } catch { /* webhook may still be processing; retry briefly */ }
      if (!cancelled && attempts < 10) window.setTimeout(check, 1000);
      else if (!cancelled) toast.message("Payment received — unlock is still being confirmed. Refresh in a moment.");
    };
    void check();
    return () => { cancelled = true; };
  }, [accessToken, purchaseStatus]);
  async function handleCreate(packSlug: "kiwi-as-quickie" | "kiwi-as-full" = "kiwi-as-quickie") {
    setBusy(true);
    try {
      const result = await create({ data: { packSlug, ...(accessToken ? { accessToken } : {}) } });
      setHostToken(result.code, result.hostToken);
      await navigate({ to: "/display/$code", params: { code: result.code } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start a game.");
      setBusy(false);
    }
  }

  async function sendMagicLink() {
    if (!email.trim()) return toast.error("Enter your email first.");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    else toast.success("Check your email for your Mīharo sign-in link.");
  }

  async function buyFullGame() {
    if (!accessToken) return toast.error("Sign in first so your purchase can be restored later.");
    setBusy(true);
    try {
      const result = await checkout({ data: { packSlug: "kiwi-as-full", accessToken, returnUrl: window.location.href } });
      if (result.alreadyOwned) { setFullUnlocked(true); toast.success("Full Game is already unlocked."); return; }
      if (result.url) window.location.assign(result.url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't open checkout."); }
    finally { setBusy(false); }
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
          📺 The TV is the show. 📱 The phones are the controllers. 👩🏽 Ace is your host. 🐦 The
          birds are the players. Up to six of you, no downloads.
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
                Ten free Kiwi challenges. No account or purchase needed. A complete mini Showdown.
              </p>
              <button
                onClick={() => handleCreate("kiwi-as-quickie")}
                disabled={busy}
                className="mt-2 rounded-xl bg-primary px-8 py-4 font-display text-xl text-primary-foreground shadow-[var(--glow-cyan)] transition hover:brightness-110 disabled:opacity-60"
              >
                {busy ? "Setting up…" : "PLAY FREE QUICKIE"}
              </button>
            </li>

            <li className="panel-glow flex flex-col gap-3 p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-neon-magenta">Full game · one-time unlock</span>
              <span className="font-display text-3xl">KIWI AS — FULL SHOWDOWN</span>
              <p className="text-sm text-muted-foreground">All five rounds, 33 challenges, Mana and The Final. Only the host needs to own it.</p>
              <p className="font-display text-3xl text-neon-lime">NZ$9.99</p>
              {fullUnlocked ? (
                <button onClick={() => handleCreate("kiwi-as-full")} disabled={busy} className="mt-2 rounded-xl bg-primary px-8 py-4 font-display text-xl text-primary-foreground disabled:opacity-60">PLAY FULL GAME</button>
              ) : signedInEmail ? (
                <>
                  <p className="text-xs text-muted-foreground">Signed in as {signedInEmail}</p>
                  <button onClick={buyFullGame} disabled={busy} className="mt-2 rounded-xl bg-accent px-8 py-4 font-display text-xl text-foreground disabled:opacity-60">UNLOCK FULL GAME</button>
                </>
              ) : (
                <div className="mt-2 grid gap-2">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="Email for purchase & restore" className="rounded-xl border border-border bg-background px-4 py-3" />
                  <button onClick={sendMagicLink} className="rounded-xl border-2 border-accent px-5 py-3 font-display">EMAIL ME A SIGN-IN LINK</button>
                  <p className="text-xs text-muted-foreground">Your sign-in keeps the one-time purchase attached to you so you can restore it later.</p>
                </div>
              )}
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <Link
            to="/join"
            className="inline-block rounded-xl border-2 border-accent px-8 py-4 text-center font-display text-xl text-foreground transition hover:bg-accent/15"
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
              <span className="text-xs text-muted-foreground">{bird.personality}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
