"use client";

import React from "react";

// ── Old prop shape (backwards compat) ────────────────────────────────────────
interface LegacyPageHeroProps {
  eyebrow?: string;
  headline: React.ReactNode;
  subtext?: string;
  glowColor?: string;
  glow?: "blue" | "green" | "amber" | "red" | "violet";
  statStrip?: { label: string; value: string; color?: string }[];
  className?: string;
}

// ── New prop shape ────────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  glow?: "blue" | "green" | "amber" | "red" | "violet";
  stats?: { label: string; value: string; color?: "income" | "expense" | "warning" | "default" }[];
  actions?: React.ReactNode;
  className?: string;
}

type Props = LegacyPageHeroProps | PageHeaderProps;

function isLegacy(p: Props): p is LegacyPageHeroProps {
  return "headline" in p;
}

// ── Color helpers ─────────────────────────────────────────────────────────────
type StatColor = "income" | "expense" | "warning" | "default";

const colorMap: Record<StatColor, string> = {
  income:  "var(--color-income,  #22C55E)",
  expense: "var(--color-expense, #EF4444)",
  warning: "var(--color-warning, #F59E0B)",
  default: "var(--color-ink-primary, #F0F2F5)",
};

function normalizeLegacyColor(c?: string): StatColor {
  if (c === "green") return "income";
  if (c === "red") return "expense";
  if (c === "amber" || c === "yellow") return "warning";
  return "default";
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PageHeader(props: Props) {
  let title: React.ReactNode;
  let subtitle: string | undefined;
  let glow: "blue" | "green" | "amber" | "red" | "violet" | undefined;
  let stats: PageHeaderProps["stats"];
  let actions: React.ReactNode;

  if (isLegacy(props)) {
    title    = props.headline;
    subtitle = props.subtext;
    glow     = props.glow;
    stats    = props.statStrip?.map((s) => ({
      label: s.label,
      value: s.value,
      color: normalizeLegacyColor(s.color),
    }));
    actions  = undefined;
  } else {
    title    = props.title;
    subtitle = props.subtitle;
    glow     = props.glow;
    stats    = props.stats;
    actions  = props.actions;
  }

  return (
    <div style={{ position: "relative" }}>
      {glow && (
        <div
          className={`glow-${glow}`}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
      )}
      <div
        className="px-4 md:px-6"
        style={{
          paddingTop: 20,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          position: "relative",
        }}
      >
        <div>
          <h1 style={{
            fontSize: 22,
            fontWeight: 600,
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            margin: 0,
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 12, color: "var(--color-ink-tertiary)", marginTop: 3, marginBottom: 0 }}>
              {subtitle}
            </p>
          )}
          {stats && stats.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              {stats.map((s) => (
                <div key={s.label}>
                  <div style={{
                    fontSize: 10,
                    color: "var(--color-ink-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 2,
                  }}>
                    {s.label}
                  </div>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono, monospace)",
                    color: s.color ? colorMap[s.color] : colorMap.default,
                  }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Backwards-compat exports ──────────────────────────────────────────────────
export const PageHero = PageHeader;
export default PageHeader;
