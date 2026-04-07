# HIVE Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade HIVE's visual design from "warm obsidian terminal" to "HIVE × Monarch" — cool-dark background, editorial hero bands, per-page ambient glow, glass card hierarchy, Monarch-quality spacing — while keeping honey amber as the brand accent.

**Architecture:** Foundation-first: update design tokens and create 7 shared components, then dispatch 4 parallel page-redesign agents (A: Dashboard/Points/Optimizer, B: Transactions/Budgets, C: CashFlow/NetWorth/Goals, D: Anomalies/Subscriptions/Chat/Merchants/Reports/Settings), then a QA agent to verify consistency. No backend changes. No API changes.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS 3, Recharts, shadcn/ui, `cn()` from `@/lib/utils`

**Spec:** `docs/superpowers/specs/2026-04-06-hive-visual-redesign.md`

---

## BATCH 1 — Foundation (run Tasks 1–5 sequentially; Tasks 2–4 may run in parallel after Task 1)

---

### Task 1: Update design tokens — tailwind.config.ts + globals.css

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Replace color tokens in tailwind.config.ts**

Open `frontend/tailwind.config.ts`. Replace the entire `colors` block inside `theme.extend` with:

```ts
colors: {
  base:     '#0A0C10',
  surface:  '#0F1117',
  elevated: '#161921',
  overlay:  '#1C2030',

  honey: {
    DEFAULT: '#F5B942',
    deep:    '#C9920E',
    bright:  '#FFD166',
    faint:   'rgba(245, 185, 66, 0.07)',
    subtle:  'rgba(245, 185, 66, 0.04)',
    glow:    'rgba(245, 185, 66, 0.20)',
    border:  'rgba(245, 185, 66, 0.14)',
  },

  ink: {
    primary:   '#F0F0F4',
    secondary: '#9CA3AF',
    tertiary:  '#4B5063',
    ghost:     '#374151',
  },

  semantic: {
    income:  '#34D399',
    expense: '#F87171',
    warning: '#FBBF24',
    info:    '#60A5FA',
  },

  border: {
    DEFAULT: 'rgba(255, 255, 255, 0.05)',
    subtle:  'rgba(255, 255, 255, 0.03)',
    strong:  'rgba(255, 255, 255, 0.09)',
    white:   'rgba(255, 255, 255, 0.06)',
    honey:   'rgba(245, 185, 66, 0.14)',
  },
},
```

Also add these new animations to the existing `animation` block (keep all existing entries, add these):

```ts
'bar-grow':   'barGrow 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
'bar-rise':   'barRise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
'slide-in-row': 'slideInRow 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
'chart-draw': 'chartDraw 1.2s cubic-bezier(0.4, 0, 0.2, 1) both',
```

And add these new keyframes to the existing `keyframes` block:

```ts
barGrow: {
  from: { width: '0%' },
  to:   { width: 'var(--bar-w, 100%)' },
},
barRise: {
  from: { transform: 'scaleY(0)', transformOrigin: 'bottom' },
  to:   { transform: 'scaleY(1)', transformOrigin: 'bottom' },
},
slideInRow: {
  from: { opacity: '0', transform: 'translateX(-10px)' },
  to:   { opacity: '1', transform: 'translateX(0)' },
},
chartDraw: {
  from: { strokeDashoffset: 'var(--path-len, 1000)' },
  to:   { strokeDashoffset: '0' },
},
```

- [ ] **Step 2: Add new CSS component classes to globals.css**

In `frontend/src/app/globals.css`, update `body` background to use the new token:

```css
body {
  background: #0A0C10;
  color: #F0F0F4;
  position: relative;
}
```

Replace the existing `.hive-card` rule with:

```css
.hive-card {
  background: #0F1117;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  background-image: linear-gradient(145deg, rgba(255,255,255,0.015) 0%, transparent 55%);
  box-shadow: 0 1px 3px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03);
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.hive-card:hover {
  border-color: rgba(255, 255, 255, 0.09);
}
```

Add these new card variants after `.hive-card`:

```css
/* Glass card — KPI tiles, account cards */
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  background-image: linear-gradient(145deg, rgba(255,255,255,0.04) 0%, transparent 55%);
  box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.glass-card:hover {
  border-color: rgba(255, 255, 255, 0.11);
  box-shadow: 0 6px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
}

/* Tinted glass — semantic color variants */
.glass-card-income {
  background: rgba(52, 211, 153, 0.04);
  border: 1px solid rgba(52, 211, 153, 0.12);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  background-image: linear-gradient(145deg, rgba(52,211,153,0.06) 0%, transparent 55%);
  box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(52,211,153,0.06);
}
.glass-card-expense {
  background: rgba(248, 113, 113, 0.04);
  border: 1px solid rgba(248, 113, 113, 0.12);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  background-image: linear-gradient(145deg, rgba(248,113,113,0.06) 0%, transparent 55%);
  box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(248,113,113,0.06);
}
.glass-card-amber {
  background: rgba(245, 185, 66, 0.05);
  border: 1px solid rgba(245, 185, 66, 0.16);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  background-image: linear-gradient(145deg, rgba(245,185,66,0.08) 0%, transparent 55%);
  box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 20px rgba(245,185,66,0.08);
}
.glass-card-sky {
  background: rgba(56, 189, 248, 0.04);
  border: 1px solid rgba(56, 189, 248, 0.12);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  background-image: linear-gradient(145deg, rgba(56,189,248,0.06) 0%, transparent 55%);
  box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.06);
}
.glass-card-violet {
  background: rgba(167, 139, 250, 0.04);
  border: 1px solid rgba(167, 139, 250, 0.12);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  background-image: linear-gradient(145deg, rgba(167,139,250,0.06) 0%, transparent 55%);
  box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(167,139,250,0.06);
}
```

Update `.hive-section-header` border-bottom:

```css
.hive-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
```

Add new animation stagger helpers after the existing `.stagger-children` rules:

```css
.stagger-children > *:nth-child(5)  { animation-delay: 200ms; }
.stagger-children > *:nth-child(6)  { animation-delay: 250ms; }
.stagger-children > *:nth-child(7)  { animation-delay: 300ms; }
.stagger-children > *:nth-child(8)  { animation-delay: 350ms; }
.stagger-children > *:nth-child(9)  { animation-delay: 400ms; }
.stagger-children > *:nth-child(10) { animation-delay: 450ms; }
```

Add the new keyframes at the bottom of the `@layer utilities` block:

