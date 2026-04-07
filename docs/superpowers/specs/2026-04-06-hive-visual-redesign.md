# HIVE Visual Redesign — Design Spec
**Date:** 2026-04-06
**Status:** Approved
**Direction:** HIVE × Monarch — cool-dark background, Monarch-quality spacing/typography, honey amber brand accent retained

---

## 1. Design Direction

The existing "Obsidian Ledger" theme has strong brand bones (obsidian + honey) but suffers from:
- Warm brown backgrounds that feel terminal/hacker rather than premium consumer fintech
- Every page uses the same flat card grid — no visual hierarchy or personality
- Charts are unstyled default recharts
- Typography is too small and tight; no hero moments for key numbers
- Some pages (net-worth) still use raw Tailwind `text-white`/`text-slate-500` instead of the design system

**Solution:** Adopt Monarch Money's layout quality and spacing discipline while retaining HIVE's honey amber as a brand differentiator. The result looks premium, not generic.

---

## 2. Design System Token Changes

### 2.1 Color Palette — Replace warm obsidian with cool-dark

| Token | Old (Obsidian) | New (Cool-Dark) |
|---|---|---|
| `base` | `#090807` | `#0A0C10` |
| `surface` | `#100E0D` | `#0F1117` |
| `elevated` | `#181513` | `#161921` |
| `overlay` | `#1F1C1A` | `#1C2030` |
| `ink.primary` | `#F2EDE8` (warm) | `#F0F0F4` (neutral) |
| `ink.secondary` | `#A09888` | `#9CA3AF` |
| `ink.tertiary` | `#5E5850` | `#4B5063` |
| `ink.ghost` | `#3A3630` | `#374151` |

**Honey amber is unchanged** — `#F5B942` / `#FFD166` / `#C9920E`. This is the brand differentiator vs Monarch (purple) and Origin (blue).

### 2.2 Card Hierarchy — Three levels

```
surface-card    → background: #0F1117, border: rgba(255,255,255,0.05)
                   Used for: default content areas, transaction rows

glass-card      → background: rgba(255,255,255,0.03), backdrop-filter: blur(20px)
                   border: rgba(255,255,255,0.07), inset highlight
                   Used for: KPI tiles, account cards, hover-elevated content

glass-tinted    → tinted by semantic color (income/expense/amber/sky)
                   Used for: hero KPI tiles, stat callouts
                   Variants: income (emerald), expense (coral), points (amber), networth (sky)
```

### 2.3 Per-Page Ambient Glow System

Each page/section emits a characteristic radial gradient from the top-left of the page hero area, strength ~15–22% opacity:

| Pages | Glow Color | Hex |
|---|---|---|
| Dashboard, Points, Optimizer | Honey amber | `rgba(245,185,66,0.18)` |
| Cash Flow, Budgets, Goals | Emerald | `rgba(52,211,153,0.18)` |
| Anomalies, Subscriptions | Coral red | `rgba(248,113,113,0.18)` |
| Net Worth, Reports, Merchants | Sky blue | `rgba(56,189,248,0.18)` |
| Chat, AI Insights | Violet | `rgba(167,139,250,0.18)` |

Applied as a `radial-gradient` on the hero band's `::before` pseudo-element, not on the page background (avoids performance issues).

### 2.4 Typography Upgrades

- Page h1 headings: increase from `text-[22px]` → `text-[24px]`, weight stays 600
- Hero numbers: `text-[40px]` weight 800, tracking `-0.04em` — reserved for editorial hero bands
- KPI tile numbers: `text-[26px]` weight 700, tracking `-0.03em` (was `text-[28px]` weight 600 loose — tighter tracking at lower size reads larger and bolder)
- Body text: `#9CA3AF` (was `#A09888`) — cooler mid-gray matches new palette
- Labels: unchanged (`10px`, `0.10em` tracking, uppercase) — already good

### 2.5 Motion System

