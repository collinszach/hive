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
  honey:   "rgba(245,185,66,0.18)",
  emerald: "rgba(52,211,153,0.18)",
  coral:   "rgba(248,113,113,0.18)",
  sky:     "rgba(56,189,248,0.18)",
  violet:  "rgba(167,139,250,0.18)",
};

const GLOW_BAND: Record<GlowColor, string> = {
  honey:   "rgba(245,185,66,0.07)",
  emerald: "rgba(52,211,153,0.07)",
  coral:   "rgba(248,113,113,0.07)",
  sky:     "rgba(56,189,248,0.07)",
  violet:  "rgba(167,139,250,0.07)",
};

const EYEBROW_CLASS: Record<GlowColor, string> = {
  honey:   "text-honey",
  emerald: "text-semantic-income",
  coral:   "text-semantic-expense",
  sky:     "text-[#38BDF8]",
  violet:  "text-[#A78BFA]",
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
    <div className={cn("rounded-2xl overflow-hidden border border-white/[0.05]", className)}>
      {/* Hero band */}
      <div
        className="relative px-6 pt-5 pb-4 overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${GLOW_BAND[glowColor]} 0%, transparent 60%)`,
          borderBottom: hasStrip ? "1px solid rgba(255,255,255,0.05)" : undefined,
        }}
      >
        {/* Ambient radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-14 -left-8 w-64 h-40 rounded-full"
          style={{ background: `radial-gradient(ellipse, ${GLOW_RGBA[glowColor]} 0%, transparent 70%)` }}
        />

        <p className={cn("relative text-[9px] font-bold tracking-[0.14em] uppercase", EYEBROW_CLASS[glowColor])}>
          {eyebrow}
        </p>
        <div className="relative mt-2 text-[40px] font-extrabold tracking-[-0.04em] leading-none text-ink-primary">
          {headline}
        </div>
        {subtext && (
          <p className="relative mt-1.5 text-[11px] text-ink-tertiary">{subtext}</p>
        )}
      </div>

      {/* Stat strip */}
      {hasStrip && (
        <div
          className="grid divide-x divide-white/[0.04]"
          style={{ gridTemplateColumns: `repeat(${statStrip!.length}, 1fr)`, background: "#0F1117" }}
        >
          {statStrip!.map((s) => (
            <div key={s.label} className="px-4 py-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.10em] text-ink-ghost">{s.label}</p>
              <p className={cn("text-[14px] font-semibold mt-0.5", STAT_VALUE_CLASS[s.color ?? "default"])}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
