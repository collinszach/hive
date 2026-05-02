# Hive App UI Redesign — Design Spec
**Date:** 2026-05-02
**Supersedes:** 2026-04-06-hive-visual-redesign.md
**Status:** Approved — execute immediately
**Scope:** All 25 `(app)/` pages + shared components + design system. No backend changes. No marketing pages (already redesigned 2026-05-02).

---

## 1. Design Direction

**Reference:** Origin (origin.co) + Monarch Money + MBB consultant brief.

The platform has strong bones but reads as a side project. Problems:
- Icon-only 52px sidebar is cryptic for a 25-page app
- Near-black #0B0C0F backgrounds feel heavy and aggressive
- Honey gold overused — loses its premium signal
- IBM Plex Sans has personality debt; Inter is neutral and legible
- No separation between interactive blue and brand gold

**Solution:** Layered cool-dark backgrounds, expanded 220px sidebar with section groups, Inter + Geist Mono typography split, blue as primary interactive, gold strictly reserved for rewards/points context.

---

## 2. Design System Tokens

### 2.1 Color Palette

Replace all existing `tailwind.config.ts` color tokens with:

```js
// tailwind.config.ts — colors extension
colors: {
  base:     '#13151A',   // sidebar, outermost shell
  surface:  '#1A1D24',   // main page background (content area)
  elevated: '#1F2229',   // primary card background
  overlay:  '#252830',   // elevated/hover card, nested cards, modals

  border: {
    DEFAULT: '#2A2D35',  // standard card borders, dividers
    strong:  '#3A3E4A',  // active elements, focus rings
    subtle:  '#22252E',  // very faint, within-card dividers
  },

  ink: {
    primary:   '#F0F2F5',
    secondary: '#9CA3AF',
    tertiary:  '#6B7280',
    ghost:     '#4B5563',
  },

  // Primary interactive (buttons, links, focus, selected nav states)
  blue: {
    DEFAULT: '#3B82F6',
    hover:   '#2563EB',
    faint:   'rgba(59,130,246,0.08)',
    subtle:  'rgba(59,130,246,0.05)',
    glow:    'rgba(59,130,246,0.22)',
    border:  'rgba(59,130,246,0.20)',
  },

  // Rewards/points context ONLY
  honey: {
    DEFAULT: '#F5B942',
    deep:    '#C9920E',
    bright:  '#FFD166',
    faint:   'rgba(245,185,66,0.08)',
    subtle:  'rgba(245,185,66,0.05)',
    glow:    'rgba(245,185,66,0.22)',
    border:  'rgba(245,185,66,0.18)',
  },

  income:  '#22C55E',
  expense: '#EF4444',
  warning: '#F59E0B',
  info:    '#3B82F6',
}
```

### 2.2 Typography

Replace IBM Plex Sans/Mono with **Inter** (UI) + **Geist Mono** (numbers).

```ts
// tailwind.config.ts — fontFamily
fontFamily: {
  sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
  mono:  ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
}
```

```tsx
// frontend/src/app/layout.tsx
import { Inter } from 'next/font/google';
import { Geist_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
// Apply both variables to <html> className
```

**Type scale:**
- Page title: 24px / 700 / Inter
- Section heading: 16px / 600 / Inter
- Card label: 11px / 500 / Inter / uppercase / tracking-[0.06em]
- Body: 14px / 400 / Inter
- Financial figure (hero): 36–40px / 700 / Geist Mono
- Financial figure (KPI tile): 24–28px / 600 / Geist Mono
- Table data (amounts): 13–14px / 400 / Geist Mono

**Rule:** Every dollar amount, percentage, and count uses `font-mono`. Every label, heading, and body text uses `font-sans`.

### 2.3 Card Styles (globals.css)

```css
.hive-card {
  background: #1F2229;
  border: 1px solid #2A2D35;
  border-radius: 10px;
  transition: background 150ms ease, border-color 150ms ease;
}
.hive-card:hover {
  background: #252830;
  border-color: #3A3E4A;
}
.hive-card-featured {
  background: #252830;
  border: 1px solid #3A3E4A;
  border-radius: 12px;
}
/* Use once per page — the primary KPI card */
.hive-card-hero {
  background: #252830;
  border: 1px solid rgba(59,130,246,0.20);
  border-radius: 12px;
}
/* Points/rewards context only */
.hive-card-rewards {
  background: #252830;
  border: 1px solid rgba(245,185,66,0.18);
  border-radius: 10px;
}
```

