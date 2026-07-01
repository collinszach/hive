"""GATE: do value/quality fundamentals add orthogonal edge over momentum?

Pulls point-in-time annual fundamentals from EDGAR for the watchlist, forward-fills each
metric by its **filing date** (never look-ahead), builds value/quality factors against
daily market cap, and measures each factor's cross-sectional rank-IC vs forward returns,
its correlation with 12-1 momentum, and whether a momentum+fundamentals composite beats
momentum alone. This is the go/no-go before any persistence/integration is built.

    PYTHONPATH=/app python scripts/research_fundamental_factors.py
"""
import numpy as np
import pandas as pd
from sqlalchemy import text

from app.db import get_sync_db
from app.fundamentals.connector import get_connector

H = 20
MIN_NAMES = 12


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


def corr_with(fac, ref):
    cs = []
    for d in fac.index:
        m = pd.concat([fac.loc[d], ref.loc[d]], axis=1).dropna()
        if len(m) >= MIN_NAMES:
            cs.append(m.iloc[:, 0].rank().corr(m.iloc[:, 1].rank()))
    return float(pd.Series(cs).dropna().mean())


def main():
    db = get_sync_db()
    # Whatever's in the candle table (the wide research universe), not just the watchlist.
    cnd = pd.read_sql(text("SELECT symbol,date::date AS d,close,adj_close FROM paper_candles WHERE symbol<>'SPY'"), db.bind)
    db.close()

    close = cnd.pivot(index="d", columns="symbol", values="close").sort_index()
    adj = cnd.pivot(index="d", columns="symbol", values="adj_close").sort_index()
    close.index = pd.to_datetime(close.index)
    adj.index = pd.to_datetime(adj.index)
    dates = close.index

    # Pull fundamentals and forward-fill each metric by filing date (point-in-time).
    conn = get_connector()
    metrics = ["net_income", "stockholders_equity", "total_assets",
               "operating_cash_flow", "capex", "gross_profit", "shares"]
    panels = {m: pd.DataFrame(index=dates, columns=close.columns, dtype=float) for m in metrics}
    got = 0
    for sym in close.columns:
        recs = conn.get_annual_fundamentals(sym)
        if not recs:
            continue
        got += 1
        fdf = pd.DataFrame(recs).sort_values("filed_date")
        fdf["filed_date"] = pd.to_datetime(fdf["filed_date"])
        fdf = fdf.drop_duplicates("filed_date", keep="last").set_index("filed_date")
        for m in metrics:
            panels[m][sym] = fdf[m].reindex(dates, method="ffill")
    print(f"fundamentals pulled for {got}/{len(close.columns)} names\n")

    mcap = close * panels["shares"]
    ni, eq, at = panels["net_income"], panels["stockholders_equity"], panels["total_assets"]
    ocf, capex, gp = panels["operating_cash_flow"], panels["capex"], panels["gross_profit"]
    fcf = ocf - capex

    factors = {
        "earnings_yield": ni / mcap,                 # value
        "book_to_market": eq / mcap,                 # value
        "fcf_yield": fcf / mcap,                      # value/quality
        "gross_profitability": gp / at,              # quality
        "roe": ni / eq,                              # quality
        "accruals(neg)": -((ni - ocf) / at),         # quality (low accruals = good)
        "mom_12_1": adj.shift(21) / adj.shift(252) - 1.0,  # reference
    }
    fwd = adj.shift(-H) / adj - 1.0

    print(f'{"factor":>20}{"meanIC":>9}{"t":>7}{"corr_mom":>10}{"names":>7}')
    ic_by = {}
    for name, fac in factors.items():
        mn, t, n = ic(fac, fwd)
        ic_by[name] = mn
        cw = corr_with(fac, factors["mom_12_1"]) if name != "mom_12_1" else 1.0
        cover = int(fac.iloc[-1].notna().sum())
        print(f'{name:>20}{mn:>9.4f}{t:>7.2f}{cw:>10.2f}{cover:>7}')

    # Composite: momentum + value/quality factors that are predictive AND orthogonal.
    keep = {k for k, v in ic_by.items()
            if k != "mom_12_1" and abs(v) >= 0.02 and abs(corr_with(factors[k], factors["mom_12_1"])) < 0.5}
    print(f"\northogonal+predictive fundamentals: {sorted(keep) or 'NONE'}")
    if keep:
        parts = [np.sign(ic_by["mom_12_1"]) * zrow(factors["mom_12_1"])]
        parts += [np.sign(ic_by[k]) * zrow(factors[k]) for k in keep]
        comp = sum(parts) / len(parts)
        mn, t, n = ic(comp, fwd)
        print(f"composite (mom+{'+'.join(sorted(keep))}): IC {mn:.4f}  t {t:.2f}  "
              f"(vs mom-alone {ic_by['mom_12_1']:.4f})")
    print()


if __name__ == "__main__":
    main()
