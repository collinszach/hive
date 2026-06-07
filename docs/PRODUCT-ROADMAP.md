# HIVE — Product Roadmap (cross-platform)

> Prioritized roadmap across the **iOS app** (`ios/HIVE/`) and the **web app**
> (`frontend/`, hive.zacharyjcollins.com), sharing one FastAPI backend. Drafted 2026-06-03.
>
> Sizing: **S** < 1d · **M** 1–3d · **L** 3–5d · **XL** 1wk+.

## Platform parity snapshot

Backend is shared, so backend-only changes reach both surfaces on deploy. UI is built
per-platform. Current state:

| Capability | Web | iOS | Notes |
|---|---|---|---|
| Dashboard: safe-to-spend, attention, pace, weekly | ✅ | ✅ | Backend fixes (median income, weekly delta) reach both on deploy |
| Transactions, budgets, points, optimizer, goals | ✅ | ✅ | |
| Net worth, anomalies, chat, subscriptions | ✅ | ✅ | |
| **Investments / portfolio (aggregate, rise/fall, AI advisor)** | ❌ | ✅ | iOS-first this cycle — web gap |
| **Forecast editing (start-position override, edit income/events, predict-from-history)** | ❌ | ✅ | iOS-first this cycle — web gap |
| Debt planner, merchants, reports, rules, cash-flow, bills | ✅ | ❌ | web-only — iOS reverse gap |

## P0 — Close parity (the "reflect it on the website" work)

### R1 — Web Investments page `L`
Mirror the iOS Investments screen on web: portfolio hero (value + total return),
allocation bars, ranked positions with P&L, recent trades, concentration callout, and the
AI advisor. Backed by the existing `GET /api/snaptrade/portfolio` and
`POST /api/snaptrade/portfolio/advisor` — add both to `frontend/src/lib/api.ts`.

### R2 — Web forecast editing `M`
Bring the new Plan/forecast edits to web: a starting-position override (cash/investments),
edit existing income streams & life events (PUT endpoints exist), "predict income from
history", and allow a $0 income entry. Backed by the planning endpoints already shipped.

### R3 — iOS reverse parity `XL`
Bring web-only surfaces to iOS as native screens: **debt** payoff planner, **merchants**
trends, **reports**, **bills** calendar, **cash-flow**. Each is its own M-sized screen.

## P1 — Finish the investing arc

### I4 — Performance over time `M`
Chart portfolio value/return over time (from net-worth snapshots' investment subtotal;
optionally a dedicated daily investment snapshot). Both platforms.

### I6 — Watchlist + research `XL` (needs market-data provider)
Track tickers you're considering: quotes, day change, basic fundamentals. **Dependency:**
a Finnhub (or Polygon) API key + a `watchlist` table. Both platforms.

## P2 — Proactive intelligence (shift from showing → nudging)

- **Alerts expansion** `M`: subscription price-hike alerts, low-balance / bill-due push,
  budget-pace push. (APNs + the existing notification pipeline.)
- **Cash-flow forecast** `M`: surface the Prophet forecaster that's already in the stack —
  projected month-end balance, "can I afford X".
- **Tax view** `M`: flag deductible categories, year-end summary, 1099/interest roll-up.

## P3 — Automation & platform

- **Auto-savings rules / round-ups** `L`: rules that move surplus (tie to safe-to-spend).
- **Debt-payoff planner depth** `M`: real avalanche/snowball with payoff dates (web `debt`
  page → make it actionable; then R3 brings it to iOS).
- **iOS platform polish** `L`: Home-screen + Lock-Screen **widgets** (safe-to-spend, net
  worth), **Apple Watch** complication, **Siri shortcuts** ("what's my safe-to-spend").
- **Household / shared finances** `XL`: multi-user, shared budgets, per-person roll-ups.

## Suggested sequence

1. **R1 + R2** — web parity for this cycle's iOS work (the explicit ask).
2. **I4**, then **I6** once the Finnhub key exists.
3. **Alerts expansion** + **cash-flow forecast** (high perceived value, backend mostly ready).
4. **R3** + iOS widgets.

## Cross-cutting

- **Money correctness** stays load-bearing: Venmo/Zelle/Cash App excluded; transfers (incl.
  internal account transfers) excluded from spend & income; savings balance-only; pending
  excluded. Any new analytics surface must honor these.
- **Color discipline:** honey `#F5B942` for rewards/cards/points only; blue for
  planning/forecast/position. Never honey on a planning or investing surface.