Remove: all `glass-card`, `glass-card-*` variants (replace uses with `.hive-card`).

### 2.4 Button Styles (globals.css)

```css
.hive-btn-primary {
  background: #3B82F6;
  color: #fff;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  transition: background 150ms ease;
}
.hive-btn-primary:hover { background: #2563EB; }

.hive-btn-secondary {
  background: transparent;
  border: 1px solid #3A3E4A;
  color: #F0F2F5;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
}
.hive-btn-secondary:hover { background: #252830; }

.hive-btn-ghost {
  background: transparent;
  color: #9CA3AF;
  border-radius: 6px;
  padding: 6px 12px;
}
.hive-btn-ghost:hover { background: rgba(255,255,255,0.05); color: #F0F2F5; }
```

### 2.5 Ambient Glow System

Each page hero section gets a radial gradient glow from top-left:

```css
/* Applied as inline style or via data-glow attribute on PageHero */
--glow-blue:    radial-gradient(ellipse 60% 40% at 20% -10%, rgba(59,130,246,0.14) 0%, transparent 70%);
--glow-green:   radial-gradient(ellipse 60% 40% at 20% -10%, rgba(34,197,94,0.14) 0%, transparent 70%);
--glow-amber:   radial-gradient(ellipse 60% 40% at 20% -10%, rgba(245,185,66,0.14) 0%, transparent 70%);
--glow-red:     radial-gradient(ellipse 60% 40% at 20% -10%, rgba(239,68,68,0.12) 0%, transparent 70%);
--glow-violet:  radial-gradient(ellipse 60% 40% at 20% -10%, rgba(167,139,250,0.14) 0%, transparent 70%);
```

Glow assignments:
- Blue: Dashboard, Net Worth, Reports, Merchants, Position
- Green: Budgets, Cash Flow, Income, Goals, Debt
- Amber: Points, Optimize (rewards context = honey/amber)
- Red: Anomalies, Subscriptions
- Violet: Chat, Insights, Plan

### 2.6 Animation Keyframes (globals.css)

```css
@keyframes countUp {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes barGrow {
  from { width: 0%; }
  to   { width: var(--bar-width); }
}
@keyframes barRise {
  from { transform: scaleY(0); transform-origin: bottom; }
  to   { transform: scaleY(1); }
}
@keyframes slideInRow {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

All animations use `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo).

---

## 3. Sidebar & Navigation

### 3.1 Sidebar Expansion

`Sidebar.tsx`: expand from 52px icon-only to **220px** always-visible on desktop.

```
Width: 220px (desktop), 0px (mobile — replaced by MobileNav)
Background: #13151A
Border-right: 1px solid #2A2D35
```

**Item anatomy:**
- Height: 36px per item
- Padding: `8px 12px`
- Layout: `16px icon` + `8px gap` + `13px/500w Inter label`
- Active: `background: rgba(59,130,246,0.10)`, `border-left: 2px solid #3B82F6`, label `#F0F2F5`
- Inactive: icon + label both `#6B7280`, hover → `#9CA3AF`, hover bg `rgba(255,255,255,0.04)`

**Section labels** (between nav groups):
- Font: 10px / 500 / uppercase / tracking-[0.08em]
- Color: `#4B5563`
- Margin: `20px 12px 4px` (top spacing to separate from previous group)

### 3.2 Navigation Structure (5 groups)

```
── Hive logo (24px hex icon + "HIVE" wordmark, 14px/700)

  Dashboard
  Chat

── MONEY IN / OUT
  Transactions
  Income
  Bills
  Subscriptions
  Cash Flow

── PLANNING
  Budgets
  Goals
  Debt
  Plan

── WEALTH
  Net Worth
  Position
  Reports
  Insights

── REWARDS
  Points
  Optimize

── [bottom-pinned, above avatar]
  Merchants
  Rules
  Anomalies
  Connect

── [bottom icons row]
  Search (⌘K)   Sync   Settings
  [Avatar circle with user initial]
```