```css
@keyframes barGrow {
  from { width: 0%; }
  to   { width: var(--bar-w, 100%); }
}
@keyframes barRise {
  from { transform: scaleY(0); transform-origin: bottom; }
  to   { transform: scaleY(1); transform-origin: bottom; }
}
@keyframes slideInRow {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
cd /home/zach/hive/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors, or only pre-existing errors unrelated to these changes.

- [ ] **Step 4: Commit**

```bash
cd /home/zach/hive/frontend
git add tailwind.config.ts src/app/globals.css
git commit -m "feat(design): update color tokens to cool-dark palette, add glass card variants and animation keyframes"
```

---

### Task 2: Create PageHero component

**Files:**
- Create: `frontend/src/components/PageHero.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /home/zach/hive/frontend && npx tsc --noEmit 2>&1 | grep PageHero
```

Expected: no output (no errors referencing PageHero).

- [ ] **Step 3: Commit**

```bash
cd /home/zach/hive/frontend
git add src/components/PageHero.tsx
git commit -m "feat(design): add PageHero shared component with glow color system"
```

---

### Task 3: Create AnimatedNumber + AnimatedBar components

**Files:**
- Create: `frontend/src/components/AnimatedNumber.tsx`
- Create: `frontend/src/components/AnimatedBar.tsx`

- [ ] **Step 1: Create AnimatedNumber**

```tsx
// frontend/src/components/AnimatedNumber.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  format,
  duration = 600,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const startRef  = useRef<number | null>(null);
  const frameRef  = useRef<number | null>(null);
  const targetRef = useRef(value);

  useEffect(() => {
    targetRef.current = value;
    startRef.current  = null;

    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed  = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(eased * targetRef.current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return <span className={cn(className)}>{format(display)}</span>;
}
```

- [ ] **Step 2: Create AnimatedBar**

```tsx
// frontend/src/components/AnimatedBar.tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedBarProps {
  /** 0–100 */
  pct: number;
  /** CSS color string or gradient — defaults to honey gradient */
  color?: string;
  /** bar height in px — defaults to 5 */
  height?: number;
  /** stagger delay in ms — defaults to 0 */
  delay?: number;
  className?: string;
}

export function AnimatedBar({
  pct,
  color,
  height = 5,
  delay = 0,
  className,
}: AnimatedBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(Math.max(pct, 0), 100)), delay + 30);
    return () => clearTimeout(t);
  }, [pct, delay]);

  return (
    <div
      className={cn("rounded-full overflow-hidden bg-white/[0.05]", className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width:                    `${width}%`,
          background:               color ?? "linear-gradient(90deg, #F5B942, #FFD166)",
          transition:               `width 800ms cubic-bezier(0.16, 1, 0.3, 1)`,
          transitionDelay:          `${delay}ms`,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/zach/hive/frontend && npx tsc --noEmit 2>&1 | grep -E "AnimatedNumber|AnimatedBar"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd /home/zach/hive/frontend
git add src/components/AnimatedNumber.tsx src/components/AnimatedBar.tsx
git commit -m "feat(design): add AnimatedNumber (rAF count-up) and AnimatedBar (spring grow) components"
```

---

### Task 4: Create GlassCard + ChartTooltip + FilterPills + TransactionDrawer

**Files:**
- Create: `frontend/src/components/GlassCard.tsx`
- Create: `frontend/src/components/ChartTooltip.tsx`
- Create: `frontend/src/components/FilterPills.tsx`
- Create: `frontend/src/components/TransactionDrawer.tsx`

- [ ] **Step 1: Create GlassCard**

```tsx
// frontend/src/components/GlassCard.tsx
import { cn } from "@/lib/utils";

type TintColor = "none" | "income" | "expense" | "amber" | "sky" | "violet";

interface GlassCardProps {
  tint?: TintColor;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const TINT_CLASS: Record<TintColor, string> = {
  none:    "glass-card",
  income:  "glass-card-income",
  expense: "glass-card-expense",
  amber:   "glass-card-amber",
  sky:     "glass-card-sky",
  violet:  "glass-card-violet",
};

export function GlassCard({ tint = "none", className, children, onClick }: GlassCardProps) {
  return (
    <div
      className={cn(TINT_CLASS[tint], className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create ChartTooltip**

```tsx
// frontend/src/components/ChartTooltip.tsx
import { fmt } from "@/lib/utils";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
  formatValue?: (v: number) => string;
}

export function ChartTooltip({ active, payload, label, formatValue }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const fmtV = formatValue ?? fmt;

  return (
    <div
      className="rounded-xl px-3 py-2.5 text-[12px]"
      style={{
        background:   "#161921",
        border:       "1px solid rgba(255,255,255,0.08)",
        boxShadow:    "0 8px 24px rgba(0,0,0,0.5)",
        color:        "#F0F0F4",
        minWidth:     120,
      }}
    >
      {label && <p className="text-[10px] text-ink-tertiary mb-1.5 font-medium">{label}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: entry.color ?? "#F5B942" }}
            />
            <span className="text-ink-secondary">{entry.name}</span>
          </div>
          <span className="font-semibold font-mono tabular-nums">{fmtV(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Shared axis/grid props — spread these onto CartesianGrid, XAxis, YAxis */
export const CHART_GRID_PROPS = {
  stroke:          "rgba(255,255,255,0.04)",
  strokeDasharray: "none",
} as const;

export const CHART_AXIS_PROPS = {
  tick:        { fill: "#4B5063", fontSize: 11, fontFamily: "var(--font-mono)" },
  axisLine:    false,
  tickLine:    false,
} as const;
```

- [ ] **Step 3: Create FilterPills**

```tsx
// frontend/src/components/FilterPills.tsx
import { cn } from "@/lib/utils";

interface FilterPillsProps {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function FilterPills({ options, value, onChange, className }: FilterPillsProps) {
  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150",
              active
                ? "bg-honey/[0.12] border border-honey/25 text-honey"
                : "bg-elevated border border-white/[0.06] text-ink-secondary hover:text-ink-primary hover:border-white/[0.10]"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create TransactionDrawer**

```tsx
// frontend/src/components/TransactionDrawer.tsx
"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { api, Transaction } from "@/lib/api";
import { fmt, fmtDate, ALL_CATEGORIES, SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";

const CATEGORY_EMOJI: Record<string, string> = {
  "Food & Drink":   "🍽️",
  "Groceries":      "🛒",
  "Travel":         "✈️",
  "Transportation": "🚗",
  "Entertainment":  "🎬",
  "Shopping":       "🛍️",
  "Health":         "🏥",
  "Utilities":      "💡",
  "Home":           "🏠",
  "Education":      "📚",
  "Personal Care":  "💆",
  "Transfers":      "🔄",
  "Business":       "💼",
  "Uncategorized":  "📋",
};

interface TransactionDrawerProps {
  transaction: Transaction | null;
  onClose: () => void;
  onCategoryChange?: (id: string, category: string, subcategory: string | null) => void;
}

export function TransactionDrawer({ transaction: tx, onClose, onCategoryChange }: TransactionDrawerProps) {
  const [category, setCategory]       = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [saving, setSaving]           = useState(false);
  const [similar, setSimilar]         = useState<Transaction[]>([]);

  useEffect(() => {
    if (!tx) return;
    setCategory(tx.category ?? "");
    setSubcategory(tx.subcategory ?? "");
    // Fetch similar transactions from same merchant
    if (tx.merchant) {
      api.transactions
        .list({ search: tx.merchant, page_size: 6, include_pending: false })
        .then((res) => setSimilar(res.items.filter((t) => t.id !== tx.id).slice(0, 5)))
        .catch(() => {});
    } else {
      setSimilar([]);
    }
  }, [tx]);

  async function saveCategory() {
    if (!tx) return;
    setSaving(true);
    try {
      await api.transactions.updateCategory(tx.id, category, subcategory || null);
      onCategoryChange?.(tx.id, category, subcategory || null);
    } finally {
      setSaving(false);
    }
  }

  const subcats = SUBCATEGORIES[category] ?? [];
  const isIncome = tx ? tx.amount < 0 : false;
  const emoji = CATEGORY_EMOJI[tx?.category ?? ""] ?? "📋";

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
          tx ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 w-80 flex flex-col",
          "bg-elevated border-l border-white/[0.06]",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          tx ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
          <span className="text-[13px] font-semibold text-ink-primary">Transaction Detail</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4 text-ink-tertiary" />
          </button>
        </div>

        {tx && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Merchant + amount */}
            <div className="text-center space-y-2">
              <div className="text-[36px] leading-none">{emoji}</div>
              <p className="text-[15px] font-semibold text-ink-primary">{tx.merchant ?? tx.raw_description}</p>
              <p className={cn("text-[28px] font-extrabold tracking-tight font-mono", isIncome ? "text-semantic-income" : "text-ink-primary")}>
                {isIncome ? "+" : "−"}{fmt(Math.abs(tx.amount))}
              </p>
              <p className="text-[11px] text-ink-tertiary font-mono">{fmtDate(tx.date)}</p>
            </div>

            {/* Points earned */}
            {tx.points_earned != null && tx.points_earned > 0 && (
              <div className="rounded-xl px-4 py-3 bg-honey/[0.07] border border-honey/20 text-center">
                <p className="text-[11px] text-honey font-semibold">
                  {Math.round(tx.points_earned).toLocaleString()} pts earned · {tx.card_slug ?? ""}
                </p>
              </div>
            )}

            {/* Category editor */}
            <div className="space-y-3">
              <p className="hive-label">Category</p>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}
                className="hive-select w-full"
              >
                <option value="">Select category…</option>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {subcats.length > 0 && (
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="hive-select w-full"
                >
                  <option value="">No subcategory</option>
                  {subcats.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              <button
                onClick={saveCategory}
                disabled={saving || category === (tx.category ?? "")}
                className="hive-btn-primary w-full py-2 text-[12px]"
              >
                {saving ? "Saving…" : "Save Category"}
              </button>
            </div>

            {/* Similar transactions */}
            {similar.length > 0 && (
              <div>
                <p className="hive-label mb-2">Similar from {tx.merchant}</p>
                <div className="space-y-1">
                  {similar.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03]">
                      <span className="text-[11px] text-ink-tertiary font-mono">{fmtDate(s.date)}</span>
                      <span className="text-[11px] font-mono text-ink-secondary">{fmt(Math.abs(s.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /home/zach/hive/frontend && npx tsc --noEmit 2>&1 | grep -E "GlassCard|ChartTooltip|FilterPills|TransactionDrawer"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd /home/zach/hive/frontend
git add src/components/GlassCard.tsx src/components/ChartTooltip.tsx \
        src/components/FilterPills.tsx src/components/TransactionDrawer.tsx
git commit -m "feat(design): add GlassCard, ChartTooltip, FilterPills, TransactionDrawer shared components"
```

---

### Task 5: Update Sidebar and layout.tsx

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Update Sidebar background and border to cool-dark**

In `frontend/src/components/Sidebar.tsx`, find the `<aside>` style object and update:

```tsx
// Change FROM:
style={{
  background: "#0C0A09",
  borderRight: "1px solid rgba(245, 185, 66, 0.07)",
}}

// Change TO:
style={{
  background: "#09090E",
  borderRight: "1px solid rgba(255, 255, 255, 0.05)",
}}
```

Find the ambient glow `<div>` and update its radial gradient opacity from `0.10` to `0.08`:

```tsx
// Change FROM:
background: "radial-gradient(ellipse 160% 100% at 50% 0%, rgba(245,185,66,0.10) 0%, transparent 70%)",

// Change TO:
background: "radial-gradient(ellipse 160% 100% at 50% 0%, rgba(245,185,66,0.08) 0%, transparent 70%)",
```

Find the group separator `<div>` and update:

```tsx
// Change FROM:
style={{ height: "1px", background: "rgba(245,185,66,0.06)" }}

// Change TO:
style={{ height: "1px", background: "rgba(255,255,255,0.04)" }}
```

Find the footer border and update:

```tsx
// Change FROM:
style={{ borderTop: "1px solid rgba(245, 185, 66, 0.07)" }}

// Change TO:
style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}
```

Find the brand `<div>` bottom border and update:

```tsx
// Change FROM:
style={{ borderBottom: "1px solid rgba(245, 185, 66, 0.07)" }}

// Change TO:
style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}
```

Increase nav item font size in the `NavItem` component:

```tsx
// Change FROM:
"text-[12.5px] font-medium transition-all duration-150",

// Change TO:
"text-[13px] font-medium transition-all duration-150",
```

- [ ] **Step 2: Update layout.tsx to add max-width and AuthGuard content wrapper**

In `frontend/src/app/layout.tsx`, the main content is rendered inside `<AuthGuard>`. Open `frontend/src/components/AuthGuard.tsx` to understand its structure, then look for where the Sidebar and main content area are rendered (it wraps the sidebar layout). Update the main content area class.

Find `AuthGuard.tsx` — it likely renders a layout like:
```tsx
<div className="flex h-screen">
  <Sidebar />
  <main className="flex-1 overflow-y-auto p-6">
    {children}
  </main>
</div>
```

Update the `<main>` padding from `p-6` to `p-7`, and add `max-w-7xl mx-auto` on a wrapper div inside main:

```tsx
<main className="flex-1 overflow-y-auto p-7">
  <div className="max-w-7xl mx-auto">
    {children}
  </div>
</main>
```

If AuthGuard has a different structure, read it fully first and make the equivalent change.

- [ ] **Step 3: Verify**

```bash
cd /home/zach/hive/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd /home/zach/hive/frontend
git add src/components/Sidebar.tsx src/components/AuthGuard.tsx
git commit -m "feat(design): update sidebar to cool-dark palette, increase nav font size, add max-width content wrapper"
```

---

## BATCH 2 — Pages (Tasks 6–9 are INDEPENDENT — dispatch as 4 parallel subagents after Batch 1 completes)

**Important for all page tasks:**
- Import components from their exact paths: `@/components/PageHero`, `@/components/GlassCard`, etc.
- Use `fmt` from `@/lib/utils` for currency formatting
- Use `cn` from `@/lib/utils` for className merging
- `text-ink-primary`, `text-ink-secondary`, `text-ink-tertiary`, `text-ink-ghost` are the text tokens
- `bg-surface` = `#0F1117`, `bg-elevated` = `#161921`, `bg-base` = `#0A0C10`
- `text-honey` = `#F5B942`, `text-semantic-income` = `#34D399`, `text-semantic-expense` = `#F87171`
- Honey glow pages: Dashboard, Points, Optimizer
- Emerald glow pages: Cash Flow, Budgets, Goals
- Sky glow pages: Net Worth, Merchants, Reports
- Coral glow pages: Anomalies, Subscriptions
- Violet glow pages: Chat

---

### Task 6 — Agent A: Dashboard + Points + Optimizer

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/points/page.tsx`
- Modify: `frontend/src/app/points/_components/ProgramCard.tsx` (if exists)
- Modify: `frontend/src/app/optimize/page.tsx`

#### 6A — Dashboard (`/`)

- [ ] **Step 1: Read the current Dashboard**

Read `frontend/src/app/page.tsx` fully before making changes. Understand the data flow: `accts`, `bdgts`, `pts`, `recentTx`, `spendData`.

- [ ] **Step 2: Add PageHero to the top of the Dashboard page**

Replace the existing `<div className="flex items-center justify-between">` header block (lines containing `<h1>Dashboard</h1>` and the alerts/connect buttons) with a `PageHero` plus a separate action row above it:

```tsx
import { PageHero } from "@/components/PageHero";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { AnimatedBar } from "@/components/AnimatedBar";
import { GlassCard } from "@/components/GlassCard";

// Inside the JSX, replace the header section:
<div className="space-y-5 animate-fade-in">

  {/* Action row */}
  <div className="flex items-center justify-end gap-2">
    {alerts.length > 0 && (
      <Link href="/points" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
        bg-honey/[0.08] border border-honey/20 text-[12px] font-semibold text-honey
        hover:bg-honey/[0.14] transition-all duration-150">
        <Bell className="w-3 h-3" />
        {alerts.length} reward{alerts.length > 1 ? "s" : ""} ready
      </Link>
    )}
    <Link href="/connect" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
      bg-elevated border border-white/[0.07] text-[12px] font-medium text-ink-secondary
      hover:text-ink-primary hover:bg-white/[0.06] transition-all duration-150">
      <Link2 className="w-3 h-3" />
      {noAccounts ? "Connect account" : "Add account"}
    </Link>
  </div>

  {/* Hero */}
  {!noAccounts && (
    <PageHero
      eyebrow={`Dashboard · ${monthLabel(month)}`}
      headline={<>{fmt(netCash).replace(/[\d,.$]+/, "")}<span className="text-honey">{fmt(netCash).match(/[\d,.]+/)?.[0] ?? ""}</span></>}
      subtext="net cash position this month"
      glowColor="honey"
      statStrip={[
        { label: "Total Assets",    value: fmt(totalAssets),  color: "green" },
        { label: "Credit Balances", value: fmt(totalDebt),    color: "red"   },
        { label: "Points Value",    value: pts ? fmt(pointsValue) : "—", color: "amber" },
        { label: monthLabel(month), value: `${bdgts.length} budgets`, color: "default" },
      ]}
    />
  )}
```

- [ ] **Step 3: Upgrade KPI tiles to GlassCard**

Replace the `KpiTile` component definition with one using `GlassCard`:

```tsx
function KpiTile({ label, value, sub, icon: Icon, tint }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; tint: "income" | "expense" | "amber" | "sky";
}) {
  return (
    <GlassCard tint={tint} className="p-5 relative overflow-hidden group">
      <div className="flex items-center justify-between mb-4">
        <span className="hive-label">{label}</span>
        <Icon className="w-4 h-4 text-ink-tertiary/50" />
      </div>
      <AnimatedNumber
        value={parseFloat(value.replace(/[^0-9.-]/g, "")) || 0}
        format={() => value}
        className="text-[26px] font-bold font-mono tracking-tight text-ink-primary leading-none"
      />
      {sub && <p className="mt-2 text-[11px] text-ink-tertiary leading-snug">{sub}</p>}
    </GlassCard>
  );
}
```

Update the KPI tile usages to use `tint` instead of `accent`:
```tsx
<KpiTile label="Net Cash"        value={fmt(netCash)}      tint={netCash >= 0 ? "income" : "expense"} icon={netCash >= 0 ? TrendingUp : TrendingDown} sub="assets minus liabilities" />
<KpiTile label="Total Assets"    value={fmt(totalAssets)}  tint="income"  icon={Landmark}   sub={`${bankAccts.length} bank account${bankAccts.length !== 1 ? "s" : ""}`} />
<KpiTile label="Credit Balances" value={fmt(totalDebt)}    tint="expense" icon={CreditCard}  sub={`across ${creditCards.length} card${creditCards.length !== 1 ? "s" : ""}`} />
<KpiTile label="Points Value"    value={pts ? fmt(pointsValue) : "—"} tint="amber" icon={Gem} sub="estimated · 90-day earned" />
```

- [ ] **Step 4: Upgrade Budget rows to use AnimatedBar**

In the `BudgetRow` component, replace the existing `<div className="h-[3px] ...">` bar with:

```tsx
import { AnimatedBar } from "@/components/AnimatedBar";

// Replace the bar div with:
<AnimatedBar
  pct={pct}
  color={
    over  ? "linear-gradient(90deg, #DC2626, #F87171)" :
    warn  ? "linear-gradient(90deg, #B45309, #FBBF24)" :
            "linear-gradient(90deg, #059669, #34D399)"
  }
  height={5}
  delay={0}
/>
```

- [ ] **Step 5: Upgrade Spend by Category bars to use AnimatedBar**

In the spend items map, replace the `<div className="h-[2px] ...">` bar:

```tsx
// Replace FROM:
<div className="h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
  <div className={`h-full rounded-full transition-all duration-500 ${CAT_BAR[b.category] ?? "bg-ink-tertiary"}`}
    style={{ width: `${(b.spend / maxSpend) * 100}%` }} />
</div>

// Replace TO:
<AnimatedBar
  pct={(b.spend / maxSpend) * 100}
  color={CAT_BAR_GRADIENT[b.category] ?? "#4B5063"}
  height={3}
  delay={spendItems.indexOf(b) * 60}
/>
```

Add this constant at the top of the file (alongside `CAT_BAR`):

```tsx
const CAT_BAR_GRADIENT: Record<string, string> = {
  "Food & Drink":   "linear-gradient(90deg, #EA580C, #FB923C)",
  "Groceries":      "linear-gradient(90deg, #059669, #34D399)",
  "Travel":         "linear-gradient(90deg, #0284C7, #38BDF8)",
  "Transportation": "linear-gradient(90deg, #CA8A04, #FCD34D)",
  "Entertainment":  "linear-gradient(90deg, #7C3AED, #A78BFA)",
  "Shopping":       "linear-gradient(90deg, #BE185D, #F472B6)",
  "Health":         "linear-gradient(90deg, #BE123C, #FB7185)",
  "Utilities":      "linear-gradient(90deg, #475569, #94A3B8)",
  "Home":           "linear-gradient(90deg, #0F766E, #2DD4BF)",
};
```

- [ ] **Step 6: Update Account cards to cool-dark border colors**

In `AccountCard`, update the border and gradient colors from amber-tinted to neutral:

```tsx
// Change the Link className condition:
isCredit
  ? "from-honey/[0.04] via-transparent to-transparent hover:border-honey/18 hover:from-honey/[0.07]"
  : "from-semantic-income/[0.04] via-transparent to-transparent hover:border-semantic-income/18 hover:from-semantic-income/[0.07]"
// And the overall border:
"bg-gradient-to-br border border-white/[0.05] transition-all duration-200"
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd /home/zach/hive/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 8: Commit Dashboard**

```bash
cd /home/zach/hive/frontend
git add src/app/page.tsx
git commit -m "feat(design): redesign Dashboard — PageHero, GlassCard KPIs, AnimatedBar budgets/spend"
```

#### 6B — Points (`/points`)

- [ ] **Step 9: Read current Points page structure**

Read `frontend/src/app/points/page.tsx` and all `_components/` files (ProgramCard, EarnActivity, LeakageSummary, TimeWindowPicker).

- [ ] **Step 10: Add PageHero to Points page**

At the top of the Points page JSX (after the loading/error guards), add:

```tsx
import { PageHero } from "@/components/PageHero";

{summary && (
  <PageHero
    eyebrow={`Points Summary · Last ${days} days`}
    headline={<><span className="text-honey">{fmt(summary.total_estimated_value_dollars)}</span></>}
    subtext={`across ${summary.programs.length} reward programs`}
    glowColor="honey"
    statStrip={[
      { label: "Total Points", value: Math.round(summary.total_points_earned_90d).toLocaleString(), color: "amber" },
      { label: "Best Program", value: summary.programs[0]?.program ?? "—", color: "default" },
      { label: "Above Threshold", value: `${summary.programs.filter(p => p.above_threshold).length} ready`, color: "green" },
      { label: "Est. Value", value: fmt(summary.total_estimated_value_dollars), color: "amber" },
    ]}
  />
)}
```

- [ ] **Step 11: Upgrade ProgramCard to glass-card-amber on redemption threshold**

In `ProgramCard.tsx` (or inline in points page), add `glass-card-amber` class to cards where `program.above_threshold` is true, and `hive-card` for others:

```tsx
<div className={cn(
  "rounded-2xl p-5 transition-all duration-200",
  program.above_threshold ? "glass-card-amber" : "hive-card"
)}>
```

- [ ] **Step 12: Commit Points**

```bash
cd /home/zach/hive/frontend
git add src/app/points/
git commit -m "feat(design): redesign Points — PageHero amber hero, glass-card-amber on redeemable programs"
```

#### 6C — Optimizer (`/optimize`)

- [ ] **Step 13: Read current Optimizer page**

Read `frontend/src/app/optimize/page.tsx` fully.

- [ ] **Step 14: Replace header with styled header + honey ambient**

Replace the plain `<h1>` header with:

```tsx
<div className="space-y-5 animate-fade-in">
  {/* Page header with honey ambient glow */}
  <div className="relative overflow-hidden rounded-2xl border border-white/[0.05] px-6 py-5"
    style={{ background: "linear-gradient(160deg, rgba(245,185,66,0.06) 0%, transparent 60%)" }}>
    <div aria-hidden className="pointer-events-none absolute -top-10 -left-6 w-48 h-32 rounded-full"
      style={{ background: "radial-gradient(ellipse, rgba(245,185,66,0.15) 0%, transparent 70%)" }} />
    <p className="relative text-[9px] font-bold tracking-[0.14em] uppercase text-honey">Card Optimizer</p>
    <h1 className="relative text-[24px] font-semibold tracking-tight text-ink-primary mt-1">Find the best card at checkout</h1>
    <p className="relative text-[13px] text-ink-tertiary mt-1">Enter a category and amount to see ranked card recommendations</p>
  </div>
```

- [ ] **Step 15: Upgrade result cards — best card gets glass-card-income**

Replace the result card rendering so `best` card (index 0) uses `glass-card-income` styling and others use `hive-card`:

```tsx
{cards.map((card, i) => (
  <div
    key={card.card_slug}
    className={cn(
      "rounded-2xl p-5 transition-all duration-200",
      i === 0 ? "glass-card-income" : "hive-card opacity-70"
    )}
  >
    <div className="flex items-center justify-between">
      <div>
        {i === 0 && <span className="text-[9px] font-bold tracking-[0.10em] uppercase text-semantic-income mb-1 block">Best Choice</span>}
        <p className={cn("text-[14px] font-semibold", i === 0 ? "text-ink-primary" : "text-ink-secondary")}>
          {card.card_slug.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
        </p>
        <p className="text-[11px] text-ink-tertiary mt-0.5">{card.program}</p>
      </div>
      <div className="text-right">
        <p className={cn("text-[22px] font-bold font-mono tracking-tight", i === 0 ? "text-semantic-income" : "text-ink-tertiary")}>
          {card.earn_rate}×
        </p>
        <p className="text-[10px] text-ink-tertiary">{fmt(card.estimated_points_value)} value</p>
      </div>
    </div>
  </div>
))}
```

- [ ] **Step 16: Commit Optimizer**

```bash
cd /home/zach/hive/frontend
git add src/app/optimize/page.tsx
git commit -m "feat(design): redesign Optimizer — honey ambient header, glass-card-income for best card result"
```

---

### Task 7 — Agent B: Transactions + Budgets

**Files:**
- Modify: `frontend/src/app/transactions/page.tsx`
- Modify: `frontend/src/app/budgets/page.tsx`

#### 7A — Transactions (`/transactions`)

- [ ] **Step 1: Read current Transactions page fully**

Read `frontend/src/app/transactions/page.tsx`. Understand: filter state, pagination, category edit inline dropdown, transaction row structure.

- [ ] **Step 2: Add TransactionDrawer state and imports**

At the top of the component, add:

```tsx
import { FilterPills } from "@/components/FilterPills";
import { TransactionDrawer } from "@/components/TransactionDrawer";

// Inside component:
const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
```

- [ ] **Step 3: Add FilterPills row above the transaction table**

Add a `FilterPills` component row between the header and the table. Define the options from `ALL_CATEGORIES`:

```tsx
const FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Food & Drink", value: "Food & Drink" },
  { label: "Groceries", value: "Groceries" },
  { label: "Travel", value: "Travel" },
  { label: "Transportation", value: "Transportation" },
  { label: "Entertainment", value: "Entertainment" },
  { label: "Shopping", value: "Shopping" },
  { label: "Health", value: "Health" },
  { label: "Utilities", value: "Utilities" },
];

// In JSX, add before the table:
<FilterPills
  options={FILTER_OPTIONS}
  value={categoryFilter}
  onChange={(v) => { setCategoryFilter(v); setPage(1); }}
  className="mb-4"
/>
```

If a `categoryFilter` state doesn't already exist, add:
```tsx
const [categoryFilter, setCategory] = useState("");
```
And pass it to the API call: `api.transactions.list({ ..., category: categoryFilter || undefined })`.

- [ ] **Step 4: Upgrade transaction rows**

Update each transaction row to: increase height, use `onClick` to open drawer, add stagger animation. The row className should be:

```tsx
className={cn(
  "px-5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer",
  "animate-slide-up border-b border-white/[0.04] last:border-0",
)}
style={{ animationDelay: `${Math.min(index, 9) * 30}ms`, minHeight: 48 }}
onClick={() => setSelectedTx(tx)}
```

Replace the plain `<div>` merchant icon with a category-emoji badge:

```tsx
const CATEGORY_EMOJI: Record<string, string> = {
  "Food & Drink": "🍽️", "Groceries": "🛒", "Travel": "✈️",
  "Transportation": "🚗", "Entertainment": "🎬", "Shopping": "🛍️",
  "Health": "🏥", "Utilities": "💡", "Home": "🏠",
  "Transfers": "🔄", "Business": "💼",
};

// Row icon:
<div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-elevated text-[16px]">
  {CATEGORY_EMOJI[tx.category ?? ""] ?? "📋"}
</div>
```

- [ ] **Step 5: Add TransactionDrawer at bottom of page JSX**

```tsx
<TransactionDrawer
  transaction={selectedTx}
  onClose={() => setSelectedTx(null)}
  onCategoryChange={(id, cat, sub) => {
    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, category: cat, subcategory: sub ?? undefined } : t
    ));
    setSelectedTx(null);
  }}
/>
```

- [ ] **Step 6: Commit Transactions**

```bash
cd /home/zach/hive/frontend
git add src/app/transactions/page.tsx
git commit -m "feat(design): redesign Transactions — FilterPills, category emoji icons, slide-in drawer, stagger rows"
```

#### 7B — Budgets (`/budgets`)

- [ ] **Step 7: Read current Budgets page fully**

Read `frontend/src/app/budgets/page.tsx`. Note the `BudgetCard` component and `pct_used`, `actual_spend`, `budget_amount` fields.

- [ ] **Step 8: Add PageHero to Budgets**

At the top of the Budgets page JSX (after loading), compute the summary stats:

```tsx
import { PageHero } from "@/components/PageHero";

const onTrackCount  = budgets.filter(b => b.pct_used <= 80).length;
const overCount     = budgets.filter(b => b.pct_used > 100).length;
const totalBudgeted = budgets.reduce((s, b) => s + b.budget_amount, 0);
const totalSpent    = budgets.reduce((s, b) => s + b.actual_spend, 0);

// In JSX:
{budgets.length > 0 && (
  <PageHero
    eyebrow={`Budgets · ${monthLabel(currentMonth())}`}
    headline={<><span className="text-semantic-income">{onTrackCount}</span><span className="text-ink-tertiary text-[22px] font-normal"> / {budgets.length} on track</span></>}
    subtext={overCount > 0 ? `${overCount} category over budget` : "All categories within budget"}
    glowColor="emerald"
    statStrip={[
      { label: "Total Budgeted", value: fmt(totalBudgeted), color: "default" },
      { label: "Total Spent",    value: fmt(totalSpent),    color: totalSpent > totalBudgeted ? "red" : "green" },
      { label: "Remaining",      value: fmt(Math.max(totalBudgeted - totalSpent, 0)), color: "green" },
      { label: "Over Budget",    value: String(overCount), color: overCount > 0 ? "red" : "green" },
    ]}
  />
)}
```

- [ ] **Step 9: Upgrade BudgetCard progress bar to AnimatedBar**

In the `BudgetCard` component, replace the existing bar `<div>` with:

```tsx
import { AnimatedBar } from "@/components/AnimatedBar";

// Replace the bar:
<AnimatedBar
  pct={barPct}
  color={
    isOver    ? "linear-gradient(90deg, #DC2626, #F87171)" :
    isWarning ? "linear-gradient(90deg, #B45309, #FBBF24)" :
                "linear-gradient(90deg, #059669, #34D399)"
  }
  height={6}
  className="mt-3"
/>
```

- [ ] **Step 10: Commit Budgets**

```bash
cd /home/zach/hive/frontend
git add src/app/budgets/page.tsx
git commit -m "feat(design): redesign Budgets — emerald PageHero, AnimatedBar progress bars (6px)"
```

---

### Task 8 — Agent C: Cash Flow + Net Worth + Goals

**Files:**
- Modify: `frontend/src/app/cash-flow/page.tsx`
- Modify: `frontend/src/app/cash-flow/_components/SankeyFlow.tsx` (if exists)
- Modify: `frontend/src/app/net-worth/page.tsx`
- Modify: `frontend/src/app/goals/page.tsx`

#### 8A — Cash Flow (`/cash-flow`)

- [ ] **Step 1: Read current Cash Flow page fully**

Read `frontend/src/app/cash-flow/page.tsx` and the `SankeyFlow` component. Note `monthly`, `summary`, `view` state.

- [ ] **Step 2: Add PageHero to Cash Flow**

```tsx
import { PageHero } from "@/components/PageHero";
import { ChartTooltip, CHART_GRID_PROPS, CHART_AXIS_PROPS } from "@/components/ChartTooltip";

// Compute net for hero:
const totalIncome  = monthly.reduce((s, m) => s + m.income, 0);
const totalExpense = monthly.reduce((s, m) => s + m.expenses, 0);
const netFlow      = totalIncome - totalExpense;

// In JSX, before the chart:
{monthly.length > 0 && (
  <PageHero
    eyebrow={`Cash Flow · Last ${monthly.length} months`}
    headline={
      <span className={netFlow >= 0 ? "text-semantic-income" : "text-semantic-expense"}>
        {netFlow >= 0 ? "+" : "−"}{fmt(Math.abs(netFlow))}
      </span>
    }
    subtext="net income over period"
    glowColor="emerald"
    statStrip={[
      { label: "Total Income",  value: fmt(totalIncome),  color: "green" },
      { label: "Total Spent",   value: fmt(totalExpense), color: "red"   },
      { label: "Avg Monthly",   value: fmt(totalIncome / Math.max(monthly.length, 1)), color: "default" },
      { label: "Savings Rate",  value: `${Math.round((1 - totalExpense / Math.max(totalIncome, 1)) * 100)}%`, color: "green" },
    ]}
  />
)}
```

- [ ] **Step 3: Apply chart theme to BarChart**

Find the `<BarChart>` or `<ResponsiveContainer>` usage. Update `<CartesianGrid>`, `<XAxis>`, `<YAxis>`, and `<Tooltip>`:

```tsx
<CartesianGrid {...CHART_GRID_PROPS} vertical={false} />
<XAxis dataKey="month" {...CHART_AXIS_PROPS} />
<YAxis {...CHART_AXIS_PROPS} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
<Tooltip content={<ChartTooltip />} />
```

For income bars, add a `<defs>` gradient and reference it:

```tsx
<defs>
  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#059669" stopOpacity={0.85} />
    <stop offset="100%" stopColor="#059669" stopOpacity={0.25} />
  </linearGradient>
  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#DC2626" stopOpacity={0.75} />
    <stop offset="100%" stopColor="#DC2626" stopOpacity={0.20} />
  </linearGradient>
</defs>
<Bar dataKey="income"   fill="url(#incomeGrad)"  radius={[4,4,0,0]} />
<Bar dataKey="expenses" fill="url(#expenseGrad)" radius={[4,4,0,0]} />
```

- [ ] **Step 4: Commit Cash Flow**

```bash
cd /home/zach/hive/frontend
git add src/app/cash-flow/
git commit -m "feat(design): redesign Cash Flow — emerald PageHero, gradient bar chart, styled tooltip"
```

#### 8B — Net Worth (`/net-worth`)

- [ ] **Step 5: Fully rewrite Net Worth page to use design system**

The current page uses raw `text-white`, `text-slate-*`, raw `<button>` without design system classes. Replace the entire file:

```tsx
"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, defs, linearGradient, stop } from "recharts";
import { api, type NetWorthSnapshot } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { ChartTooltip, CHART_GRID_PROPS, CHART_AXIS_PROPS } from "@/components/ChartTooltip";
import { cn } from "@/lib/utils";

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Range = 30 | 90 | 180 | 365;
const RANGES: { label: string; value: Range }[] = [
  { label: "30d",  value: 30  },
  { label: "90d",  value: 90  },
  { label: "180d", value: 180 },
  { label: "1yr",  value: 365 },
];

export default function NetWorthPage() {
  const [data,    setData]    = useState<NetWorthSnapshot[]>([]);
  const [range,   setRange]   = useState<Range>(90);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.netWorth
      .history(range)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range]);

  const latest   = data[data.length - 1];
  const earliest = data[0];
  const change   = latest && earliest ? latest.net_worth - earliest.net_worth : null;
  const pctChange = change && earliest ? (change / Math.abs(earliest.net_worth)) * 100 : null;

  const chartData = data.map((s) => ({
    date:        fmtShort(s.snapshot_date),
    "Net Worth": Math.round(s.net_worth),
    Assets:      Math.round(s.total_assets),
    Liabilities: Math.round(s.total_liabilities),
  }));

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Range selector */}
      <div className="flex items-center justify-between">
        <div /> {/* spacer */}
        <div className="flex gap-1">
          {RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150",
                range === value
                  ? "bg-sky-500/10 border border-sky-500/25 text-[#38BDF8]"
                  : "bg-elevated border border-white/[0.07] text-ink-secondary hover:text-ink-primary"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero */}
      {latest && (
        <PageHero
          eyebrow={`Net Worth · Last ${range} days`}
          headline={<span className="text-[#38BDF8]">{fmt(latest.net_worth)}</span>}
          subtext={
            change !== null && pctChange !== null
              ? `${change >= 0 ? "↑" : "↓"} ${fmt(Math.abs(change))} (${Math.abs(pctChange).toFixed(1)}%) over ${range} days`
              : undefined
          }
          glowColor="sky"
          statStrip={[
            { label: "Total Assets",      value: fmt(latest.total_assets),      color: "green"   },
            { label: "Total Liabilities", value: fmt(latest.total_liabilities), color: "red"     },
            { label: "Net Change",        value: change ? (change >= 0 ? "+" : "") + fmt(change) : "—", color: change && change >= 0 ? "green" : "red" },
            { label: "Period",            value: `${range}d`,                   color: "default" },
          ]}
        />
      )}

      {loading && (
        <div className="hive-card p-12 text-center">
          <p className="text-[13px] text-ink-tertiary">Loading net worth history…</p>
        </div>
      )}

      {error && (
        <div className="hive-card p-6 border-semantic-expense/20">
          <p className="text-[13px] text-semantic-expense">{error}</p>
        </div>
      )}

      {/* Area chart */}
      {!loading && chartData.length > 0 && (
        <div className="hive-card p-5">
          <p className="hive-label mb-4">Net Worth Over Time</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#38BDF8" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="assetsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#34D399" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#34D399" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID_PROPS} vertical={false} />
              <XAxis dataKey="date" {...CHART_AXIS_PROPS} />
              <YAxis {...CHART_AXIS_PROPS} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Assets"      stroke="#34D399" strokeWidth={1.5} fill="url(#assetsGrad)" dot={false} />
              <Area type="monotone" dataKey="Net Worth"   stroke="#38BDF8" strokeWidth={2}   fill="url(#nwGrad)"     dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && chartData.length === 0 && !error && (
        <div className="hive-card p-12 text-center">
          <p className="text-[14px] text-ink-secondary mb-1">No net worth data yet</p>
          <p className="text-[12px] text-ink-tertiary">Data populates after daily sync runs</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit Net Worth**

```bash
cd /home/zach/hive/frontend
git add src/app/net-worth/page.tsx
git commit -m "feat(design): fully rewrite Net Worth — sky PageHero, area chart with gradient, design system tokens"
```

#### 8C — Goals (`/goals`)

- [ ] **Step 7: Read current Goals page**

Read `frontend/src/app/goals/page.tsx` fully. Note the `Goal` type fields: `name`, `type`, `target_amount`, `current_amount`, `target_date`.

- [ ] **Step 8: Add PageHero + AnimatedBar to Goals**

```tsx
import { PageHero } from "@/components/PageHero";
import { AnimatedBar } from "@/components/AnimatedBar";

const GOAL_COLORS: Record<string, string> = {
  savings:     "linear-gradient(90deg, #059669, #34D399)",
  debt_payoff: "linear-gradient(90deg, #DC2626, #F87171)",
  purchase:    "linear-gradient(90deg, #B45309, #F5B942)",
  net_worth:   "linear-gradient(90deg, #0284C7, #38BDF8)",
};

// Hero:
{goals.length > 0 && (
  <PageHero
    eyebrow="Financial Goals"
    headline={<><span className="text-semantic-income">{goals.filter(g => g.current_amount / g.target_amount >= 1).length}</span><span className="text-ink-tertiary text-[22px] font-normal"> / {goals.length} complete</span></>}
    subtext="track progress toward your targets"
    glowColor="emerald"
    statStrip={[
      { label: "Active Goals",   value: String(goals.filter(g => g.is_active).length), color: "green" },
      { label: "Total Target",   value: fmt(goals.reduce((s, g) => s + g.target_amount, 0)), color: "default" },
      { label: "Total Progress", value: fmt(goals.reduce((s, g) => s + g.current_amount, 0)), color: "green" },
    ]}
  />
)}
```

In each goal card, replace the existing progress bar with:

```tsx
<AnimatedBar
  pct={(goal.current_amount / goal.target_amount) * 100}
  color={GOAL_COLORS[goal.type] ?? GOAL_COLORS.savings}
  height={6}
  delay={index * 80}
  className="mt-3"
/>
```

- [ ] **Step 9: Commit Goals**

```bash
cd /home/zach/hive/frontend
git add src/app/goals/page.tsx
git commit -m "feat(design): redesign Goals — emerald PageHero, AnimatedBar with goal-type color coding"
```

---

### Task 9 — Agent D: Anomalies + Subscriptions + Chat + Merchants + Reports + Settings

**Files:**
- Modify: `frontend/src/app/anomalies/page.tsx`
- Modify: `frontend/src/app/subscriptions/page.tsx`
- Modify: `frontend/src/app/chat/page.tsx`
- Modify: `frontend/src/app/merchants/page.tsx`
- Modify: `frontend/src/app/reports/page.tsx`
- Modify: `frontend/src/app/settings/page.tsx`
- Modify: `frontend/src/app/connect/page.tsx`
- Modify: `frontend/src/app/account/page.tsx`
- Modify: `frontend/src/app/security/page.tsx`

#### 9A — Anomalies (`/anomalies`)

- [ ] **Step 1: Read current Anomalies page**

Read `frontend/src/app/anomalies/page.tsx`. Note it uses raw `text-white`, `text-slate-500`, `bg-rose-500/10` — none of these are design system tokens.

- [ ] **Step 2: Rewrite Anomalies to use design system**

Replace the entire file:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api, type Anomaly } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ScoreBadge({ score }: { score: number }) {
  const pct    = Math.round(Math.abs(score) * 100);
  const isHigh = pct > 70;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border",
      isHigh
        ? "text-semantic-expense bg-semantic-expense/10 border-semantic-expense/25"
        : "text-semantic-warning bg-semantic-warning/10 border-semantic-warning/25"
    )}>
      {pct}% anomalous
    </span>
  );
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  useEffect(() => {
    api.anomalies
      .list("unreviewed")
      .then(setAnomalies)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleReview(id: string, status: "ok" | "confirmed") {
    setReviewing(id);
    try {
      await api.anomalies.review(id, status);
      setAnomalies((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      alert(`Review failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setReviewing(null);
    }
  }

  const highCount = anomalies.filter(a => Math.abs(a.anomaly_score) > 0.7).length;

  return (
    <div className="space-y-5 animate-fade-in">

      <PageHero
        eyebrow="Anomaly Review"
        headline={
          anomalies.length === 0
            ? <span className="text-semantic-income">All clear</span>
            : <><span className="text-semantic-expense">{anomalies.length}</span><span className="text-ink-tertiary text-[22px] font-normal"> to review</span></>
        }
        subtext={highCount > 0 ? `${highCount} high-severity flagged` : "Review flagged transactions"}
        glowColor="coral"
        statStrip={[
          { label: "High Severity",   value: String(highCount),                         color: highCount > 0 ? "red" : "green" },
          { label: "Medium Severity", value: String(anomalies.length - highCount),       color: "amber"   },
          { label: "Total Flagged",   value: String(anomalies.length),                  color: "default" },
        ]}
      />

      {loading && <div className="hive-card p-12 text-center"><p className="text-[13px] text-ink-tertiary">Loading anomalies…</p></div>}
      {error   && <div className="hive-card p-6"><p className="text-[13px] text-semantic-expense">{error}</p></div>}

      {!loading && anomalies.length === 0 && !error && (
        <div className="hive-card p-12 text-center">
          <CheckCircle className="w-10 h-10 text-semantic-income mx-auto mb-3 opacity-60" />
          <p className="text-[14px] text-ink-secondary font-medium">No anomalies to review</p>
          <p className="text-[12px] text-ink-tertiary mt-1">All transactions look normal</p>
        </div>
      )}

      <div className="space-y-3">
        {anomalies.map((a) => {
          const isHigh = Math.abs(a.anomaly_score) > 0.7;
          return (
            <GlassCard key={a.id} tint={isHigh ? "expense" : "none"} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0", isHigh ? "text-semantic-expense" : "text-semantic-warning")} />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink-primary truncate">
                      {a.transaction?.merchant ?? a.transaction?.raw_description ?? "Unknown"}
                    </p>
                    <p className="text-[12px] text-ink-tertiary font-mono mt-0.5">
                      {a.transaction ? fmtDate(a.transaction.date) : ""}
                      {a.transaction ? " · " + fmt(Math.abs(a.transaction.amount)) : ""}
                    </p>
                    <div className="mt-2">
                      <ScoreBadge score={a.anomaly_score} />
                    </div>
                    {a.reason && <p className="text-[12px] text-ink-tertiary mt-2 leading-relaxed">{a.reason}</p>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleReview(a.id, "ok")}
                    disabled={reviewing === a.id}
                    className="hive-btn-secondary text-[12px] py-1.5 px-3 disabled:opacity-40"
                  >
                    Looks OK
                  </button>
                  <button
                    onClick={() => handleReview(a.id, "confirmed")}
                    disabled={reviewing === a.id}
                    className="hive-btn-danger text-[12px] py-1.5 px-3 disabled:opacity-40"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit Anomalies**

```bash
cd /home/zach/hive/frontend
git add src/app/anomalies/page.tsx
git commit -m "feat(design): rewrite Anomalies — coral PageHero, GlassCard alerts, design system tokens (remove text-white/slate)"
```

#### 9B — Subscriptions (`/subscriptions`)

- [ ] **Step 4: Read current Subscriptions page**

Read `frontend/src/app/subscriptions/page.tsx` fully.

- [ ] **Step 5: Add header + total callout + price alert styling**

Add at the top of the JSX:

```tsx
import { PageHero } from "@/components/PageHero";
import { GlassCard } from "@/components/GlassCard";

const totalMonthly = subscriptions.reduce((s, sub) => s + (sub.detected_amount ?? 0), 0);
const priceChanges = subscriptions.filter(sub => sub.price_history?.length > 1);

{subscriptions.length > 0 && (
  <PageHero
    eyebrow="Subscriptions"
    headline={<span className="text-honey">{fmt(totalMonthly)}</span>}
    subtext={`per month · ${fmt(totalMonthly * 12)} per year`}
    glowColor="coral"
    statStrip={[
      { label: "Active",        value: String(subscriptions.filter(s => s.status === "active").length), color: "default" },
      { label: "Price Changes", value: String(priceChanges.length), color: priceChanges.length > 0 ? "red" : "green" },
      { label: "Annual Cost",   value: fmt(totalMonthly * 12), color: "amber" },
    ]}
  />
)}
```

For each subscription row with a price change, add a coral tint:

```tsx
<div className={cn(
  "hive-card p-4 flex items-center gap-4 transition-all duration-200",
  sub.price_history?.length > 1 && "border-semantic-expense/15 bg-semantic-expense/[0.02]"
)}>
```

- [ ] **Step 6: Commit Subscriptions**

```bash
cd /home/zach/hive/frontend
git add src/app/subscriptions/page.tsx
git commit -m "feat(design): redesign Subscriptions — coral PageHero, price change highlights"
```

#### 9C — Chat (`/chat`)

- [ ] **Step 7: Read current Chat page**

Read `frontend/src/app/chat/page.tsx`.

- [ ] **Step 8: Add violet ambient header and upgrade message bubbles**

Replace the page header section with a violet-glow header band:

```tsx
{/* Violet ambient header */}
<div className="relative overflow-hidden rounded-2xl border border-white/[0.05] px-6 py-5 mb-5"
  style={{ background: "linear-gradient(160deg, rgba(167,139,250,0.07) 0%, transparent 60%)" }}>
  <div aria-hidden className="pointer-events-none absolute -top-10 -left-6 w-48 h-32 rounded-full"
    style={{ background: "radial-gradient(ellipse, rgba(167,139,250,0.20) 0%, transparent 70%)" }} />
  <p className="relative text-[9px] font-bold tracking-[0.14em] uppercase text-[#A78BFA]">AI Financial Advisor</p>
  <h1 className="relative text-[24px] font-semibold tracking-tight text-ink-primary mt-1">Ask HIVE anything</h1>
  <p className="relative text-[13px] text-ink-tertiary mt-1">Powered by Claude · full financial context</p>
</div>
```

Update `MessageBubble` user bubble background:

```tsx
// User bubble (isUser === true):
className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap bg-honey/[0.10] border border-honey/18 text-ink-primary rounded-br-sm"

// AI bubble:
className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap bg-elevated border border-white/[0.06] text-ink-primary rounded-bl-sm"
```

Update AI avatar icon to violet-tinted:

```tsx
<div className="w-7 h-7 rounded-lg glass-card-violet flex items-center justify-center mr-2.5 mt-0.5 shrink-0">
  <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
</div>
```

- [ ] **Step 9: Commit Chat**

```bash
cd /home/zach/hive/frontend
git add src/app/chat/page.tsx
git commit -m "feat(design): redesign Chat — violet ambient header, updated message bubble colors, violet AI icon"
```

#### 9D — Merchants + Reports + Settings + Connect/Account/Security

- [ ] **Step 10: Read Merchants, Reports, Settings pages**

Read `frontend/src/app/merchants/page.tsx`, `frontend/src/app/reports/page.tsx`, `frontend/src/app/settings/page.tsx`.

- [ ] **Step 11: Apply design system token migrations to all remaining pages**

For each of these pages, perform these find-and-replace operations:

| Find | Replace |
|---|---|
| `text-white` | `text-ink-primary` |
| `text-slate-400` | `text-ink-secondary` |
| `text-slate-500` | `text-ink-tertiary` |
| `text-slate-600` | `text-ink-ghost` |
| `text-gray-400` | `text-ink-secondary` |
| `text-gray-500` | `text-ink-tertiary` |
| `bg-gray-800` | `bg-elevated` |
| `bg-gray-900` | `bg-surface` |
| `border-slate-700` | `border-white/[0.07]` |
| `border-gray-700` | `border-white/[0.07]` |
| `bg-rose-500/10` | `bg-semantic-expense/10` |
| `text-rose-400` | `text-semantic-expense` |
| `border-rose-500/30` | `border-semantic-expense/25` |
| `bg-amber-500/10` | `bg-semantic-warning/10` |
| `text-amber-400` | `text-semantic-warning` |

- [ ] **Step 12: Add sky-glow header to Merchants**

```tsx
<div className="relative overflow-hidden rounded-2xl border border-white/[0.05] px-6 py-5 mb-5"
  style={{ background: "linear-gradient(160deg, rgba(56,189,248,0.06) 0%, transparent 60%)" }}>
  <div aria-hidden className="pointer-events-none absolute -top-10 -left-6 w-48 h-32 rounded-full"
    style={{ background: "radial-gradient(ellipse, rgba(56,189,248,0.18) 0%, transparent 70%)" }} />
  <p className="relative text-[9px] font-bold tracking-[0.14em] uppercase text-[#38BDF8]">Merchants</p>
  <h1 className="relative text-[24px] font-semibold tracking-tight text-ink-primary mt-1">Spending by Merchant</h1>
</div>
```

Apply the same sky-glow header pattern to Reports page (change eyebrow color to `text-[#38BDF8]`).

- [ ] **Step 13: Read Connect, Account, Security pages and migrate tokens**

Read `frontend/src/app/connect/page.tsx`, `frontend/src/app/account/page.tsx`, `frontend/src/app/security/page.tsx`.

Apply the same token migration table from Step 11 to all three pages. Ensure all form fields use `hive-input` class, all buttons use `hive-btn-primary` / `hive-btn-secondary` / `hive-btn-danger`.

- [ ] **Step 14: TypeScript check**

```bash
cd /home/zach/hive/frontend && npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors that reference the changed components.

- [ ] **Step 15: Commit all utility page updates**

```bash
cd /home/zach/hive/frontend
git add src/app/anomalies/ src/app/subscriptions/ src/app/chat/ \
        src/app/merchants/ src/app/reports/ src/app/settings/ \
        src/app/connect/ src/app/account/ src/app/security/
git commit -m "feat(design): migrate all remaining pages to design system tokens — remove text-white/slate/gray/rose"
```

---

## BATCH 3 — QA Agent (run after ALL Batch 2 tasks complete)

---

### Task 10 — QA: Visual Consistency Audit + TypeScript Verification

**Files:** Read-only audit across all frontend files

- [ ] **Step 1: Full TypeScript compilation check**

```bash
cd /home/zach/hive/frontend && npx tsc --noEmit 2>&1
```

Expected: zero errors. Fix any errors found before proceeding.

- [ ] **Step 2: Scan for banned raw color tokens**

```bash
cd /home/zach/hive/frontend/src && grep -r "text-white\|text-slate-\|text-gray-\|bg-gray-\|bg-slate-\|border-slate-\|border-gray-" --include="*.tsx" -l
```

Expected: zero files. If any are found, read each file and apply the token migration table from Task 9 Step 11.

- [ ] **Step 3: Verify all chart pages use ChartTooltip**

```bash
cd /home/zach/hive/frontend/src && grep -rL "ChartTooltip" app/cash-flow/ app/net-worth/ app/points/ 2>/dev/null
```

Expected: zero files missing ChartTooltip. If any are missing, add the import and update the `<Tooltip content={<ChartTooltip />} />` usage.

- [ ] **Step 4: Verify all hero-eligible pages have PageHero**

```bash
cd /home/zach/hive/frontend/src && grep -rL "PageHero" app/page.tsx app/budgets/page.tsx app/cash-flow/page.tsx app/points/page.tsx app/net-worth/page.tsx app/goals/page.tsx app/anomalies/page.tsx 2>/dev/null
```

Expected: zero files missing PageHero.

- [ ] **Step 5: Verify AnimatedBar is used on budget + goal progress bars**

```bash
cd /home/zach/hive/frontend/src && grep -rL "AnimatedBar" app/budgets/page.tsx app/goals/page.tsx 2>/dev/null
```

Expected: zero files missing AnimatedBar.

- [ ] **Step 6: Verify TransactionDrawer is used on Transactions page**

```bash
cd /home/zach/hive/frontend/src && grep -l "TransactionDrawer" app/transactions/page.tsx
```

Expected: `app/transactions/page.tsx` (the file is found).

- [ ] **Step 7: Check backdrop-filter browser support note**

Verify that `globals.css` does NOT have `@supports` blocks disabling backdrop-filter — the app is self-hosted on desktop browsers that support it. No action needed unless you see an explicit disable.

- [ ] **Step 8: Build check**

```bash
cd /home/zach/hive/frontend && npm run build 2>&1 | tail -30
```

Expected: successful build, no TypeScript errors, no missing module errors.

- [ ] **Step 9: Commit QA fixes**

```bash
cd /home/zach/hive/frontend
git add -A
git commit -m "fix(design): QA pass — resolve remaining token migrations, TypeScript errors, missing component wires"
```

- [ ] **Step 10: Final summary**

Report back:
1. List of files that had banned tokens and were fixed
2. List of pages that were missing PageHero/AnimatedBar/ChartTooltip and were fixed
3. Any TypeScript errors found and fixed
4. Build result: pass or fail (with error if fail)

---

## Execution Summary

```
Batch 1 (sequential):      Tasks 1 → 2 → 3 → 4 → 5
Batch 2 (parallel):        Tasks 6, 7, 8, 9 (all run after Batch 1)
Batch 3 (QA, sequential):  Task 10 (runs after all of Batch 2)
```

**Dispatch pattern for subagent-driven-development:**
- Run Tasks 1-5 sequentially in Batch 1
- After Task 5 completes, dispatch Tasks 6/7/8/9 as 4 parallel subagents
- After all 4 Batch 2 agents complete, dispatch Task 10 (QA agent)
