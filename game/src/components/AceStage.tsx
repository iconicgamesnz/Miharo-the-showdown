import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { aceArt, ACE_ART } from "@/config/character-art";
import type { AceAssetSlot } from "@/config/ace";

export type AceSize = "presenter" | "reaction" | "small";

/**
 * ACE — the host, on stage.
 *
 * Uses the owner-approved local production artwork for the requested pose and
 * animates the still with tasteful UI motion only (entrance, breathing,
 * reaction pop, champion bounce). Historical DB asset rows are intentionally
 * ignored for launch so they cannot silently replace the approved artwork. No
 * frame-by-frame animation, and `prefers-reduced-motion` is respected globally.
 */
const HEIGHTS: Record<AceSize, string> = {
  // Presenter beats: roughly 40–55% of the TV's height.
  presenter: "h-[clamp(16rem,50vh,42rem)]",
  reaction: "h-[clamp(11rem,32vh,26rem)]",
  small: "h-[clamp(7rem,18vh,15rem)]",
};

export function AceStage({
  slot = "idle",
  line,
  size = "small",
  className,
  assetOverride,
}: {
  slot?: AceAssetSlot;
  line?: string;
  size?: AceSize;
  className?: string;
  /** Optional local production pose for a one-off show beat (e.g. The Final). */
  assetOverride?: string;
}) {
  // Keep every pose warm so a reaction beat never pops in late.
  useEffect(() => {
    Object.values(ACE_ART).forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  // The owner-approved local production artwork is authoritative for launch.
  // Historical rows in `ace_assets` may still contain older placeholder poses;
  // allowing them to override the production pack made Ace silently regress.
  // `assetOverride` is retained for explicit one-off beats such as The Final.
  const src = assetOverride ?? aceArt(slot);
  const motion =
    slot === "celebrating"
      ? "ace-celebrate"
      : slot === "shocked" || slot === "excited"
        ? "ace-reaction"
        : "ace-enter ace-breathe";

  return (
    <div className={cn("flex items-end gap-4", className)}>
      <img
        key={`${slot}:${src}`}
        src={src}
        alt={`Ace, host of Mīharo: The Showdown — ${slot}`}
        decoding="async"
        className={cn(
          "w-auto shrink-0 object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.65)]",
          HEIGHTS[size],
          motion,
        )}
      />
      {line && (
        <div className="relative mb-[4%] max-w-md rounded-2xl border border-border bg-background/70 px-5 py-4 backdrop-blur-sm">
          <p className="tv-subheading font-medium">{line}</p>
        </div>
      )}
    </div>
  );
}
