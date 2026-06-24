# Fundamentals Multi-Factor — Scope & Data-Source Recommendation

**Status:** design only, not built. Decision deliverable produced after the price-only
signal research concluded.

## Why this exists

The paper-trading engine's signal evolved from a dead technical/KMeans signal (rank-IC ≈ 0)
to validated cross-sectional **12-1 momentum** (rank-IC +0.04, t≈6). We then proved
empirically (`scripts/research_factors.py`) that **no better *price-only* signal exists** on
this universe: every price factor is a momentum variant (risk-adjusted momentum is 96%
correlated), and an IC-weighted composite is *worse* than momentum alone.

The bottleneck is information, not modeling. The only orthogonal source of edge is
**fundamentals** — value and quality factors, which are famously low- or negatively-correlated
with momentum (so they diversify it) and carry their own documented return premia. That is the
single remaining lever, and this doc scopes how to pull it correctly.

## The non-negotiable: point-in-time integrity

This is the trap that kills naive fundamental backtests and the thing we must not compromise.

- A fundamental figure may only be used **on/after the date it became public** (the SEC filing
  date). Ranking a 2023 date by a company's 2026-reported P/E is **look-ahead bias** — it
  manufactures fake alpha and violates the no-cheating contract the whole project is built on.
- Use **as-originally-reported** values, not later **restatements**.
- Practical rule: attach each fundamental fact to its **filing date** and only let the signal
  see it from that date forward. Where a filing date is unavailable, apply a conservative lag
  (~3 months after fiscal period end) — never zero lag.

A data source that only exposes *current* fundamentals (no filing dates, no as-reported
history) is **unusable for the backtest** and may only rank *today's* live portfolio.

## Data-source comparison

| Source | Point-in-time? | Cost | Coverage | Effort | Verdict |
|---|---|---|---|---|---|
| **SEC EDGAR** (`data.sec.gov` XBRL `companyfacts`) | ✅ best — every fact carries its `filed` date | **Free**, no key (just a `User-Agent`) | All US filers (our 54 names qualify); quarterly | High — raw XBRL: tag variants, restatements, CIK↔ticker map, parsing | **Recommended for the backtest** — rigorous + free |
| **Tiingo Fundamentals** (add-on) | ✅ `asReported` flag = as-filed | Paid add-on (contact sales); free tier ≈ DOW-30 only | US; daily valuation ratios + statements | Low — clean JSON, **reuses our existing Tiingo key/connector** | **Recommended if willing to pay** — lowest friction |
| **Sharadar SF1** (Nasdaq Data Link) | ✅ excellent (`datekey` = filing date) | Paid (~$50–100/mo) | Broad US, gold-standard quant data | Low–med | Best-in-class but paid; overkill for 54 names |
| **Financial Modeling Prep** | ⚠️ free tier is restated/limited history; PIT on higher tiers | Free (250/day) / paid | US + intl | Low | Free tier **look-ahead-risky** — avoid for backtest |
| **Alpha Vantage** `OVERVIEW` | ❌ current snapshot only | Free (25/day) | US | Low | Live ranking only, **not** backtestable |
| **yfinance** (Yahoo) | ❌ no PIT guarantees; ToS gray area | Free | Broad | Low | Not for rigorous backtests |

### Recommendation
1. **Primary: SEC EDGAR.** Free, authoritative, and the only option that gives true
   point-in-time for free. We only need ~54 large-cap US names — all EDGAR filers. The cost is
   parsing effort, not money, and rigor is the entire point of this project.
2. **Fast alternative: Tiingo Fundamentals add-on** — if you're willing to pay (~tens of
   $/mo) and want minimal integration, it reuses the existing `marketdata/connector.py` pattern
   and Tiingo key, with `asReported` preserving point-in-time. Confirm free-tier coverage and
   add-on price with Tiingo sales before committing.
3. **Avoid for backtesting:** Alpha Vantage (no history), FMP free tier (restated → look-ahead),
   yfinance (no PIT). Any of these is fine *only* for ranking the live portfolio today.

## Factors to build (minimal, documented, robust)

Start small and measure — do **not** ship a kitchen-sink composite (we proved naive blending
adds noise). All computable from standard financials + the price we already have.

