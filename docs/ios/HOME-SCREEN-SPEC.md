# HIVE iOS — Home Screen Build-Out Spec

> Epics for expanding the **Home** tab (`Features/Dashboard/DashboardView.swift`) from
> today's four blocks into the app's command center. Grounded in the Swift source as it
> stands and the **backend endpoints that already exist but aren't surfaced**.
>
> Sizing: **S** < 1d · **M** 1–3d · **L** 3–5d · **XL** 1wk+.
> Priority: **P0** keystone · **P1** high-value · **P2** polish/stretch.
> Status: 🔲 not started · 🚧 partial · ✅ done. Drafted **2026-06-03**.

---

## Where Home is today

`GET /api/dashboard/summary` → four blocks, top-to-bottom:

1. **Spend hero** — raw total spent this month (one number).
2. **Anomaly nudge** — count of flagged transactions (only if > 0).
3. **Top categories** — horizontal bar chart.
4. **Accounts** — flat list of balances.

It answers *"how much did I spend?"* It does **not** answer the three questions a person
actually opens a finance app for:

- **Am I okay?** (can I spend, am I on track, is my net worth rising)
- **What needs me?** (overspend pace, a bill due, an odd charge, points to redeem)
- **What's happening?** (cash flow, trends, goals)

## What the backend already gives us (unused on Home)

| Endpoint | Returns | Today |
|---|---|---|
| `GET /api/dashboard/safe-to-spend` | `safe_to_spend`, `color` (green/amber/red), `breakdown` (income, spent, bills, goal savings), `days_remaining` | ❌ unused |
| `GET /api/dashboard/health-score` | composite `score` 0–100, `grade` A–F, `factors[]` | ❌ unused |
| `GET /api/dashboard/pace-alerts` | per-category `projected_spend` vs `budget`, `over_by`, `severity` | ❌ unused |
| `GET /api/dashboard/weekly-comparison` | this vs last week totals, `delta_pct`, daily series | ❌ unused |
| `GET /api/subscriptions/upcoming?days=` | bills with `next_expected`, days away | ❌ unused |
| `GET /api/net-worth/history` | daily net-worth snapshots | only on Insights |
| `GET /api/points/summary` + `/thresholds` | program balances + redemption thresholds | only on Plan |
| `GET /api/goals` | goals + progress | not on Home |
| `GET /api/income/summary` | monthly income roll-up | not on Home |

**Implication:** most of the build-out is iOS composition over endpoints that already
ship. Only Epic H8 proposes a new backend aggregate (a latency optimization, not a blocker).

---

## How it should look — target information architecture

A single scroll, ordered by *urgency then context*, with a staggered entrance cascade
(`hiveEntrance(n)`) leading the eye top-down. Design language unchanged: OLED base
`#0A0C10`, `hive-card` at 12px radius, **amber/honey `#F5B942` for the brand/rewards
accent, blue reserved for planning/forecast** — never honey on a planning surface. Money
in `.hiveMono` tabular figures.

```
┌─────────────────────────────────────────────┐
│  Good morning, Zach            🔍  ⊕         │  H7  greeting + quick actions
│                                               │
│  ┌───────────────────────────────────────┐   │
│  │  SAFE TO SPEND · 12 days left         │   │  H1  keystone hero
│  │   $1,240         ● green               │   │      (color-coded)
│  │   income − spent − bills − goals       │   │
│  └───────────────────────────────────────┘   │
│                                               │
│  ⚠ Needs your attention                       │  H2  attention feed
│  • Dining will run $80 over budget            │      (only what's actionable,
│  • Geico $142 due in 3 days                   │       prioritized, dismissible,
│  • Unusual $310 charge at …                   │       deep-links to the right tab)
│  • 61k Chase UR — time to redeem              │
│                                               │
│  This month                          ▸        │  H3  month at a glance
│  ┌─ spend vs budget ─┐ ┌─ vs last wk ─┐       │      (budget ring, weekly spark,
│  │   68%  ◔          │ │  ▁▂▅▃ −12% │       │       income vs spend)
│                                               │
│  Net worth            $184,210  ▲ 2.1% ▸      │  H4  net-worth pulse (mini chart)
│  ╱╲___╱──╱                                     │
│                                               │
│  Top categories                               │  (existing, restyled as ranked rows)
│  Accounts        cash · cards · investments   │  H5  grouped + subtotaled
│  Goals           Emergency fund  72% ▸        │  H6  goals + points glance
└─────────────────────────────────────────────┘
```

