"""Walk-forward backtesting engine — "learn from the past, no cheating."

Two anti-lookahead guarantees live here:

1. **Point-in-time replay.** At each simulated date ``t`` the engine generates signals via
   ``signal_engine.run_signal_generation(db, as_of=t)`` and prices via
   ``valuation.get_reference_prices(db, symbols, t)`` — both read only candles with
   ``date <= t`` — then drives the *same* ``apply_signals_to_portfolio`` /
   ``mark_to_market`` the live engine uses. Backtest and live differ only in whether
   ``t`` is historical or today.

2. **Train/validation split.** ``select_strategy_params`` tunes parameters on a *training*
   window only; the chosen params are then scored once on a later, untouched *validation*
   window. Tuning on the data you grade against is a subtler form of lookahead — this keeps
   them separate.
"""
import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from itertools import product
from typing import Optional

import numpy as np
from sqlalchemy import select

from app.models.paper_candle import PaperCandle
from app.models.paper_portfolio import PaperPortfolio
from app.models.paper_signal import PaperSignal
from app.ml.factor_signal import run_factor_signal_generation as run_signal_generation
from app.paper_trading.executor import get_executor
from app.paper_trading.strategy import apply_signals_to_portfolio
from app.paper_trading.valuation import get_reference_prices, mark_to_market

logger = logging.getLogger(__name__)

_TRADING_DAYS_PER_YEAR = 252
_DEFAULT_STARTING_CASH = 100_000.0
_BENCHMARK = "SPY"

# Small default parameter grid for the training search.
_DEFAULT_PARAM_GRID = {
    "position_size_pct": [0.10, 0.20],
    "max_positions": [3, 5],
    "rsi_oversold": [30.0],
    "rsi_overbought": [70.0],
}


@dataclass
class BacktestResult:
    portfolio_id: str
    start_date: date
    end_date: date
    starting_cash: float
    final_value: float
    total_return: float
    sharpe: float
    benchmark_final_value: Optional[float]
    benchmark_return: Optional[float]
    vs_benchmark: Optional[float]
    trading_days: int


def _sharpe(values: list[float]) -> float:
    """Annualized Sharpe of a portfolio-value series (risk-free rate assumed 0)."""
    if len(values) < 3:
        return 0.0
    arr = np.asarray(values, dtype=float)
    rets = arr[1:] / arr[:-1] - 1.0
    rets = rets[np.isfinite(rets)]
    sd = rets.std(ddof=1) if len(rets) > 1 else 0.0
    if sd == 0 or len(rets) == 0:
        return 0.0
    return float((rets.mean() / sd) * np.sqrt(_TRADING_DAYS_PER_YEAR))


def _trading_dates(db, symbols: list[str], start_date: date, end_date: date) -> list[date]:
    """Distinct candle dates in [start, end] across the symbols + benchmark, ascending."""
    syms = sorted(set(symbols) | {_BENCHMARK})
    rows = db.execute(
        select(PaperCandle.date)
        .where(
            PaperCandle.symbol.in_(syms),
            PaperCandle.date >= start_date,
            PaperCandle.date <= end_date,
        )
        .distinct()
        .order_by(PaperCandle.date)
    ).scalars().all()
    return list(rows)


