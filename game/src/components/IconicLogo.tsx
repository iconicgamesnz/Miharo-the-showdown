import { cn } from "@/lib/utils";
import { MIHARO_LOGO_URL } from "@/config/stage-art";

/**
 * Studio / creator mark. Iconic Games is the parent brand behind Play Mīharo.
 * Kept subtle — the consumer-facing product is Mīharo: The Showdown.
 */
export function IconicLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const scale = size === "lg" ? "text-2xl md:text-3xl" : size === "sm" ? "text-[0.65rem]" : "text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-display uppercase tracking-[0.35em] text-muted-foreground",
        scale,
        className,
      )}
    >
      <span>Iconic Games</span>
    </span>
  );
}

/**
 * Product wordmark for the platform: the supplied MĪHARO: THE SHOWDOWN logo.
 */
export function MiharoWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const height =
    size === "lg"
      ? "h-[clamp(5rem,18vh,14rem)]"
      : size === "sm"
        ? "h-10 md:h-12"
        : "h-16 md:h-24";
  return (
    <img
      src={MIHARO_LOGO_URL}
      alt="Mīharo: The Showdown"
      decoding="async"
      className={cn("w-auto object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.6)]", height, className)}
    />
  );
}


/** Header lockup: product mark with the studio credited underneath. */
export function ShowdownHeader({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <MiharoWordmark size="sm" />
      <IconicLogo size="sm" />
    </div>
  );
}

/** Game-pack wordmark — this stays "Kiwi As": it names the NZ pack, not the platform. */
export function KiwiAsWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display tracking-tight", className)}>
      <span className="text-neon-lime text-glow-lime">KIWI</span>{" "}
      <span className="text-foreground">AS</span>
    </span>
  );
}
