# HIVE iOS Mobile-Readiness Audit (Epic 2)

> Per-screen audit of all 31 HIVE routes for iOS Capacitor parity. Generated 2026-05-30.
> Each screen was read at source level and scored against IOS-BUILD-SPEC.md §6 + DESIGN-MOBILE.md.
> **Bucket:** `reflow-only` (CSS/state fixes, structure already mobile-shaped) vs `redesign` (structural rework or a functional WebView blocker).
> **Effort:** S (<½ day) · M (½–1.5 day) · L (2+ days).

## Triage summary

| Bucket | Count | Screens |
|---|---|---|
| reflow-only | 7 | bills, income, position, review, security, /, privacy |
| redesign | 24 | account, anomalies, billing, budgets, cash-flow, chat, connect, dashboard, debt, goals, insights, merchants, net-worth, optimize, plan, points, reports, rules, settings, subscriptions, transactions, login, register, pricing |

| Effort | Count |
|---|---|
| S | 7 |
| M | 14 |
| L | 10 |

## The blockers that actually break functionality (not polish)

These are `FAIL`s where the feature does not work at all inside WKWebView. All trace to **Epic 5 (OAuth/external-nav round-trips)** or a native-bridge gap. Fix these before the app is usable on device:

1. **Auth is dead in-app.** `/login` + `/register` use `<a href="/api/auth/google">` — Google returns `disallowed_useragent` inside WKWebView and refuses sign-in. Must move to `@capacitor/browser` (ASWebAuthenticationSession) + `@capacitor/app` deep-link return. **Nothing else matters until this is fixed** — it's the entry point.
2. **Account linking is dead.** `/connect` (Plaid OAuth) and SnapTrade (`window.location.href`) navigate the WebView out with no return path.
3. **Billing is dead.** `/billing` + `/pricing` open Stripe checkout/portal via `window.location.href` — strands the user on Stripe with no back. Also raises **Apple IAP guideline 3.1.1** (web purchase of digital subscriptions may require StoreKit).
4. **CSV export silently no-ops.** `/reports` uses `document.createElement("a").click()` on a Blob URL — must route through `@capacitor/share`.
5. **Chat input is unusable.** `/chat` composer uses `100vh` + no `@capacitor/keyboard` listener — the soft keyboard covers the input with no resize.

## Cross-cutting fixes (one change, many screens)

Resolve these globally before per-screen work — each retires FLAGs across nearly every route:

- **Safe-area (almost every app screen):** `(app)/layout.tsx:21` uses `pb-16` (fixed 64px), not `env(safe-area-inset-bottom)`. Change to `pb-[calc(4rem+env(safe-area-inset-bottom))]`. `MobileNav` already handles its own inset correctly.
- **Touch targets (almost every app screen):** `.hive-btn-*`, `.hive-input`, `.hive-select` in `globals.css` render ~28–34pt. Add a mobile `min-height:44px` in the global layer rather than per-screen.
- **Hover-only affordances (pervasive):** `hover:` states with no `active:`/`focus-visible:` give zero tap feedback on iOS. Establish a global `active:` press pattern for cards, icon buttons, and nav.
- **Loading states:** many screens render text `"Loading…"` or a `Loader2` spinner instead of layout-matched skeletons.
- **Gold-is-rewards-only violations:** `/account` (MFA warning), `/plan` (forecast line), `/subscriptions` (cost value), `/rules` (category text), `/settings` (DataTab hover) misuse `text-honey`/`#F5B942` outside a reward context.
- **IA gaps:** `/debt` is missing from `MobileNav`; `/insights` and `/goals` are buried in the "More" overflow — promote per the spec tab map (Home·Money·Plan·Insights·Connect).
- **Apple compliance:** `/settings` has **no account-deletion path** (guideline 5.1.1 requires one in-app).

---

## Per-screen punch list

### Home / Money tabs

