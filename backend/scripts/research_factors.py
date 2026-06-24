"""Research additional price-only factors and whether a better composite than raw momentum exists.

We can't add value/quality factors (Tiingo is price-only), but several documented
improvements on raw 12-1 momentum are price-based: risk-adjusted ("Sharpe") momentum,
52-week-high proximity, and multi-horizon momentum. This measures each factor's
cross-sectional rank-IC vs forward returns, their orthogonality to 12-1 momentum (a
factor that just duplicates momentum adds nothing), and whether an IC-weighted composite
of the orthogonal-and-predictive ones beats momentum alone.

    PYTHONPATH=/app python scripts/research_factors.py
"""
import numpy as np
import pandas as pd
from sqlalchemy import text

from app.db import get_sync_db

H = 20            # forward horizon (trading days)
MIN_NAMES = 10    # min cross-section per date


def zrow(df):
    return df.sub(df.mean(axis=1), axis=0).div(df.std(axis=1).replace(0, np.nan), axis=0)


def ic(fac, fwd):
    ics = []
    for d in fac.index:
        m = pd.concat([fac.loc[d], fwd.loc[d]], axis=1).dropna()
        if len(m) >= MIN_NAMES:
            ics.append(m.iloc[:, 0].rank().corr(m.iloc[:, 1].rank()))
    s = pd.Series(ics).dropna()
    n = len(s)
    t = s.mean() / s.std() * np.sqrt(n) if n > 1 and s.std() > 0 else float("nan")
    return s.mean(), t, n


def main():
    db = get_sync_db()
    cnd = pd.read_sql(text("SELECT symbol,date::date AS d,adj_close FROM paper_candles WHERE symbol<>'SPY'"), db.bind)
    db.close()
    px = cnd.pivot(index="d", columns="symbol", values="adj_close").sort_index()
    ret = px.pct_change()
    fwd = px.shift(-H) / px - 1.0
    vol = ret.rolling(120).std()

    factors = {
        "mom_12_1": px.shift(21) / px.shift(252) - 1.0,
        "mom_6_1": px.shift(21) / px.shift(126) - 1.0,
        "mom_3_1w": px.shift(5) / px.shift(63) - 1.0,
        "risk_adj_mom": (px.shift(21) / px.shift(252) - 1.0) / (vol * np.sqrt(252)),
        "high_52w": px / px.rolling(252).max() - 1.0,   # 0 = at 52wk high (closer = stronger)
    }

    print(f"\n=== Price-only factor IC (horizon {H}d) ===\n")
    print(f'{"factor":>14}{"meanIC":>9}{"t":>7}{"corr_w_mom":>12}')
    mom_rank = factors["mom_12_1"].rank(axis=1)
    ic_by_factor = {}
    for name, fac in factors.items():
        mn, t, n = ic(fac, fwd)
        ic_by_factor[name] = mn
        # average daily cross-sectional rank correlation with 12-1 momentum
        corrs = []
        for d in fac.index:
            m = pd.concat([fac.loc[d], factors["mom_12_1"].loc[d]], axis=1).dropna()
            if len(m) >= MIN_NAMES:
                corrs.append(m.iloc[:, 0].rank().corr(m.iloc[:, 1].rank()))
        cw = float(pd.Series(corrs).dropna().mean())
        print(f'{name:>14}{mn:>9.4f}{t:>7.2f}{cw:>12.2f}')

    # IC-weighted composite of factors with positive IC (z-scored, weighted by their IC).
    pos = {k: v for k, v in ic_by_factor.items() if v > 0}
    if pos:
        wsum = sum(pos.values())
        comp = sum((ic_by_factor[k] / wsum) * zrow(factors[k]) for k in pos)
        mn, t, n = ic(comp, fwd)
        print(f'\nIC-weighted composite of {list(pos)}:')
        print(f'   meanIC {mn:.4f}  t {t:.2f}  (vs mom_12_1 IC {ic_by_factor["mom_12_1"]:.4f})')
    print()


if __name__ == "__main__":
    main()
