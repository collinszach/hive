"""Rigorous validation of the cross-sectional momentum factor.

Answers the questions a skeptical allocator asks before funding a strategy:

  1. **Factor-neutral alpha** — build a long-short momentum portfolio (long the top
     quintile by 12-1 momentum, short the bottom), regress its returns on SPY, and report
     alpha / beta / t(alpha). Positive alpha with ~0 beta = real market-neutral edge;
     high beta with no alpha = just levered market exposure.
  2. **Walk-forward stability** — per-year Sharpe of the long-short factor, so we see a
     *distribution* of out-of-sample results, not one lucky window.
  3. **Cost sensitivity** — net Sharpe as round-trip slippage rises (0 → 20 bps). An edge
     that dies at realistic costs is not an edge.

Run inside the backend/worker container (has DB + pandas):
    python scripts/validate_momentum.py
Reads cached ``paper_candles``; makes no writes.
"""
import sys
from datetime import date

import numpy as np
import pandas as pd
from sqlalchemy import text

# 12-1 momentum windows (trading days) — match app/ml/factor_signal.py.
LOOKBACK, SKIP = 252, 21
QUANTILE = 0.2          # top/bottom 20% form the long/short legs
TRADING_DAYS = 252
BENCH = "SPY"


def load_prices(db):
    df = pd.read_sql(text("SELECT symbol, date::date AS d, adj_close FROM paper_candles"), db.bind)
    px = df.pivot(index="d", columns="symbol", values="adj_close").sort_index()
    px.index = pd.to_datetime(px.index)  # DatetimeIndex required for resample()
    return px


def momentum_panel(px: pd.DataFrame) -> pd.DataFrame:
    """12-1 momentum for every (date, symbol), point-in-time (only past prices)."""
    stocks = [c for c in px.columns if c != BENCH]
    p = px[stocks]
    return p.shift(SKIP) / p.shift(LOOKBACK) - 1.0


def long_short_returns(px: pd.DataFrame, mom: pd.DataFrame, rebalance="ME"):
    """Daily returns of a long-short momentum book, selection refreshed each month.

    On each rebalance date, rank names by momentum, long the top ``QUANTILE`` and short the
    bottom (equal-weight within leg), hold the selection until the next rebalance. Returns
    daily series for: long-only top quintile, long-short spread, and SPY.
    """
    stocks = [c for c in px.columns if c != BENCH]
    ret = px[stocks].pct_change()
    spy = px[BENCH].pct_change()

    rebal_set = set(px.resample(rebalance).last().index)
    long_sel, short_sel = None, None
    L, LS, prev_long, turnover = {}, {}, set(), []

    for d in px.index:
        if d in rebal_set:
            m = mom.loc[d].dropna()
            if len(m) >= 10:
                k = max(1, int(len(m) * QUANTILE))
                ranked = m.sort_values()
                short_sel = list(ranked.index[:k])
                long_sel = list(ranked.index[-k:])
                turnover.append(len(set(long_sel) ^ prev_long) / max(len(long_sel), 1))
                prev_long = set(long_sel)
        if long_sel:
            L[d] = ret.loc[d, long_sel].mean()
            LS[d] = ret.loc[d, long_sel].mean() - ret.loc[d, short_sel].mean()

    out = pd.DataFrame({"long": pd.Series(L), "long_short": pd.Series(LS), "spy": spy}).dropna()
    return out, float(np.mean(turnover)) if turnover else 0.0


def ols_alpha_beta(y: pd.Series, x: pd.Series):
    """OLS y = alpha + beta*x. Returns (alpha_daily, beta, t_alpha)."""
    X = np.column_stack([np.ones(len(x)), x.values])
    coef, *_ = np.linalg.lstsq(X, y.values, rcond=None)
    resid = y.values - X @ coef
    n, k = len(y), 2
    s2 = (resid @ resid) / (n - k)
    cov = s2 * np.linalg.inv(X.T @ X)
    se_alpha = np.sqrt(cov[0, 0])
    return coef[0], coef[1], coef[0] / se_alpha if se_alpha > 0 else float("nan")


def sharpe(r: pd.Series) -> float:
    return float(r.mean() / r.std() * np.sqrt(TRADING_DAYS)) if r.std() > 0 else float("nan")


def main():
    from app.db import get_sync_db

    db = get_sync_db()
    try:
        px = load_prices(db)
    finally:
        db.close()
    mom = momentum_panel(px)
    rr, avg_turnover = long_short_returns(px, mom)
    n = len(rr)
    print(f"\n=== Momentum factor validation ({rr.index.min()} → {rr.index.max()}, {n} days) ===\n")

    # 1. Factor-neutral alpha (the decisive test)
    a_ls, b_ls, t_ls = ols_alpha_beta(rr["long_short"], rr["spy"])
    a_lo, b_lo, t_lo = ols_alpha_beta(rr["long"], rr["spy"])
    print("1. Factor-neutral alpha (vs SPY)")
    print(f"   {'book':<12}{'ann.alpha':>10}{'beta':>8}{'t(alpha)':>10}{'sharpe':>9}")
    print(f"   {'long-short':<12}{a_ls*TRADING_DAYS:>9.1%}{b_ls:>8.2f}{t_ls:>10.2f}{sharpe(rr['long_short']):>9.2f}")
    print(f"   {'long-only':<12}{a_lo*TRADING_DAYS:>9.1%}{b_lo:>8.2f}{t_lo:>10.2f}{sharpe(rr['long']):>9.2f}")

    # 2. Walk-forward: per-year long-short Sharpe
    print("\n2. Walk-forward — long-short Sharpe by year")
    by_year = rr["long_short"].groupby(rr.index.map(lambda d: d.year))
    for yr, r in by_year:
        print(f"   {yr}: sharpe {sharpe(r):>6.2f}   ann.ret {r.mean()*TRADING_DAYS:>7.1%}   (n={len(r)})")

    # 3. Cost sensitivity (round-trip slippage on monthly turnover, both legs)
    print(f"\n3. Cost sensitivity  (avg monthly long-leg turnover ≈ {avg_turnover:.0%})")
    print(f"   {'bps/side':>9}{'net ann.ret':>13}{'net sharpe':>12}")
    for bps in (0, 5, 10, 20):
        monthly_cost = 2 * avg_turnover * (bps / 10_000) * 2  # both legs, round trip
        daily_drag = monthly_cost / 21.0
        net = rr["long_short"] - daily_drag
        print(f"   {bps:>9}{net.mean()*TRADING_DAYS:>12.1%}{sharpe(net):>12.2f}")
    print()


if __name__ == "__main__":
    sys.exit(main())