Bottom-pinned items (Merchants, Rules, Anomalies, Connect) render above the icon row.

### 3.3 Main Content Area

With 220px sidebar:
- Desktop: `ml-[220px]` on main content wrapper (was `md:pl-[52px]`)
- Remove all `md:pl-[52px]` references
- Page inner padding: `p-6` (24px all sides)
- Max content width: `max-w-[1400px] mx-auto` on page wrapper
- Card gap: `gap-4`

---

## 4. Per-Page Treatments

### 4.1 Dashboard

**Glow:** Blue  
**Hero section:** PageHero with headline = safe-to-spend amount (large, Geist Mono, blue-tinted), stat strip: Net Cash | Monthly Spend | Points Value | Savings Rate  
**Layout:** 3-col grid at ≥1280px (left 30% / center 40% / right 30%), 2-col at 1024px, 1-col mobile  
- Left col: budget gauges + linked accounts
- Center col: spending area chart (last 6 months, blue gradient fill) + recent transactions
- Right col: net worth sparkline + anomaly alerts + top insights

### 4.2 Transactions

**Glow:** None (data table — no glow)  
**Layout:** Full-width table. Filter pills row (categories, date range).  
**Rows:** 44px height. Columns: merchant | category badge | account | amount (Geist Mono) | date  
**Hover:** `rgba(255,255,255,0.025)` row bg  
**Row entry:** `slideInRow` animation, first 15 rows staggered 20ms each  

### 4.3 Budgets

**Glow:** Green  
**Hero:** Stat strip — budgets on track / total budgeted / total spent  
**Bars:** 6px height, animated `barGrow`, over-budget → `#EF4444`, warning (80–100%) → `#F59E0B`, healthy → `#22C55E`

### 4.4 Bills

**Glow:** Red (urgency)  
**Layout:** Sorted by urgency (days until due). Overdue → expense red row tint.

### 4.5 Cash Flow

**Glow:** Green  
**Chart:** Recharts AreaChart — income area `#22C55E` fill gradient, expense area `#EF4444` fill gradient  
**Net line:** Bold `#3B82F6` line

### 4.6 Position (Credit Card Positions)

**Glow:** Blue  
**Layout:** Card grid — one `hive-card` per credit card, balance due, minimum, auto-pay status badge

### 4.7 Income

**Glow:** Green  
**Layout:** PageHero with total monthly income. Source breakdown bars. Forecast section.

### 4.8 Points

**Glow:** Amber (rewards context — use honey gold here)  
**Program cards:** `hive-card-rewards` (gold border). Balance in Geist Mono, gold.  
**Redemption nudge:** Gold pulse animation on cards above threshold  

### 4.9 Optimize

**Glow:** Amber  
**Best result card:** `hive-card-rewards` with gold border  
**Input fields:** `hive-input` + `hive-select`  

### 4.10 Net Worth

**Glow:** Blue  
**Chart:** Recharts AreaChart, line `#3B82F6`, fill gradient `rgba(59,130,246,0.15)` → transparent  
**Hero number:** Large Geist Mono, blue-tinted  

### 4.11 Insights

**Glow:** Violet  
**Cards:** Insight cards sorted by priority — `hive-card` with left border colored by severity  

### 4.12 Reports

**Glow:** Blue  
**Layout:** Filter panel (left 240px) + data area (right)  
**Tables:** right-aligned Geist Mono amounts, totals row `hive-card-featured`  

### 4.13 Anomalies

**Glow:** Red  
**Cards:** `hive-card` with `border-expense` tint on high-severity items  

### 4.14 Merchants

**Glow:** Blue  
**Layout:** 4-col card grid, merchant initial circle, YTD spend (Geist Mono), visit count  

### 4.15 Debt

**Glow:** Red  
**Bars:** Debt payoff progress, red bars animated `barGrow`  

### 4.16 Goals

**Glow:** Green  
**Cards:** Progress bars colored by goal type: savings=green, purchase=amber, debt=red  

### 4.17 Subscriptions

**Glow:** Red  
**Price change rows:** `border-expense` left border accent  

### 4.18 Plan

**Glow:** Violet  
**Charts:** Recharts AreaChart, violet fill  

### 4.19 Chat