**Value** (cheap = higher expected return):
- **Earnings yield** = trailing-12m net income ÷ market cap (inverse P/E).
- **FCF yield** = trailing-12m free cash flow ÷ market cap (value + quality hybrid; strong).
- **Book-to-market** = book equity ÷ market cap (classic Fama-French HML).

**Quality** (profitable, clean earnings = higher quality):
- **Gross profitability** = gross profit ÷ total assets (Novy-Marx; often beats ROE).
- **ROE** = net income ÷ book equity.
- **Accruals** = (net income − operating cash flow) ÷ total assets (Sloan; *low/negative* = higher
  quality — earnings backed by cash).

Required raw fields (all in 10-K/10-Q XBRL): `NetIncomeLoss`, `Revenues`, `GrossProfit`,
`StockholdersEquity`, `Assets`, `NetCashProvidedByOperatingActivities`,
`PaymentsToAcquirePropertyPlantAndEquipment` (capex → FCF), shares outstanding. Market cap =
shares × our daily price.

## Validation-first protocol (same discipline as momentum)

Before any factor touches the portfolio:
1. Compute each factor **point-in-time**, cross-sectionally.
2. Measure **rank-IC + t-stat** vs forward returns (extend `scripts/research_factors.py`).
3. Measure **orthogonality to momentum** — a factor that just duplicates momentum is useless;
   value's *low/negative* correlation is the whole point.
4. Keep only factors with **positive IC and meaningful orthogonality**; combine via
   **IC-weighting** (not naive average).
5. Only then integrate into `factor_signal.py` and run the walk-forward backtest with the
   risk overlay. Gate on out-of-sample, beta-adjusted alpha — the same bar as before.

## Architecture (mirrors existing patterns)

- `app/fundamentals/connector.py` — `get_connector() -> None` when unconfigured (graceful-skip,
  like `marketdata/connector.py`). For EDGAR: ticker→CIK map (`company_tickers.json`),
  `companyfacts` per symbol, parse facts with their `filed` dates.
- `app/models/paper_fundamental.py` — `PaperFundamental(symbol, fiscal_period_end, filed_date,
  <metric columns or JSONB>)`, unique on `(symbol, fiscal_period_end, filed_date)`. Filing date is
  load-bearing for point-in-time.
- Alembic migration; backfill task `backfill_fundamentals` in `tasks/paper_trading.py`
  (mirrors `backfill_historical_candles`), plus a quarterly refresh on the beat schedule.
- Extend `factor_signal.py`: `compute_fundamental_factors(db, as_of, symbols)` reading only facts
  with `filed_date <= as_of`, then an IC-weighted blend of momentum + surviving value/quality
  factors in `score_cross_section`.

## Effort & phasing

| Phase | Work | Risk |
|---|---|---|
| 1 | Data-source decision (EDGAR vs Tiingo add-on); connector + CIK map / key | Med (XBRL parsing if EDGAR) |
| 2 | Model + migration + backfill of point-in-time fundamentals for 54 names | Med (restatement/PIT correctness) |
| 3 | Factor computation + **IC/orthogonality research** (go/no-go gate) | **This decides everything** |
| 4 | IC-weighted composite in `factor_signal.py` + walk-forward backtest | Low–med |

Rough estimate: ~1 week focused; the connector (Phase 1) and PIT correctness (Phase 2) are the
real risk, and Phase 3 is the honest gate — if value/quality don't show orthogonal IC on this
narrow large-cap universe, we stop and keep momentum.

## Open decisions for you

1. **Data source:** SEC EDGAR (free, more work, max rigor) vs Tiingo Fundamentals add-on (paid,
   low friction, reuses our key). Confirm Tiingo add-on price/coverage if leaning that way.
2. **Universe:** keep 54 large-caps, or broaden? Value/quality factors are weaker among
   homogeneous mega-caps; a broader universe gives them more to differentiate.
3. **Bar to proceed past Phase 3:** suggested — combined out-of-sample IC > momentum-alone, *and*
   beta-adjusted alpha t > 2 on the walk-forward. Otherwise momentum stands as the final signal.

Sources: [Tiingo Fundamentals docs](https://www.tiingo.com/documentation/fundamentals) ·
[Tiingo pricing](https://www.tiingo.com/about/pricing) ·
[SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
