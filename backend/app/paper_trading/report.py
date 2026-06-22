"""Evaluation report — plain computed performance metrics, no LLM narrative.

Kept deliberately to plain numbers so the "not investment advice" boundary stays
unambiguous (the report describes a sandboxed simulation, never a recommendation).

``compute_evaluation_report`` takes a portfolio's starting cash, its daily snapshots, and
its trades, and returns total return, CAGR, benchmark return, alpha, Sharpe, max drawdown,
win rate, avg win/loss, days-elapsed-of-180, and status.
"""
from datetime import date
from typing import Optional

import numpy as np

_TRADING_DAYS_PER_YEAR = 252
EVALUATION_DAYS = 180


def _sharpe(values: list[float]) -> float:
    if len(values) < 3:
        return 0.0
    arr = np.asarray(values, dtype=float)
    rets = arr[1:] / arr[:-1] - 1.0
    rets = rets[np.isfinite(rets)]
    sd = rets.std(ddof=1) if len(rets) > 1 else 0.0
    if sd == 0 or len(rets) == 0:
        return 0.0
    return float((rets.mean() / sd) * np.sqrt(_TRADING_DAYS_PER_YEAR))


def _max_drawdown(values: list[float]) -> float:
    """Most negative peak-to-trough return over the series (<= 0)."""
    if not values:
        return 0.0
    peak = values[0]
    mdd = 0.0
    for v in values:
        peak = max(peak, v)
        if peak > 0:
            mdd = min(mdd, v / peak - 1.0)
    return float(mdd)


def _realized_trade_pnls(trades: list[dict]) -> list[float]:
    """Reconstruct realized P&L per closed lot from a trade log.

    Strategy is sell-to-flat, so each sell closes the running position. We track an
    average cost as buys accumulate and realize P&L = (sell_price - avg_cost) * qty on sells.
    ``trades``: dicts with symbol, side, quantity, price (chronological).
    """
    state: dict[str, dict] = {}  # symbol -> {qty, cost}
    pnls: list[float] = []
    for t in trades:
        sym = t["symbol"]
        side = t["side"]
        qty = float(t["quantity"])
        price = float(t["price"])
        s = state.setdefault(sym, {"qty": 0.0, "cost": 0.0})
        if side == "buy":
            total_cost = s["cost"] * s["qty"] + price * qty
            s["qty"] += qty
            s["cost"] = total_cost / s["qty"] if s["qty"] else 0.0
        elif side == "sell":
            close_qty = min(qty, s["qty"]) if s["qty"] else qty
            pnls.append((price - s["cost"]) * close_qty)
            s["qty"] = max(0.0, s["qty"] - qty)
            if s["qty"] == 0.0:
                s["cost"] = 0.0
    return pnls


def compute_evaluation_report(
    starting_cash: float,
    snapshots: list[dict],
    trades: Optional[list[dict]] = None,
    *,
    evaluation_days: int = EVALUATION_DAYS,
    as_of: Optional[date] = None,
) -> dict:
    """Compute the evaluation report from snapshots (sorted by date) + trades.

    ``snapshots``: dicts with ``as_of`` (date), ``portfolio_value``, ``benchmark_value``.
    """
    trades = trades or []
    snaps = sorted(snapshots, key=lambda s: s["as_of"])
    pvals = [float(s["portfolio_value"]) for s in snaps]
    bvals = [float(s["benchmark_value"]) for s in snaps if s.get("benchmark_value") is not None]

    final_value = pvals[-1] if pvals else float(starting_cash)
    total_return = (final_value / starting_cash - 1.0) if starting_cash else 0.0

    if snaps:
        first_day, last_day = snaps[0]["as_of"], snaps[-1]["as_of"]
        days_elapsed = max(0, (last_day - first_day).days)
    else:
        days_elapsed = 0

    cagr = None
    if starting_cash > 0 and days_elapsed > 0 and final_value > 0:
        cagr = (final_value / starting_cash) ** (365.0 / days_elapsed) - 1.0

    benchmark_return = None
    alpha = None
    if bvals:
        benchmark_return = bvals[-1] / starting_cash - 1.0
        alpha = total_return - benchmark_return

    pnls = _realized_trade_pnls(trades)
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    win_rate = (len(wins) / len(pnls)) if pnls else None
    avg_win = (sum(wins) / len(wins)) if wins else None
    avg_loss = (sum(losses) / len(losses)) if losses else None

    days_target = evaluation_days
    status = "complete" if days_elapsed >= days_target else "in_progress"

    def r(x, n=6):
        return round(float(x), n) if x is not None else None

    return {
        "starting_cash": round(float(starting_cash), 2),
        "final_value": round(final_value, 2),
        "total_return": r(total_return),
        "cagr": r(cagr),
        "benchmark_return": r(benchmark_return),
        "alpha": r(alpha),
        "sharpe": r(_sharpe(pvals), 4),
        "max_drawdown": r(_max_drawdown(pvals)),
        "win_rate": r(win_rate, 4),
        "avg_win": r(avg_win, 2),
        "avg_loss": r(avg_loss, 2),
        "trades_closed": len(pnls),
        "days_elapsed": days_elapsed,
        "days_target": days_target,
        "status": status,
    }