All animations use spring easing `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo), not linear.

| Animation | Trigger | Duration |
|---|---|---|
| `countUp` | KPI number mounts | 600ms, delay 100ms |
| `barGrow` | Progress/category bar mounts | 800ms, stagger 80ms per bar |
| `chartDraw` | Line chart mounts | 1200ms, stroke-dashoffset trick |
| `barRise` | Bar chart columns mount | 600ms, rise from baseline, stagger 60ms |
| `slideInRow` | Table rows mount | 200ms, stagger 30ms per row |
| `glowPulse` | Active alert/redemption badge | 2400ms infinite |
| `fadeSlideUp` | Page load (existing, keep) | 300ms |

---

## 3. Global Layout Changes

### 3.1 Sidebar

- Background: `#0C0A09` (old warm) → `#09090E` (cool-neutral, barely perceptible)
- Border: `rgba(245,185,66,0.07)` → `rgba(255,255,255,0.05)` (cooler, less amber tint on chrome)
- Nav item active state: keep honey — this is the brand moment
- Font size: increase nav labels from `12.5px` → `13px`
- Section labels: keep uppercase tracking style

### 3.2 Main Content Area

- Page padding: `p-6` → `p-7` (more breathing room, Monarch-like)
- Card gap: `gap-3` → `gap-4` across all page grids
- Card inner padding: `p-4` → `p-5` on primary cards
- Max content width: add `max-w-7xl mx-auto` wrapper to all pages

### 3.3 Editorial Hero Band Component

New shared component: `<PageHero>` used on: Dashboard, Cash Flow, Net Worth, Points, Goals.

```tsx
<PageHero
  eyebrow="Dashboard · April 2026"
  headline="$847"          // large number or key stat
  headlineAccent           // highlights number in honey
  subtext="safe to spend this week"
  glowColor="honey"        // honey | emerald | sky | coral | violet
  statStrip={[             // 3-4 stats shown below the number
    { label: "Net Cash", value: "$4,820", color: "green" },
    ...
  ]}
/>
```

Structure:
```
┌─────────────────────────────────────────┐
│  [glow radial]                          │
│  EYEBROW (9px uppercase honey)          │
│  $BIG NUMBER  (40px bold, honey accent) │
│  subtext (11px muted)                   │
├─────────────────────────────────────────┤
│  Stat 1 │ Stat 2 │ Stat 3 │ Stat 4     │  ← divided strip
└─────────────────────────────────────────┘
```

---

## 4. Per-Page Treatment

### 4.1 Dashboard `/`
- **Hero:** Safe-to-spend number (honey) with stat strip: Net Cash, Spent, Points Value, Savings Rate
- **KPI tiles:** Upgrade to `glass-tinted` cards (income=emerald, expense=coral, points=amber, networth=sky)
- **Account cards:** Keep current design, upgrade border to cool-dark system
- **Budget rows:** Thicker bars (5px up from 3px), animated `barGrow` on mount
- **Spend by category:** Bars grow in with stagger
- **Recent transactions:** `slideInRow` stagger on mount; first-letter avatar → emoji/icon
- **Points programs:** Keep, add redemption glow pulse on above-threshold rows
- **Ambient glow:** Honey

### 4.2 Transactions `/transactions`
- **Layout:** Monarch-style full-width table. Filter pills row at top (All / category chips / date range)
- **Rows:** Increase row height to `48px`, cleaner merchant icon (colored initial badge → category emoji)
- **Hover:** Row background `rgba(255,255,255,0.02)`, subtle right-arrow appears
- **Slide-in drawer:** New — tap any row to open a right-panel (replaces the existing inline category dropdown). Contains: merchant name + emoji, amount (large), category editor dropdown (same PUT `/api/transactions/{id}/category` call), points earned badge, similar transactions list (last 5 from same merchant)
- **Stagger:** First 10 rows `slideInRow` on page load
- **Ambient glow:** Neutral (no colored glow — this is a data table, not a hero page)

### 4.3 Budgets `/budgets`
- **Hero:** Emerald hero — "72% of budgets on track" with stat strip
- **Budget rows:** Bars thicker (6px), `barGrow` animation, over-budget bars pulse coral
- **Add budget:** Clean modal with category dropdown + amount input
- **Ambient glow:** Emerald

