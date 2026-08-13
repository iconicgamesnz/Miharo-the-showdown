import { CHARACTER_BY_SLUG, type CharacterState } from "@/config/characters";
import { characterArt } from "@/config/character-art";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  name?: string;
  accentColor?: string;
  state?: CharacterState;
  /** Optional override (e.g. a row from `character_assets`). */
  assetUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  sm: "size-12 text-lg",
  md: "size-20 text-2xl",
  lg: "size-32 text-4xl",
  xl: "size-44 text-6xl",
};

/**
 * Renders a bird avatar using the approved artwork for the requested state,
 * with a lettered fallback if a state is ever missing.
 */
export function BirdAvatar({
  slug,
  name,
  accentColor,
  state = "neutral",
  assetUrl,
  size = "md",
  className,
}: Props) {
  const def = CHARACTER_BY_SLUG[slug];
  const label = name ?? def?.name ?? slug;
  const accent = accentColor ?? def?.accentVar ?? "var(--neon-cyan)";
  const src = assetUrl ?? characterArt(slug, state);

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border-2 bg-surface-raised",
        SIZES[size],
        className,
      )}
      style={{ borderColor: accent, boxShadow: `0 0 28px ${accent}33` }}
      data-character={slug}
      data-state={state}
    >
      {src ? (
        <img
          src={src}
          alt={`${label} — ${state}`}
          loading="lazy"
          className="absolute inset-0 size-full object-contain p-1 drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
        />
      ) : (
        <span className="font-display leading-none" style={{ color: accent }} aria-hidden="true">
          {label.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}
