# HIVE iOS — Investing Build-Out Spec

> Epics for the investment side of the app: surfacing portfolio performance (rise/fall)
> and building out screens to support future stock-market investing. Grounded in the data
> SnapTrade actually provides today.
>
> Sizing: **S** < 1d · **M** 1–3d · **L** 3–5d · **XL** 1wk+.
> Priority: **P0** keystone · **P1** high-value · **P2** later.
> Status: 🔲 not started · 🚧 partial · ✅ done. Drafted **2026-06-03**.

## What we have today

- **Per-account holdings** via `GET /api/snaptrade/accounts/{id}/holdings` → positions
  (`symbol`, `units`, `price`, `marketValue`, `openPnl` = unrealized gain/loss, `avgPrice`,
  `type`), recent `orders` (trades), and `total_value`.
- **iOS**: `AccountDetailView` lists positions; ✅ now shows a **portfolio rise/fall
  summary** (total value + total unrealized return %).
- **Net-worth snapshots** include investment balances (the investment asset subtotal).

## What we do NOT have (dependencies for the "future investing" features)

- **Live quotes / fundamentals / news** for arbitrary tickers → needs a market-data
  provider (Finnhub, Polygon, Alpha Vantage, or similar). No such integration exists.
- **Watchlist storage** → needs a new table + endpoints.
- **Order placement** (buy/sell) → SnapTrade *can* place trades, but that's a regulated,
  high-compliance surface (disclosures, auth, suitability). Big, separate scope.

---

## Epics

### I1 — Portfolio aggregate endpoint `M` · P0 · 🔲
A single `GET /api/snaptrade/portfolio` that aggregates **all** the user's investment
accounts so the client makes one call instead of N.
- Returns: `total_value`, `total_cost_basis`, `total_unrealized_pnl` (+%), positions merged
  by symbol across accounts (units, avg cost, market value, openPnl), allocation breakdown
  (by holding and by account), and a recent-trades list.
- Reuses the existing per-account SnapTrade connector; pure aggregation, no new data source.
- **DoD:** totals reconcile with the sum of per-account holdings; ≤1 round-trip for the UI.

### I2 — Investments screen `L` · P0 · 🔲
A dedicated portfolio screen (reachable from a Home pulse and from Connect).
- **Hero:** total market value + total return (rise/fall, green/red, %), like the net-worth hero.
- **Allocation:** a donut or bars — by holding and by account/asset type.
- **Positions:** ranked list (by value or by P&L), each with units, market value, and
  unrealized gain/loss %. Tap → position detail (cost basis, units, return).
- **Recent trades:** the orders list.
- Blue/position palette (this is a *position* surface, not rewards — no honey).
- **DoD:** matches the aggregate endpoint; handles 0/1/many accounts; offline-safe states.

### I3 — Home Investments pulse `S` · P1 · 🔲
A Home section (mirrors the net-worth pulse): total invested value + unrealized return
(rise/fall), tappable → the Investments screen. Hidden when there are no holdings.
- **DoD:** value + return match I1; one section file under `Features/Dashboard/Sections/`.

### I4 — Performance over time `M` · P1 · 🔲
Chart portfolio value (and/or return) over time. The investment subtotal is already in
net-worth snapshots — surface it as an investment-only trend; optionally add a dedicated
daily investment-value snapshot for finer history.
- **DoD:** trend renders from snapshots; delta over 30/90/365d.

### I5 — Allocation & concentration insight `M` · P2 · 🔲
Diversification view: weight per holding, largest-position concentration flag, asset-type
mix (using SnapTrade's position `type`). Optionally an AI read ("you're 60% in one stock").
- **DoD:** weights sum to 100%; concentration flag when any holding > a threshold.

### I6 — Watchlist + research `XL` · P2 · 🔲 (needs market-data provider)
Track tickers you're considering: live/last quote, day change, basic fundamentals, a spark.
- **Dependency:** integrate a market-data API (Finnhub/Polygon/etc.) + a `watchlist` table.
- **DoD:** add/remove tickers; quotes refresh; watchlist persists per user.

### I7 — AI investing guidance `M` · P2 · 🔲
Reuse the existing Claude advisor pattern (as in the Forecast advisor) but grounded in the
portfolio: concentration risk, cash drag, contribution suggestions, "what to consider"
education. **Not** personalized financial advice — framed as analysis/education with a
disclaimer.
- **DoD:** advisor reads real holdings; output is bounded, disclaimered, Pro-gated.

### I8 — In-app trading `XL` · P2 · 🔲 (regulated — decide explicitly)
Place buy/sell orders via SnapTrade from the app. High compliance scope (disclosures,
confirmations, auth step-up). Only if you want HIVE to be a place you *act*, not just track.

---

## Suggested order

1. **I1 + I2 + I3** — aggregate endpoint, the Investments screen, the Home pulse. This is
   the "see and understand my portfolio" core, entirely on existing SnapTrade data.
2. **I4 + I5** — performance over time + allocation insight.
3. **I7** — AI guidance (reuses the advisor pattern).
4. **I6 / I8** — watchlist/research and trading, each gated on a new dependency (market data
   provider; trading compliance). Decide before starting.

The first wave (I1–I3) needs **no new data source** — it's aggregation + UI. The "help me
pick future investments" side (I6) is where a market-data integration becomes necessary.
