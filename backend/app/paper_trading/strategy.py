"""Rules-based position sizing for the paper-trading engine.

``apply_signals_to_portfolio`` is the single strategy code path shared by the live
daily cycle (Phase 4) and the walk-forward backtester (Phase 3) — the only difference
is whether ``as_of`` is "today" or a replayed historical date.

Rules (no shorting, no leverage):
  * BUY signal  → open a position sized at ``position_size_pct`` of current cash,
    unless already held or at ``max_positions`` concurrent holdings.
  * SELL signal → sell the entire position to flat (if held).
  * HOLD        → do nothing.
Sells are processed before buys so freed cash and slots are reusable same-day.
"""
import logging
from typing import Optional

from sqlalchemy import select

from app.models.paper_position import PaperPosition
from app.models.paper_trade import PaperTrade
from app.paper_trading.executor import ExecutionResult, TradeExecutor

logger = logging.getLogger(__name__)

DEFAULT_POSITION_SIZE_PCT = 0.20
DEFAULT_MAX_POSITIONS = 5


def _record_trade(db, portfolio, res: ExecutionResult, as_of, signal_score) -> PaperTrade:
    trade = PaperTrade(
        portfolio_id=portfolio.id,
        symbol=res.symbol,
        side=res.side,
        quantity=res.quantity,
        price=res.price,
        executor_type=res.executor_type,
        signal_score=signal_score,
        as_of=as_of,
    )
    db.add(trade)
    return trade


def apply_signals_to_portfolio(
    db,
    portfolio,
    signals: list[dict],
    prices: dict[str, float],
    executor: TradeExecutor,
    params: Optional[dict],
    as_of,
) -> list[PaperTrade]:
    """Apply one day's signals to ``portfolio``, mutating cash/positions and writing trades.

    ``signals``: list of dicts with ``symbol``, ``signal_label`` (buy/sell/hold), and
    optional ``signal_score``. ``prices``: symbol → reference (fill) price for ``as_of``.
    Returns the list of executed trades.
    """
    params = params or {}
    pos_size_pct = float(params.get("position_size_pct", DEFAULT_POSITION_SIZE_PCT))
    max_positions = int(params.get("max_positions", DEFAULT_MAX_POSITIONS))

    positions = {
        p.symbol: p
        for p in db.execute(
            select(PaperPosition).where(PaperPosition.portfolio_id == portfolio.id)
        ).scalars()
    }
    cash = float(portfolio.current_cash)
    trades: list[PaperTrade] = []

    sells = [s for s in signals if s.get("signal_label") == "sell"]
    buys = [s for s in signals if s.get("signal_label") == "buy"]

    # --- Sells first: sell-to-flat, freeing cash and position slots ---
    for s in sells:
        sym = s["symbol"]
        pos = positions.get(sym)
        if pos is None:
            continue  # nothing to sell — never short
        price = prices.get(sym)
        if price is None or price <= 0:
            continue
        qty = float(pos.quantity)
        res = executor.execute(sym, "sell", qty, price)
        if not res.filled:
            continue
        cash += res.quantity * res.price
        trades.append(_record_trade(db, portfolio, res, as_of, s.get("signal_score")))
        db.delete(pos)
        del positions[sym]

    # --- Buys: fixed % of cash, capped at max_positions, no adding to held names ---
    for s in buys:
        sym = s["symbol"]
        if sym in positions:
            continue
        if len(positions) >= max_positions:
            continue
        price = prices.get(sym)
        if price is None or price <= 0:
            continue
        budget = cash * pos_size_pct
        if budget <= 0:
            continue
        qty = budget / price
        res = executor.execute(sym, "buy", qty, price)
        if not res.filled:
            continue
        cost = res.quantity * res.price
        if cost > cash:  # slippage nudged cost over available cash — trim to fit
            res = res._replace(quantity=cash / res.price)
            cost = res.quantity * res.price
        if res.quantity <= 0:
            continue
        cash -= cost
        pos = PaperPosition(
            portfolio_id=portfolio.id,
            symbol=sym,
            quantity=res.quantity,
            avg_cost=res.price,
        )
        db.add(pos)
        positions[sym] = pos
        trades.append(_record_trade(db, portfolio, res, as_of, s.get("signal_score")))

    portfolio.current_cash = cash
    db.add(portfolio)
    return trades
