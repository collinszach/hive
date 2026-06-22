"""Mark-to-market valuation + parallel benchmark for paper portfolios.

``mark_to_market`` values cash + positions at ``as_of`` reference prices and computes a
parallel SPY-equivalent buy-and-hold benchmark (the same starting cash invested in the
benchmark on day one), then upserts a daily ``PaperPerformanceSnapshot``.

Prices used here are raw closes, consistent with the fill prices the strategy uses, so
portfolio value and trade accounting reconcile.
"""
import logging
from datetime import date as date_type
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.paper_candle import PaperCandle
from app.models.paper_performance_snapshot import PaperPerformanceSnapshot
from app.models.paper_position import PaperPosition

logger = logging.getLogger(__name__)


def get_reference_prices(db, symbols: list[str], as_of: date_type) -> dict[str, float]:
    """Return {symbol: close} using the latest candle with ``date <= as_of`` per symbol.

    Point-in-time safe: never reads a bar after ``as_of``.
    """
    prices: dict[str, float] = {}
    for symbol in symbols:
        row = db.execute(
            select(PaperCandle.close)
            .where(PaperCandle.symbol == symbol, PaperCandle.date <= as_of)
            .order_by(PaperCandle.date.desc())
            .limit(1)
        ).scalar_one_or_none()
        if row is not None:
            prices[symbol] = float(row)
    return prices


def mark_to_market(
    db,
    portfolio,
    prices: dict[str, float],
    as_of: date_type,
    benchmark_price: Optional[float] = None,
) -> dict:
    """Value the portfolio at ``as_of`` and upsert a performance snapshot.

    ``prices``: symbol → current reference price. ``benchmark_price``: current price of
    the benchmark symbol (falls back to ``prices[benchmark_symbol]``). Returns a summary dict.
    """
    positions = db.execute(
        select(PaperPosition).where(PaperPosition.portfolio_id == portfolio.id)
    ).scalars().all()

    positions_value = 0.0
    for p in positions:
        px = prices.get(p.symbol)
        if px is None:
            px = float(p.avg_cost)  # no fresh mark — hold at cost
        positions_value += float(p.quantity) * float(px)

    cash = float(portfolio.current_cash)
    portfolio_value = cash + positions_value

    # Parallel benchmark: starting cash invested in the benchmark on day one.
    benchmark_value: Optional[float] = None
    bench_symbol = portfolio.benchmark_symbol or "SPY"
    bp = benchmark_price if benchmark_price is not None else prices.get(bench_symbol)
    if bp is not None and bp > 0:
        if portfolio.benchmark_start_price is None:
            portfolio.benchmark_start_price = bp
            db.add(portfolio)
        start = float(portfolio.benchmark_start_price)
        if start > 0:
            benchmark_value = float(portfolio.starting_cash) * (bp / start)

    stmt = pg_insert(PaperPerformanceSnapshot).values(
        portfolio_id=portfolio.id,
        as_of=as_of,
        cash=round(cash, 2),
        positions_value=round(positions_value, 2),
        portfolio_value=round(portfolio_value, 2),
        benchmark_value=round(benchmark_value, 2) if benchmark_value is not None else None,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_paper_perf_portfolio_asof",
        set_={
            "cash": stmt.excluded.cash,
            "positions_value": stmt.excluded.positions_value,
            "portfolio_value": stmt.excluded.portfolio_value,
            "benchmark_value": stmt.excluded.benchmark_value,
        },
    )
    db.execute(stmt)
    return {
        "as_of": as_of.isoformat(),
        "cash": round(cash, 2),
        "positions_value": round(positions_value, 2),
        "portfolio_value": round(portfolio_value, 2),
        "benchmark_value": round(benchmark_value, 2) if benchmark_value is not None else None,
    }