### 4.4 Cash Flow `/cash-flow`
- **Hero:** Emerald hero — net cash flow number for selected period
- **Chart:** Recharts `BarChart` — income bars use emerald gradient fill, expense bars use coral gradient fill; custom styled tooltip matching design system
- **Sankey:** Existing Sankey flow chart — upgrade node/link colors to match new palette
- **Drill-down modal:** Clean glass modal over page, category breakdown for clicked month
- **Ambient glow:** Emerald

### 4.5 Points `/points`
- **Hero:** Amber hero — total estimated dollar value with stat strip: programs count, 90-day earned, best card
- **Program cards:** Glass-tinted amber cards for each program; balance, earned, CPP value
- **Leakage section:** Coral-tinted callout cards showing missed earnings
- **Redemption nudge:** Honey glow-pulse badge when above threshold
- **Ambient glow:** Honey/amber

### 4.6 Net Worth `/net-worth`
- **Hero:** Sky hero — current net worth with delta vs prior period
- **Chart:** Recharts `AreaChart` with gradient fill under line (sky blue → transparent); currently uses raw `text-white`/`text-slate-500` — **fully migrate to design system**
- **Range tabs:** Replace plain `<button>` range selector with pill tabs matching design system
- **Ambient glow:** Sky blue

### 4.7 Merchants `/merchants`
- **Layout:** Card grid of top merchants (name, logo initial, YTD spend, visit count)
- **Merchant card hover:** Sky glow on hover
- **Detail page:** Per-merchant 12-month bar chart + transaction history
- **Ambient glow:** Sky blue

### 4.8 Reports `/reports`
- **Layout:** Left filter panel + right data table
- **Preset report chips:** Pill buttons — Annual Summary, YoY, Tax Export, etc.
- **Tables:** Clean rows with right-aligned numbers, totals row highlighted
- **CSV export button:** Secondary button with download icon
- **Ambient glow:** Sky blue

### 4.9 Goals `/goals`
- **Layout:** Card grid — each goal gets a card with name, progress bar (goal-colored), amount, on-track label
- **Progress bars:** 6px height, colored by goal type: savings=emerald, debt=coral, purchase=amber, investment=sky
- **What-if simulator:** Range slider input below goal card showing projected completion date
- **Ambient glow:** Emerald

### 4.10 Subscriptions `/subscriptions`
- **Layout:** List rows with service icon initial, name, amount, frequency, card used
- **Price change alert:** Row background tinted coral, price diff badge
- **Total callout:** Glass card at top — total monthly cost + annual projection
- **Ambient glow:** Coral (subtle — this page can feel alarming)

### 4.11 Anomalies `/anomalies`
- **Hero:** Coral hero — "{N} transactions to review"
- **Alert cards:** Coral-tinted glass cards; severity color (red=high, amber=medium)
- **Reviewed state:** Card fades to muted on confirm
- **Ambient glow:** Coral

### 4.12 Chat `/chat`
- **Hero strip:** Violet ambient glow, HIVE logo + "AI Financial Advisor" subtitle
- **Message bubbles:** User = honey-tinted; AI = surface glass with subtle border
- **AI avatar:** Small violet-tinted hex badge
- **Suggested prompts:** Pill chips that pre-fill input; rotated based on current financial data
- **Ambient glow:** Violet

### 4.13 Optimize `/optimize`
- **Layout:** Input form at top (category/amount) → ranked card list below
- **Best card:** Glass-tinted emerald card, gold star badge
- **Other cards:** Surface cards, muted
- **Ambient glow:** Honey

### 4.14 Settings `/settings`
- **Layout:** Section list — categorization rules, notifications, data management
- **Rules table:** Drag-to-reorder rows, toggle switches
- **No special glow** — neutral, functional

