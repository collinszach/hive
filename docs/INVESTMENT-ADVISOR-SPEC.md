# Investment Advisor (Paper Trading Research Engine) — Spec

## What this is, honestly

A simulated trading system that starts with a **$10,000 paper portfolio**, trades against
**real, live US equity/ETF market data**, learns from outcomes, and is judged purely on its
own track record over time. It is not pre-loaded with a guarantee that it beats the market —
nothing legitimately can be. What it *can* do: rigorous backtesting, real-time paper execution,
honest performance reporting against SPY/QQQ benchmarks, and a hard, pre-agreed **graduation
gate** that must be cleared before any real money is ever connected.

No real brokerage credentials, no real order placement, no real money — in this build, ever,
without an explicit separate decision from you after the graduation gate is met.

## Graduation gate (defined now, before any code runs)

Real money is not discussed again until ALL of the following hold, measured on paper-trading
results the system itself logged (no cherry-picked backtest):

| Criterion | Threshold |
|---|---|
| Minimum live paper-trading duration | 6 months, continuous, no gaps |
| Annualized return vs. SPY (same period) | Beats SPY by ≥3 points annualized |
| Sharpe ratio | ≥ 1.0 |
| Max drawdown | ≤ 20% |
| Win rate consistency | No single month >40% of total paper P&L (no one lucky month carrying the record) |

If any criterion fails, the gate resets — no partial credit, no "it's close." This table lives
in the codebase (`backend/app/investing/gate.py`) as the single source of truth, not just docs.

## Architecture

```
GS65 (laptop, GPU)                          NUC (24/7 host) + Hive
─────────────────────                       ──────────────────────────
- Model training (gradient                 - investing-service (FastAPI, new container)
  boosting / LSTM signal models)              - ingests Alpaca market data (daily + intraday bars)
- Backtesting engine (vectorized,             - runs trained model in inference-only mode
  walk-forward, no lookahead)                 - paper-trading engine (order sim, position book,
- Feature engineering experiments               P&L, slippage/fee model)
- Produces versioned model artifacts          - writes decisions + rationale + P&L to Postgres
  (pickled/ONNX) pushed to NUC via rsync      - exposes /api/investing/* to Hive frontend
                                             - Celery beat: market-open/close jobs, EOD snapshot,
                                               weekly retrain-trigger signal back to GS65
```