Sections render only when they have data; each loads independently so one slow/failed
call never blanks the screen (Epic H0).

---

## Epics

### H0 — Home composition engine `M` · P0 · 🔲
**The enabler.** Today Home awaits one endpoint. The build-out fans out to ~6. Refactor
`DashboardViewModel` from a single `LoadState<DashboardSummary>` to a set of independent
per-section `LoadState`s loaded concurrently (`async let` / task group), so each section
shows its own skeleton, empty, or error state and the page never blocks on the slowest call.
- **Looks like:** identical chrome (`Screen` scaffold, pull-to-refresh) but sections appear
  as they resolve, each with its own `SkeletonBlock`.
- **Does:** parallel load; per-section retry; a section with no data hides itself; one
  401 still routes to `app.handleSessionExpired()`.
- **Native:** keep `@Observable` MVVM; one `load()` kicks off all section fetches; expose
  `sectionState.<name>`; reuse `LoadStateView` per block.
- **DoD:** pulling to refresh re-runs all sections; killing one endpoint (e.g. points) leaves
  the rest of Home fully functional.

### H1 — Safe-to-Spend hero `M` · P0 · 🔲
Replace the raw "Spent · June" number with the **one actionable number**: what's safe to
spend for the rest of the month. This is the keystone — the reason to open the app.
- **Shows:** big `MoneyHero` of `safe_to_spend`, a colored status dot (green/amber/red from
  the API), `days_remaining` label ("12 days left"), and a one-line formula caption.
- **Looks like:** the existing hero lift treatment, but the dot + a thin track conveying
  burn-down. Tap → a breakdown sheet (income − spent − upcoming bills − goal savings, each a
  row from `breakdown`).
- **Does:** `GET /api/dashboard/safe-to-spend`; tap opens breakdown; respects money rules
  server-side (transfers/pending already excluded).
- **Keep:** total-spent is demoted into the breakdown sheet, not lost.
- **DoD:** number + color match the API; breakdown sums correctly; graceful when income is
  unknown (shows "Set income" CTA → Plan/Forecast income).

### H2 — Attention feed `L` · P0 · 🔲
A single prioritized, **dismissible** stack of only-what's-actionable cards. Replaces the
lone anomaly nudge with a ranked feed merging four sources:
1. **Pace alerts** — "Dining projected $80 over budget" (`/api/dashboard/pace-alerts`,
   severity warning/danger).