#### `/` dashboard — redesign · M
Primary money surface. Hero-metric strip, budget dials, balances, anomaly + points cards. Sub-44pt targets, hover-only card affordances, spinner loads, safe-area gap. Adapt: skeletons, 44pt, active states; keep the one-dominant-number hierarchy.

#### `/transactions` — redesign · L
Dense desktop table is the core offender — needs full stacked-card reflow with swipe/sheet for inline categorization (no hover row actions on touch). Filters → bottom sheet. Highest-traffic screen; do it right.

#### `/budgets` — redesign · M
Budget gauges + category rows. Reflow grid to single column, gauges to full-width, inline edit → sheet, 44pt, skeletons.

#### `/optimize` — redesign · M
Card optimizer (use-at-checkout). The decision screen — must be one-tap fast. Reflow input row, ranked-card list to stacked cards, 44pt on the category/amount controls.

#### `/cash-flow` — redesign · L
Chart-heavy. Recharts hover tooltips unreachable on touch (tap-to-reveal needed); fixed chart widths; dense flow table. Structural chart rework.

#### `/merchants` — redesign · M
Merchant breakdown list + chart. Stacked reflow, touch tooltips, 44pt.

#### `/subscriptions` — redesign · M
Recurring-charge list. **Misuses `text-honey` on a cost value** (gold = rewards only). Stacked reflow, 44pt, skeletons.

#### `/bills` — reflow-only · S
Structurally mobile-ready (stacked rows, no fixed widths, no hover-gated actions). Fixes: per-section skeletons, safe-area bottom padding, 44pt on 30d/60d/90d selector + "Edit →".

#### `/debt` — redesign · M
Debt payoff view. Charts + schedule. **Missing from MobileNav.** Touch tooltips, stacked reflow, IA promotion.

#### `/position` — reflow-only · S
SnapTrade holdings, already stacked `divide-y` rows. Fixes: 44pt on Settled/Unsettle + MonthPicker arrows, skeleton, safe-area.

#### `/review` — reflow-only · S
Read-only month scorecard. Fixes: replace `hover:` pressed states with `active:`; bar-chart tooltip-as-data → visible `LabelList`; 44pt on MonthPicker + "Review Now".

#### `/reports` — redesign · L
Worst table density: multiple 5-col grids + `<table>`s, no reflow. Calendar heatmap is 11px cells with `onMouseEnter`-only tooltips. **CSV download is a no-op in WebView (FAIL → @capacitor/share).** Recharts hover tooltips. Big job.

#### `/net-worth` — redesign · M
Balance-over-time chart. Touch tooltips, fixed chart width, safe-area, skeletons.

#### `/income` — reflow-only · S
Already close to mobile shape. Fixes: 44pt, safe-area, active states, skeleton.

### Plan tab

#### `/plan` — redesign · M
4-tab switcher (`w-fit`) overflows iPhone SE; `grid-cols-2 sm:grid-cols-3` orphans the 3rd stat card; spinner-only loads (not skeletons); Recharts hover tooltips; **gold misused on forecast line**; sub-44pt delete + horizon toggles. Adapt: scrollable pill tabs, skeletons, touch tooltips, 44pt.

#### `/goals` — redesign · M
`GoalModal` is a centered desktop overlay → convert to bottom sheet (grabber, drag-dismiss, keyboard-aware). Icon action buttons ~24pt. **Not in MobileNav** — promote into Plan tab.

#### `/anomalies` — redesign · M
ML-flagged review queue. Hover row actions → swipe/sheet; inline review controls; 44pt; skeletons.

### Insights tab

#### `/insights` — redesign · M
**Icon action buttons (mark-read/dismiss) are hover-only → invisible on touch (FAIL).** Header action strip won't wrap on SE. **Buried in "More" — promote to its own tab.** Card structure, skeletons, empty state already good.