Why split this way: training/backtesting is bursty and GPU-hungry — doesn't belong on the
always-on NUC. Inference (run the already-trained model on the day's data and log a decision)
is cheap and belongs next to the rest of Hive's always-on services.

## Data needed (beyond what Hive has today)

Hive's Plaid/SnapTrade integrations are for *your real accounts' balances* — they don't supply
market data (no live quotes, no historicals, no fundamentals). New requirement:

- **Alpaca Markets** (paper trading account, free tier): real-time + historical bars for US
  equities/ETFs, and a paper-trading order/account API that does the position/P&L bookkeeping
  for us — no need to hand-roll a matching engine.
- **Fundamentals**: Alpaca doesn't give earnings/balance-sheet data. Use a free-tier fundamentals
  source (e.g., Financial Modeling Prep or Alpha Vantage) for EPS, revenue growth, P/E — inputs
  to the quant model, refreshed weekly (fundamentals don't move intraday).
- **News/sentiment** (optional, phase 2): a headlines feed (Alpaca has one bundled) fed to an
  LLM for sentiment scoring — supplementary signal, not the primary one.

## What actually makes the trading decisions

Be precise about where each kind of model is used — this is the part most "AI trading bot"
projects get wrong by leaning entirely on an LLM, which is the wrong tool for the core job:

1. **Quant ML model (the actual decision engine)** — gradient-boosted trees (LightGBM) or an
   LSTM, trained on engineered features (returns, momentum, volatility, volume, fundamentals)
   to predict short-horizon (1–5 day) relative return. This is what real systematic funds use;
   it's auditable, backtestable, and doesn't hallucinate. Runs/trains on the GS65.
2. **LLM (Claude Haiku 4.5 or Sonnet 4.6, picked by cost/latency need, not "biggest")** — used
   for two narrow jobs only: (a) summarizing why a trade was made in plain language for the Hive
   UI, (b) scoring headline sentiment as one input feature. The LLM never independently decides
   to place a trade — it has no path to do so. This avoids the most common and most expensive
   failure mode of LLM trading bots: confident, fluent, wrong reasoning about price action.
3. **Risk engine (deterministic code, not ML)** — hard caps regardless of what the model wants:
   max position size per ticker, max sector concentration, daily loss circuit breaker (halts
   trading for the day past a drawdown threshold), no overnight leverage. This is what prevents
   one bad model day from being a catastrophic day.

## New backend surface

```
backend/app/investing/
├── __init__.py
├── alpaca_client.py        ← market data + paper account wrapper
├── fundamentals_client.py  ← FMP/Alpha Vantage wrapper
├── features.py             ← feature engineering (shared by training + inference)
├── model.py                ← load versioned model artifact, predict()
├── risk_engine.py          ← position sizing, concentration caps, circuit breaker
├── paper_trader.py         ← turns model signal + risk checks into Alpaca paper orders
├── gate.py                 ← graduation gate criteria + current status calculation
└── llm_rationale.py        ← post-hoc plain-English explanation of each trade

backend/app/models/
├── paper_position.py
├── paper_trade.py
└── paper_equity_snapshot.py   ← daily portfolio value, for the equity curve chart

backend/app/tasks/investing.py  ← Celery beat: market-open signal+trade, EOD snapshot,
                                   weekly fundamentals refresh, weekly retrain-trigger
```

New Celery beat entries (extends existing schedule in `app/celery_app.py`):
```python
"investing-market-open-trade": crontab(hour=9, minute=35),   # after open volatility settles
"investing-eod-snapshot":      crontab(hour=16, minute=5),   # after close
"investing-fundamentals-sync": crontab(hour=6, minute=0, day_of_week=0),
```

## API endpoints

```
GET  /api/investing/portfolio        → current paper positions, cash, total equity
GET  /api/investing/equity-curve     → daily equity history vs SPY/QQQ benchmark series
GET  /api/investing/trades           → trade log with model confidence + LLM rationale
GET  /api/investing/gate-status      → live progress against the 5 graduation criteria
POST /api/investing/circuit-breaker  → manual kill switch (always available, no auth gate)
```

## Frontend

New route `frontend/src/app/(app)/investing/page.tsx`:
- Equity curve vs. SPY/QQQ (the one number that matters — is it actually winning)
- Current paper positions table
- Trade log with rationale ("bought NVDA: momentum + earnings surprise, model confidence 0.71")
- Graduation gate progress (5 criteria, pass/fail, days remaining on duration requirement)
- A visible, always-available "halt trading" control — this stays even after any future
  real-money decision

## Build order

1. Alpaca paper account + market data ingestion, store daily bars (no model yet)
2. Feature engineering + first LightGBM model, walk-forward backtest on 3+ years history (GS65)
3. Risk engine + paper_trader wired to Alpaca paper API, manual review of first week of trades
4. Celery automation (market-open trade, EOD snapshot) — system now runs unattended
5. Hive UI: equity curve, trade log, gate status
6. LLM rationale layer (cosmetic/explanatory, added last — never on the decision path)
7. Let it run. Revisit real money only when `gate.py` reports all 5 criteria met.

## Subagent delegation plan

Per your instruction, you interface with me (PM) only; the following get dispatched to
subagents as the build progresses — each gets a tight, self-contained brief so it can't drift
into placing real trades or skipping the risk engine:
- Data ingestion (Alpaca + fundamentals clients)
- Feature engineering + model training script (GS65-side)
- Risk engine + paper trading execution layer
- Celery task wiring
- Frontend `/investing` page (will follow existing Hive design system — dark, precise, no
  gamification, per `DESIGN.md`)