2. **Bills due soon** — "Geico $142 in 3 days" (`/api/subscriptions/upcoming?days=7`).
3. **Anomalies** — "Unusual $310 charge at …" (already in summary; link to Insights queue).
4. **Redemption nudges** — "61k Chase UR — over your redeem threshold" (`/api/points/summary`
   + `/thresholds`; honey accent allowed here — it's a rewards item).
- **Looks like:** compact rows with a leading severity glyph/tint, title, one-line detail,
  chevron. Danger = `Theme.expense`, warning = `Theme.warning`, info = `Theme.blue`,
  rewards = honey. Swipe-to-dismiss; "nothing needs you" calm empty state.
- **Does:** each row deep-links to the right tab (`NotificationRouter`); dismissals persist
  per-item for the day (UserDefaults), so it doesn't nag.
- **Ordering:** danger → due-soonest bills → anomalies → nudges. Cap at ~5 with "show all".
- **DoD:** all four sources merge, sort, dedupe; tapping routes correctly; dismiss sticks
  across relaunch within the day.

### H3 — This month at a glance `L` · P1 · 🔲
A two-/three-up row of compact "stat tiles" giving the month's shape at a glance.
- **Tiles:**
  - **Spend vs budget** — a ring at `spent / total_budget` %, amber as it approaches 100.
    (`/api/budgets` sum + dashboard spend.)
  - **This week vs last** — a 7-bar sparkline + `delta_pct` with up/down tint
    (`/api/dashboard/weekly-comparison`).
  - **Income vs spend** — net cash flow this month, green/red (`/api/income/summary` +
    spend). Hidden if income unknown.
- **Looks like:** equal-width `Card` tiles in an `HStack`/grid, each a label + figure +
  micro-viz. Tap a tile → its full screen (Plan budgets / Money / Insights).
- **DoD:** tiles compute correctly, degrade individually (a tile with no data drops out),
  numbers reconcile with the source screens.

### H4 — Net-worth pulse `M` · P1 · 🔲
Bring the net-worth trend onto Home as a glanceable pulse (full chart stays on Insights).
- **Shows:** current net worth `MoneyText`, period delta (▲/▼ % over 30d), and a small
  sparkline `Chart` from `/api/net-worth/history?days=30`.
- **Looks like:** a slim card; line in `Theme.blue` (planning/position context, not rewards),
  delta tinted income/expense. Tap → Insights net-worth detail.
- **DoD:** delta sign/percent correct vs history; empty when < 2 snapshots; no honey.

### H5 — Accounts, grouped & subtotaled `M` · P1 · 🔲
Upgrade the flat accounts list into grouped sections with subtotals.
- **Shows:** three groups — **Cash** (depository), **Cards** (credit, balance shown as owed),
  **Investments** (brokerage/SnapTrade) — each with a subtotal header. Savings flagged
  **balance-only** (no spend), per business rules.
- **Looks like:** `GroupedCard` per group with a subtotal in the section header; card rows get
  a subtle `card_slug` color accent (honey allowed — card/rewards context). Negative/owed
  balances tinted `Theme.expense`.
- **Does:** tap an account → existing `AccountDetailView`.
- **DoD:** subtotals sum per group; credit balances read as liabilities in any net figure;
  matches Connect's account list.

### H6 — Goals & points glance `M` · P2 · 🔲
A light footer pair: closest-to-done goal and top points balance.
- **Shows:** top 1–2 goals with a progress bar + "72% · $3.6k of $5k" (`/api/goals`);
  the highest points program balance with a redeem chip if over threshold.
- **Looks like:** goal bars in `Theme.blue`; points in honey. Tap → goal detail / Plan→Points.
- **DoD:** progress math correct; hides when no goals/points; redeem chip only over threshold.

### H7 — Greeting & quick actions `S` · P2 · 🔲
Make Home feel personal and launch-y.
- **Shows:** time-of-day greeting with the user's first name; a top action row — **Add
  transaction**, **Optimize card** (which card to use), **Search** (already present).
- **Looks like:** a slim header above the hero; actions as small pill/icon buttons.
- **Does:** Add → `AddTransactionView`; Optimize → `CardOptimizerView`; Search → existing
  `GlobalSearchView`.
- **DoD:** greeting changes by time; each action opens its sheet; VoiceOver-labeled.

### H8 — (Stretch) Consolidated home endpoint + health score `M` · P2 · 🔲
Two optional upgrades once the screen settles:
- **`GET /api/dashboard/home`** — one aggregate that bundles safe-to-spend + pace + weekly +
  upcoming bills + net-worth delta, so Home is one round-trip instead of six (the per-section
  fan-out from H0 still drives the UI; this just reduces latency/battery on cell).
- **Financial health score** — surface `/api/dashboard/health-score` as an A–F grade ring
  with tappable factors (savings rate, budget adherence, etc.). Could anchor a "Snapshot"
  detail reachable from the hero.
- **DoD:** aggregate matches the individual endpoints field-for-field; health ring grade/
  color match the API; no new business logic in the client.

---

## Suggested build order

1. **H0** (engine) — unblocks everything; do first.
2. **H1** (safe-to-spend hero) — highest single-item value; the new anchor.
3. **H2** (attention feed) — turns Home from passive to actionable.
4. **H3 + H4** (glance tiles + net-worth pulse) — context layer.
5. **H5** (grouped accounts) — quality upgrade to what's already there.
6. **H6 / H7 / H8** — personalization, polish, and the latency/health stretch.

H0→H2 alone (≈1 week) transforms Home from a spend report into a command center, entirely on
existing backend endpoints — no migration, no deploy beyond shipping the app.

## Constraints carried from CLAUDE.md / design system

- **Money correctness:** Venmo/Zelle/Cash App always excluded; pending excluded from spend;
  savings is balance-only. All four source endpoints already enforce this server-side — the
  client must not re-derive spend.
- **Color discipline:** honey/`#F5B942` only for brand/rewards/cards/points; **blue** for
  planning, forecast, net-worth/position. Never honey on a planning surface.
- **Pattern:** `APIClient` actor + `LoadState` + `@Observable` MVVM; `Card`/`GroupedCard`/
  `MoneyHero`/`MoneyText`; `hiveEntrance(n)` cascade; pull-to-refresh via `Screen`.
