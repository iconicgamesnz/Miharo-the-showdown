import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ALL_STAGE_URLS, STAGE_ART, type StageKind } from "@/config/stage-art";

/**
 * THE VIRTUAL STUDIO.
 *
 * Layer order is deliberate and never flattened:
 *   BACKGROUND STAGE → ACE → LIVE SHOW GRAPHICS/UI → EFFECTS
 *
 * The plate is `object-cover` on a full 16:9 viewport so it never distorts, and
 * the live UI sits inside a TV-safe inset so nothing important is cropped by
 * overscan on real televisions.
 */
export function TvStage({
  kind,
  children,
  effects,
  className,
}: {
  kind: StageKind;
  children: React.ReactNode;
  effects?: React.ReactNode;
  className?: string;
}) {
  const src = STAGE_ART[kind];
  // Warm every plate once so a phase change never waits on a download.
  useEffect(() => {
    ALL_STAGE_URLS.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  // A short production transition on each stage change (~500ms), keyed by plate.
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    setSweep((n) => n + 1);
  }, [kind]);

  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden bg-background", className)}>
      {/* 1 — BACKGROUND STAGE */}
      <img
        key={src}
        src={src}
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="high"
        className="stage-enter pointer-events-none absolute inset-0 size-full object-cover"
      />
      {/* Legibility scrim: keeps live graphics readable over the studio lighting. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(3,5,14,0.72)_100%)]"
      />
      {/* Production wipe on each stage change. */}
      <div
        key={`sweep-${sweep}`}
        aria-hidden="true"
        className="stage-sweep pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />

      {/* 2/3 — ACE + LIVE SHOW GRAPHICS, inside the TV safe zone */}
      <div className="relative z-10 flex min-h-screen w-full flex-col px-[5vw] py-[5vh]">
        {children}
      </div>

      {/* 4 — EFFECTS */}
      {effects}
    </div>
  );
}

/** Tasteful confetti for the champion beat. Pure CSS, no library, no layout cost. */
export function StageConfetti({ pieces = 40 }: { pieces?: number }) {
  const colors = ["#39FF88", "#00E5FF", "#FF3DD1", "#FFC53D", "#A855F7"];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {Array.from({ length: pieces }).map((_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2 rounded-[2px]"
          style={{
            left: `${(i * 97) % 100}%`,
            backgroundColor: colors[i % colors.length],
            animation: `confetti-fall ${3 + ((i * 7) % 5) * 0.4}s linear ${((i * 13) % 20) * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