**Glow:** Violet  
**User messages:** `rgba(59,130,246,0.12)` bubble tint  
**AI messages:** `hive-card` surface  

### 4.20 Connect / Account / Security / Settings / Rules / Review

**No glow.** Apply `hive-card`, `hive-input`, `hive-btn-primary/secondary` — replace all raw Tailwind color classes.

---

## 5. Chart Theme (All Recharts Instances)

```tsx
// src/components/ChartTooltip.tsx — already exists, update styles
const tooltipStyle = {
  background: '#1F2229',
  border: '1px solid #3A3E4A',
  borderRadius: 10,
  color: '#F0F2F5',
  fontFamily: 'var(--font-geist-mono)',
  fontSize: 13,
}

// Shared grid/axis props — already defined in ChartTooltip.tsx as CHART_GRID_PROPS / CHART_AXIS_PROPS
// Update to:
CHART_GRID_PROPS = { stroke: '#2A2D35', strokeDasharray: '0', vertical: false }
CHART_AXIS_PROPS = { tick: { fill: '#6B7280', fontSize: 11, fontFamily: 'var(--font-inter)' }, axisLine: false, tickLine: false }
```

**Gradient defs** (added to each chart's `<defs>`):
- `blueArea`: `#3B82F6` 30% opacity → 0% (top→bottom)
- `greenArea`: `#22C55E` 30% opacity → 0%
- `amberArea`: `#F5B942` 30% opacity → 0%
- `redArea`: `#EF4444` 20% opacity → 0%

---

## 6. Shared Components — Changes

| Component | Change |
|---|---|
| `Sidebar.tsx` | Full rewrite: 220px, section groups, Inter labels, blue active state |
| `PageHero.tsx` | Update: ambient glow prop, Geist Mono hero number, Inter labels |
| `GlassCard.tsx` | Replace with `hive-card` wrapper (keep same props API) |
| `AnimatedBar.tsx` | Update: use `barGrow` keyframe, accept color prop (green/amber/red/blue) |
| `ChartTooltip.tsx` | Update CHART_GRID_PROPS, CHART_AXIS_PROPS, tooltip style |
| `MobileNav.tsx` | Update active state to blue, match new icon sizing |

**New component — `AnimatedNumber.tsx`:**
```tsx
// src/components/AnimatedNumber.tsx
// Counts up from 0 to value over `duration`ms using requestAnimationFrame
// Props: value: number, format: (n: number) => string, duration?: number (default 600)
// Used for all hero KPI numbers
```

---

## 7. Files In Scope

**Modify:**
- `frontend/src/app/layout.tsx` — Inter + Geist Mono fonts
- `frontend/tailwind.config.ts` — new color tokens, fontFamily
- `frontend/src/app/globals.css` — new card/button/animation classes
- `frontend/src/app/(app)/layout.tsx` — sidebar width adjustment (`ml-[220px]`)
- `frontend/src/components/Sidebar.tsx` — full rewrite
- `frontend/src/components/PageHero.tsx` — glow + typography update
- `frontend/src/components/GlassCard.tsx` — → hive-card wrapper
- `frontend/src/components/AnimatedBar.tsx` — color prop + keyframe
- `frontend/src/components/ChartTooltip.tsx` — new CHART_GRID_PROPS/CHART_AXIS_PROPS
- `frontend/src/components/MobileNav.tsx` — active state update
- All 25 `frontend/src/app/(app)/*/page.tsx` files — apply design system

**Create:**
- `frontend/src/components/AnimatedNumber.tsx`

**Not touched:**
- Marketing pages (`(marketing)/`) — already redesigned
- All backend files
- API client (`lib/api.ts`)
- Test files

---

## 8. Success Criteria

- Zero raw `text-white`, `text-slate-*`, `bg-gray-*`, `bg-black` in app pages
- All dollar amounts and percentages use `font-mono`
- All page labels/headings use `font-sans` (Inter)
- Sidebar is 220px with section groups on desktop
- Primary CTA buttons are blue, not honey (except on Points/Optimize pages)
- All Recharts instances use shared grid/axis/tooltip theme
- `npx tsc --noEmit` passes with no new errors
- App builds: `cd frontend && npm run build` succeeds