def run_walk_forward_backtest(
    db,
    symbols: list[str],
    start_date: date,
    end_date: date,
    strategy_params: Optional[dict] = None,
    *,
    starting_cash: float = _DEFAULT_STARTING_CASH,
    status: str = "backtest",
) -> BacktestResult:
    """Replay [start_date, end_date] day-by-day against a fresh backtest portfolio.

    Returns a ``BacktestResult``. The created ``PaperPortfolio`` row persists (caller may
    keep it — e.g. the validation run referenced by a ``PaperBacktestRun`` — or delete it).
    """
    strategy_params = dict(strategy_params or {})
    signal_kwargs = {
        k: strategy_params[k]
        for k in ("rsi_oversold", "rsi_overbought")
        if k in strategy_params
    }
    syms = sorted(set(symbols))
    price_syms = sorted(set(syms) | {_BENCHMARK})

    portfolio = PaperPortfolio(
        name="Backtest",
        status=status,
        starting_cash=starting_cash,
        current_cash=starting_cash,
        strategy_params=strategy_params,
        benchmark_symbol=_BENCHMARK,
        started_at=datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc),
    )
    db.add(portfolio)
    db.flush()  # assign portfolio.id

    executor = get_executor()
    dates = _trading_dates(db, syms, start_date, end_date)

    portfolio_values: list[float] = []
    benchmark_values: list[float] = []
    # No-lookahead execution: signals generated from day t's close are executed at the
    # NEXT day's price, never at the same close that produced them. We carry the prior
    # day's signals forward and fill them at today's reference price.
    prev_signals: Optional[list[dict]] = None
    for t in dates:
        run_signal_generation(db, as_of=t, source="backtest", symbols=syms, **signal_kwargs)
        signal_rows = db.execute(
            select(PaperSignal.symbol, PaperSignal.signal_label, PaperSignal.signal_score)
            .where(PaperSignal.source == "backtest", PaperSignal.as_of == t, PaperSignal.symbol.in_(syms))
        ).all()
        signals = [
            {"symbol": s, "signal_label": lbl, "signal_score": float(score) if score is not None else None}
            for (s, lbl, score) in signal_rows
        ]
        prices = get_reference_prices(db, price_syms, t)
        if prev_signals is not None:
            apply_signals_to_portfolio(db, portfolio, prev_signals, prices, executor, strategy_params, t)
        snap = mark_to_market(db, portfolio, prices, t)
        portfolio_values.append(snap["portfolio_value"])
        if snap["benchmark_value"] is not None:
            benchmark_values.append(snap["benchmark_value"])
        prev_signals = signals

    db.flush()

    final_value = portfolio_values[-1] if portfolio_values else starting_cash
    total_return = (final_value / starting_cash - 1.0) if starting_cash else 0.0
    sharpe = _sharpe(portfolio_values)

    bench_final = benchmark_values[-1] if benchmark_values else None
    bench_return = (bench_final / starting_cash - 1.0) if bench_final else None
    vs_bench = (total_return - bench_return) if bench_return is not None else None

    return BacktestResult(
        portfolio_id=str(portfolio.id),
        start_date=start_date,
        end_date=end_date,
        starting_cash=starting_cash,
        final_value=round(final_value, 2),
        total_return=round(total_return, 6),
        sharpe=round(sharpe, 4),
        benchmark_final_value=round(bench_final, 2) if bench_final is not None else None,
        benchmark_return=round(bench_return, 6) if bench_return is not None else None,
        vs_benchmark=round(vs_bench, 6) if vs_bench is not None else None,
        trading_days=len(dates),
    )


def _delete_backtest_portfolio(db, portfolio_id: str) -> None:
    """Remove a transient search portfolio (cascades trades/positions/snapshots)."""
    pf = db.get(PaperPortfolio, portfolio_id)
    if pf is not None:
        db.delete(pf)
        db.flush()


def select_strategy_params(
    db,
    symbols: list[str],
    train_start: date,
    train_end: date,
    param_grid: Optional[dict] = None,
    *,
    starting_cash: float = _DEFAULT_STARTING_CASH,
) -> dict:
    """Grid-search strategy params on the **training window only**, scored by Sharpe.

    Returns ``{"params": {...}, "train_sharpe": float, "candidates": int}``. Each candidate
    runs a full walk-forward over the training window in its own transient portfolio, which
    is deleted after scoring so only the chosen config is later re-run for validation.
    """
    grid = param_grid or _DEFAULT_PARAM_GRID
    keys = list(grid.keys())
    combos = [dict(zip(keys, vals)) for vals in product(*(grid[k] for k in keys))]

    best_params: Optional[dict] = None
    best_sharpe = -np.inf
    for params in combos:
        result = run_walk_forward_backtest(
            db, symbols, train_start, train_end, params,
            starting_cash=starting_cash, status="backtest",
        )
        if result.sharpe > best_sharpe:
            best_sharpe = result.sharpe
            best_params = params
        _delete_backtest_portfolio(db, result.portfolio_id)

    if best_params is None:
        best_params = combos[0] if combos else {}
        best_sharpe = 0.0
    return {
        "params": best_params,
        "train_sharpe": round(float(best_sharpe), 4),
        "candidates": len(combos),
    }
