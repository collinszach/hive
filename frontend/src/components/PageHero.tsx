"use client";

import React from "react";

// ── Props ────────────────────────────────────────────────────────────────────
interface LegacyPageHeroProps {
  eyebrow?: string;
  headline: React.ReactNode;
  subtext?: string;
  glowColor?: string;
  glow?: "blue" | "green" | "amber" | "red" | "violet";
  statStrip?: { label: string; value: string; color?: string }[];
  className?: string;
}

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

type StatColor = "income" | "expense" | "warning" | "default";

const colorMap: Record<StatColor, string> = {
  income:  "var(--color-income)",
  expense: "var(--color-expense)",
  warning: "var(--color-warning)",
  default: "var(--color-ink-primary)",
};

function normalizeLegacyColor(c?: string): StatColor {
  if (c === "green") return "income";
  if (c === "red") return "expense";
  if (c === "amber" || c === "yellow") return "warning";
  return "default";
}

// ── Clean page header — no glows, no gradients ───────────────────────────────
export function PageHeader(props: Props) {
  let title: React.ReactNode;
  let subtitle: string | undefined;
  let stats: PageHeaderProps["stats"];
  let actions: React.ReactNode;
  let eyebrow: string | undefined;

  if (isLegacy(props)) {
    title    = props.headline;
    subtitle = props.subtext;
    eyebrow  = props.eyebrow;
    stats    = props.statStrip?.map((s) => ({
      label: s.label,
      value: s.value,
      color: normalizeLegacyColor(s.color),
    }));
    actions  = undefined;
  } else {
    title    = props.title;
    subtitle = props.subtitle;
    stats    = props.stats;
    actions  = props.actions;
  }

  return (
    <div style={{ paddingTop: 16, paddingBottom: 8 }}>
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
      }}>
        <div>
          {eyebrow && (
            <p style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-ink-tertiary)",
              marginBottom: 4,
            }}>
              {eyebrow}
            </p>
          )}
          <h1 style={{
            fontSize: 20,
            fontWeight: 600,
            color: "var(--color-ink-primary)",
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            margin: 0,
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: "var(--color-ink-tertiary)", marginTop: 2, marginBottom: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {actions}
          </div>
        )}
      </div>
      {stats && stats.length > 0 && (
        <div style={{
          display: "flex",
          gap: 20,
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
        }}>
          {stats.map((s) => (
            <div key={s.label}>
              <div style={{
                fontSize: 10,
                fontWeight: 500,
                color: "var(--color-ink-ghost)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 3,
              }}>
                {s.label}
              </div>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                fontFeatureSettings: '"tnum"',
                color: s.color ? colorMap[s.color] : colorMap.default,
              }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const PageHero = PageHeader;
export default PageHeader;
