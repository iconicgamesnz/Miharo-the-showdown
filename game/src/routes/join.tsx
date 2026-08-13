import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { IconicLogo } from "@/components/IconicLogo";
import { getRoomSummary } from "@/lib/rooms.functions";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join a game — Mīharo: The Showdown" },
      {
        name: "description",
        content: "Enter your four-character room code to join a Mīharo: The Showdown game on your phone.",
      },
      { property: "og:title", content: "Join a Mīharo: The Showdown game" },
      { property: "og:description", content: "Enter the room code showing on the TV." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const lookup = useServerFn(getRoomSummary);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length < 4) {
      toast.error("Room codes are four characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await lookup({ data: { code: clean } });
      if (!result.found) {
        toast.error("No game with that code.");
        setBusy(false);
        return;
      }
      await navigate({ to: "/play/$code", params: { code: clean } });
    } catch {
      toast.error("Couldn't reach the game. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
      <IconicLogo size="sm" />
      <form onSubmit={submit} className="flex flex-1 flex-col justify-center gap-6">
        <div>
          <h1 className="text-4xl">Join the game</h1>
          <p className="mt-2 text-muted-foreground">Type the code showing on the TV.</p>
        </div>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Room code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            maxLength={6}
            placeholder="ABCD"
            aria-label="Room code"
            className="mt-2 w-full rounded-xl border-2 border-input bg-surface px-4 py-5 text-center font-display text-5xl tracking-[0.4em] uppercase outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-primary px-6 py-5 font-display text-xl text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Looking…" : "NEXT"}
        </button>
      </form>
    </main>
  );
}