### 4.15 Connect `/connect`, Account `/account`, Security `/security`
- **Upgrade to design system** — these pages still use unstyled Tailwind
- **Connect:** Clean step-by-step Plaid link flow with honey CTA
- **Account/Security:** Form fields using `hive-input`, sections using surface cards

---

## 5. Chart Upgrade Spec

All Recharts instances get:

```tsx
// Shared chart theme
const CHART_THEME = {
  grid: { stroke: "rgba(255,255,255,0.04)", strokeDasharray: "none" },
  axis: { tick: { fill: "#4B5063", fontSize: 11 }, line: false },
  tooltip: {
    background: "#161921",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: "#F0F0F4",
    shadow: "0 8px 24px rgba(0,0,0,0.5)"
  }
}

// Gradient fills (define in <defs> per chart)
// income bars: from #059669 → rgba(5,150,105,0.3) top→bottom
// expense bars: from #DC2626 → rgba(220,38,38,0.2) top→bottom
// net worth area: from #38BDF8@0.3 → transparent top→bottom
// points line: from #F5B942@0.3 → transparent top→bottom
```

Bar chart columns animate: `barRise` (translateY from bottom, stagger 60ms).
Line/area charts animate: `stroke-dashoffset` from path length to 0, 1200ms.

---

## 6. New Shared Components

| Component | Description | Used By |
|---|---|---|
| `<PageHero>` | Editorial hero band with glow, eyebrow, big number, stat strip | Dashboard, Cash Flow, Net Worth, Points, Budgets, Goals, Anomalies |
| `<GlassCard>` | Glass morphism card variant with optional tint color | All pages |
| `<ChartTooltip>` | Styled recharts custom tooltip | All chart pages |
| `<FilterPills>` | Horizontal scrollable pill filter row | Transactions, Reports |
| `<TransactionDrawer>` | Slide-in right panel for transaction detail | Transactions |
| `<AnimatedBar>` | Progress bar with `barGrow` animation and color prop | Budgets, Goals, Dashboard |
| `<AnimatedNumber>` | Number that count-animates on mount using `requestAnimationFrame` (JS-driven, not CSS-only). Accepts `value: number`, `format: (n) => string`, `duration?: number`. | All KPI tiles |

---

## 7. What Does NOT Change

- The HIVE brand name, logo, and honeycomb mark
- The honey amber `#F5B942` brand accent
- The sidebar structure and navigation groups
- All API calls, data fetching, state management
- The `hive-input`, `hive-btn-primary`, `hive-btn-secondary` CSS classes (just color-update)
- The Tailwind config structure (extend the existing config, don't replace it)
- All Celery tasks, backend, Plaid integration

---

## 8. Implementation Approach

Work in parallel subagent batches:

**Batch 1 (Foundation — must complete first):**
- Update `tailwind.config.ts` — new color tokens
- Update `globals.css` — new card variants, component utilities, animation keyframes
- Create shared components: `PageHero`, `GlassCard`, `ChartTooltip`, `AnimatedBar`, `AnimatedNumber`

**Batch 2 (Pages — parallel after Batch 1):**
- Agent A: Dashboard + Optimizer + Points
- Agent B: Transactions (list + drawer) + Budgets
- Agent C: Cash Flow + Net Worth + Goals
- Agent D: Anomalies + Subscriptions + Chat + Merchants + Reports

**Batch 3 (QA — after all pages):**
- QA agent: visual consistency audit, TypeScript check, missing design system classes

---

## 9. Success Criteria

- Every page uses design system tokens (zero raw `text-white`, `text-slate-*`, `bg-gray-*`)
- Every page has its assigned ambient glow color
- Pages with heroes (`Dashboard`, `Cash Flow`, `Net Worth`, `Points`, `Budgets`, `Goals`, `Anomalies`) use `<PageHero>` component
- All recharts instances use the shared chart theme (no default gray grid lines)
- All progress bars use `<AnimatedBar>` with `barGrow` animation
- All KPI numbers use `<AnimatedNumber>` with `countUp` animation
- `npx tsc --noEmit` passes with no new errors
- App starts cleanly with `docker compose build frontend`
