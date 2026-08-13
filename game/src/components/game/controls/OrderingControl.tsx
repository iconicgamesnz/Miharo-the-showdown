import { useEffect, useRef, useState } from "react";
import type { AnswerOption } from "@/lib/game-engine/session-state";

type Props = {
  /** Stable unique id for the current session question. */
  challengeId: string;
  options: AnswerOption[];
  locked: string[] | null;
  busy: boolean;
  onLock: (order: string[]) => void;
};

/**
 * Ordering control for the phone.
 *
 * Mobile usability beats fancy dragging: items can be dragged (HTML5 DnD on
 * pointer-capable devices) but the primary interaction is tap-to-pick then
 * tap-to-swap, backed by big up/down buttons. Nothing is submitted until the
 * player presses LOCK IT IN.
 *
 * The working arrangement is LOCAL controller state. Realtime refreshes hand us
 * a brand-new `options` array several times a second; resetting on that array's
 * identity used to snap a half-finished order back to the server's shuffle
 * mid-drag. We now reset only when the actual set of items changes (a new
 * challenge) or when an authoritative lock arrives.
 */
export function OrderingControl({ challengeId, options, locked, busy, onLock }: Props) {
  // Identity of the challenge, not of the array object. Generic option keys
  // (a/b/c/d) are reused across questions, so the session-question id MUST be
  // part of the signature or a new ordering challenge could inherit the prior
  // challenge's local draft order.
  const signature = `${challengeId}:${options.map((o) => o.key).join("|")}`;
  const [order, setOrder] = useState<string[]>(() => locked ?? options.map((o) => o.key));
  const [picked, setPicked] = useState<string | null>(null);
  const lastSignature = useRef(signature);
  const lastLocked = useRef<string | null>(locked ? locked.join("|") : null);

  // A new challenge resets the working arrangement.
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setOrder(options.map((o) => o.key));
    setPicked(null);
  }, [signature, options]);

  // A restored/confirmed lock freezes the order exactly as the server has it.
  useEffect(() => {
    const key = locked ? locked.join("|") : null;
    if (lastLocked.current === key) return;
    lastLocked.current = key;
    if (locked) {
      setOrder(locked);
      setPicked(null);
    }
  }, [locked]);

  const byKey = Object.fromEntries(options.map((o) => [o.key, o]));
  const isLocked = Boolean(locked);


  function move(from: number, to: number) {
    if (isLocked || busy) return;
    if (to < 0 || to >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  }

  function tap(key: string, index: number) {
    if (isLocked || busy) return;
    if (!picked) {
      setPicked(key);
      return;
    }
    if (picked === key) {
      setPicked(null);
      return;
    }
    const from = order.indexOf(picked);
    move(from, index);
    setPicked(null);
  }

  return (
    <div>
      <ol className="grid gap-2">
        {order.map((key, index) => {
          const option = byKey[key];
          if (!option) return null;
          const active = picked === key;
          return (
            <li
              key={key}
              draggable={!isLocked && !busy}
              onDragStart={() => setPicked(key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (picked) {
                  move(order.indexOf(picked), index);
                  setPicked(null);
                }
              }}
              className={`flex items-center gap-3 rounded-xl border-2 px-3 py-3 transition ${
                active ? "border-primary bg-secondary" : "border-border"
              } ${isLocked ? "opacity-70" : ""}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border font-display">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => tap(key, index)}
                disabled={isLocked || busy}
                aria-pressed={active}
                aria-label={`${option.text}, position ${index + 1}${active ? ", selected" : ""}`}
                className="flex-1 text-left font-display text-lg"
              >
                {option.text}
              </button>
              <span className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={isLocked || busy || index === 0}
                  aria-label={`Move ${option.text} up`}
                  className="grid size-8 place-items-center rounded-md border border-border disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={isLocked || busy || index === order.length - 1}
                  aria-label={`Move ${option.text} down`}
                  className="grid size-8 place-items-center rounded-md border border-border disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={() => onLock(order)}
        disabled={isLocked || busy}
        className="mt-4 w-full rounded-xl bg-primary py-5 font-display text-xl text-primary-foreground disabled:opacity-50"
      >
        {isLocked ? "LOCKED IN 🔒" : busy ? "Locking…" : "LOCK IT IN"}
      </button>
      {!isLocked && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Tap an item then tap where it goes, or use the arrows.
        </p>
      )}
    </div>
  );
}
