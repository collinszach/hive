// frontend/src/components/PageHero.tsx
import { cn } from "@/lib/utils";

export type GlowColor = "honey" | "emerald" | "coral" | "sky" | "violet";

export interface HeroStat {
  label: string;
  value: string;
  color?: "default" | "green" | "red" | "amber" | "sky" | "violet";
}

interface PageHeroProps {
  eyebrow: string;
  headline: React.ReactNode;
  subtext?: string;
  glowColor?: GlowColor;
  statStrip?: HeroStat[];
  className?: string;
}

const GLOW_RGBA: Record<GlowColor, string> = {
  honey:   "rgba(245,185,66,0.14)",
  emerald: "rgba(52,211,153,0.14)",
  coral:   "rgba(248,113,113,0.14)",
  sky:     "rgba(56,189,248,0.14)",
  violet:  "rgba(167,139,250,0.14)",
};

const GLOW_BAND: Record<GlowColor, string> = {
  honey:   "rgba(245,185,66,0.06)",
  emerald: "rgba(52,211,153,0.06)",
  coral:   "rgba(248,113,113,0.06)",
  sky:     "rgba(56,189,248,0.06)",
  violet:  "rgba(167,139,250,0.06)",
};

const EYEBROW_CLASS: Record<GlowColor, string> = {
  honey:   "text-honey",
  emerald: "text-semantic-income",
  coral:   "text-semantic-expense",
  sky:     "text-[#38BDF8]",
  violet:  "text-[#A78BFA]",
};

const DOT_COLOR: Record<GlowColor, string> = {
  honey:   "#F5B942",
  emerald: "#34D399",
  coral:   "#F87171",
  sky:     "#38BDF8",
  violet:  "#A78BFA",
};

const STAT_VALUE_CLASS: Record<NonNullable<HeroStat["color"]>, string> = {
  default: "text-ink-primary",
  green:   "text-semantic-income",
  red:     "text-semantic-expense",
  amber:   "text-honey",
  sky:     "text-[#38BDF8]",
  violet:  "text-[#A78BFA]",
};

export function PageHero({
  eyebrow,
  headline,
  subtext,
  glowColor = "honey",
  statStrip,
  className,
}: PageHeroProps) {
  const hasStrip = statStrip && statStrip.length > 0;

  return (
    <div
      className={cn("rounded-[14px] overflow-hidden border border-white/[0.06]", className)}
      style={{ background: "#0C0E13" }}
    >
      {/* Hero band */}
      <div
        className="relative px-6 pt-6 pb-5 overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${GLOW_BAND[glowColor]} 0%, transparent 60%)`,
          borderBottom: hasStrip ? "1px solid rgba(255,255,255,0.05)" : undefined,
        }}
      >
        {/* Ambient radial glow — top-left corner only */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 -left-6 w-56 h-36 rounded-full"
          style={{ background: `radial-gradient(ellipse, ${GLOW_RGBA[glowColor]} 0%, transparent 70%)` }}
        />

        {/* Eyebrow */}
        <div className={cn("relative flex items-center gap-1.5 mb-3", EYEBROW_CLASS[glowColor])}>
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: DOT_COLOR[glowColor], boxShadow: `0 0 6px ${DOT_COLOR[glowColor]}` }}
          />
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase opacity-80">
            {eyebrow}
          </p>
        </div>

        {/* Headline */}
        <div className="relative text-[48px] font-black tracking-[-0.05em] leading-none text-ink-primary">
          {headline}
        </div>

        {subtext && (
          <p className="relative mt-2 text-[11px] text-ink-tertiary tracking-[-0.01em]">{subtext}</p>
        )}
      </div>

      {/* Stat strip */}
      {hasStrip && (
        <div
          className="grid divide-x divide-white/[0.04]"
          style={{ gridTemplateColumns: `repeat(${statStrip!.length}, 1fr)` }}
        >
          {statStrip!.map((s) => (
            <div key={s.label} className="px-5 py-3.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-ghost mb-1">
                {s.label}
              </p>
              <p className={cn("text-[15px] font-mono font-semibold tabular-nums", STAT_VALUE_CLASS[s.color ?? "default"])}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