#### `/chat` — redesign · L
**Keyboard coverage FAIL** (`100vh` + no `@capacitor/keyboard`; needs `100dvh` + resize listener). Composer has no `env(safe-area-inset-bottom)`. `CopyButton` is `opacity-0 group-hover` → silently gone on touch. `FloatingChat` uses fixed 380×520px panel that overflows SE and conflicts with the tab-bar IA. Largest single-screen job.

### Connect tab + Settings / Account

#### `/connect` — redesign · L
**Plaid OAuth bank flow navigates the WebView out (FAIL → @capacitor/browser + deep link).** Link list reflow, 44pt, states. Core Epic 5 dependency.

#### `/account` — redesign · M
7-col admin user `<table>` (`overflow-x-auto` only) → stacked cards. Three inline forms (MFA verify/disable, change-password) → sheets with keyboard handling. Eye toggle ~14pt, sign-out ~20pt. **Gold misused on MFA "not enabled" warning.**

#### `/settings` — redesign · L
CardsTab horizontal `shrink-0` flex row (4 inputs + toggle + save) is unusable at phone width → stack per-card. 4-tab `w-fit` overflows. Toggle is 40×20pt. **Account-deletion path absent (Apple 5.1.1) — must add to DataTab.**

#### `/security` — reflow-only · S
Container reflows fine. Fixes: two small `<table>`s → definition-list rows; `.hive-btn-danger` → 44pt; skeleton while `/api/auth/me` loads; keyboard handling on the deletion-confirm input; active states on policy links.

#### `/rules` — redesign · M
Icon row actions ~26pt; inline create/edit form → bottom sheet (keyboard buries Save); side-by-side Category+Subcategory / Min+Max pairs stack below `sm`; skeleton + retry; safe-area. **Gold misused on category text.**

#### `/billing` — redesign · M
**Stripe checkout + portal via `window.location.href` (FAIL → @capacitor/browser + deep link).** Loading text not skeleton; toast-only error, no retry; secondary/ghost buttons ~28–30pt; status row compresses on SE.

### Auth & Marketing

#### `/login` — redesign · M
**`<a href="/api/auth/google">` → `disallowed_useragent`, sign-in blocked (FAIL).** Must branch on `Capacitor.isNativePlatform()` → `@capacitor/browser` open + `@capacitor/app` deep-link return. Button hover-only + ~38pt; footer links ~11px; no safe-area; no auth-check loading state. **Highest priority screen — it gates everything.**

#### `/register` — redesign · M
Same OAuth FAIL as login. Hidden desktop split panel collapses OK, but no safe-area, CTA borderline 44pt, no loading/error state.

#### `/` (marketing home) — reflow-only · S
Authed users likely deep-link past this. Nav center links + "Sign in" vanish `<md`/`<sm` with no hamburger; `ComparisonTable` hard `grid-cols-5`; hero `text-[54px]` too large for SE; sticky nav no safe-area-top.

#### `/pricing` — redesign · L
Redirects to `/#pricing`; real upgrade flow is `/billing`. **Stripe `window.location` checkout (FAIL) + Apple IAP 3.1.1 architecture decision.** 5-col `ComparisonTable` illegible on phone (FAIL). Nav safe-area, 44pt, no mobile menu, tabular-nums, skeleton.

#### `/privacy` — reflow-only · S
Static legal prose. Add horizontal safe-area padding (content bleeds to edges); Plaid policy URL is a dead `<span>` not an anchor (→ @capacitor/browser); bump `text-sm`/`slate-400` one step for 4.5:1 contrast.

---

## Recommended sequencing

1. **Epic 5 unblock first** (auth → connect → billing → reports export → chat keyboard). Without auth the app can't even be evaluated on device.
2. **Cross-cutting layer** (safe-area in layout, global 44pt, active-state pattern, skeleton primitive, gold-misuse sweep, IA promotions). Retires the bulk of FLAGs cheaply.
3. **L-effort redesigns** (transactions, reports, chat, cash-flow, connect, settings, pricing, points).
4. **M-effort redesigns**, then **S reflow-only** polish.
