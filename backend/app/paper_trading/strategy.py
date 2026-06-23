"""Portfolio-construction strategy for the paper-trading engine.

``apply_signals_to_portfolio`` is the single strategy code path shared by the live
daily/intraday cycle (Phase 4) and the walk-forward backtester (Phase 3) — the only
difference is whether ``as_of`` is "today" or a replayed historical date.

This is a **target-weight portfolio manager** run like a discretionary money manager, not
an independent stock picker. On each cycle it:

  1. Marks the whole book to current prices and computes **total equity** (cash + positions).
  2. Selects the target holdings: names currently signaling ``buy``, plus names already held
     that are *not* signaling ``sell``, ranked by signal score and capped at ``max_positions``;
     names whose conviction has decayed to ≤ ``min_conviction`` are dropped (exited).
  3. **Sizes by conviction** — higher-scored ideas get a larger target weight (not naive
     equal-weight), each capped at ``max_position_pct`` for diversification.
  4. **Manages gross exposure dynamically** — total invested scales with the strength and
     breadth of conviction (``base_exposure_pct`` + mean conviction, capped at
     ``max_invested_pct``). Weak/few signals ⇒ raise cash and de-risk; strong broad signals
     ⇒ lean in. This is the risk-off lever a manager uses in poor regimes.
  5. **Applies a risk overlay** — per-position stop-loss (force-exit a holding down
     ``stop_loss_pct`` from its average cost), sector caps (``sector_cap_pct`` max in any
     one GICS sector, so a momentum signal can't pile into a single hot sector), and a
     portfolio drawdown brake (halve gross at ``dd_halve_pct`` off the high-water mark,
     flatten to cash at ``dd_flatten_pct``).
  6. **Rebalances toward those weights** — trimming overweight winners, topping up underweight
     names, exiting dropped/``sell`` names entirely — skipping drift smaller than
     ``rebalance_band_pct`` of equity to avoid churn/slippage.

Sizing is a fraction of *total equity*, not *remaining cash*, so positions are balanced and
order-independent (the old model produced declining, path-dependent sizes and left cash idle).
No shorting, no leverage: targets and trades are always ≥ 0.
"""
import logging
from typing import Optional

from sqlalchemy import select

from app.ml.sectors import sector_of
from app.models.paper_position import PaperPosition
from app.models.paper_trade import PaperTrade
from app.paper_trading.executor import ExecutionResult, TradeExecutor

logger = logging.getLogger(__name__)

DEFAULT_MAX_POSITIONS = 5
DEFAULT_MAX_INVESTED_PCT = 0.95      # hard ceiling on gross exposure; always keep some cash
DEFAULT_BASE_EXPOSURE_PCT = 0.45     # floor exposure; mean conviction is added on top
DEFAULT_MAX_POSITION_PCT = 0.20      # per-name concentration cap (diversification)
DEFAULT_MIN_CONVICTION = 0.0         # drop/exit names whose score has decayed to ≤ this
DEFAULT_REBALANCE_BAND_PCT = 0.05    # skip rebalance trades smaller than 5% of equity

# --- Risk overlay -------------------------------------------------------------------
# An attribution backtest isolated each control on the momentum strategy (2025-26, 54
# names): the per-position stop-loss was free-to-helpful (Sharpe 1.52 -> 1.57), the
# per-name and sector caps cost some upside but kept a diversified book that still beat
# SPY (Sharpe 1.38 / 1.16). The mechanical drawdown brake was *catastrophic* — alone it
# turned +70% into -12% (Sharpe -0.38) by flattening to cash at local bottoms and missing
# the recovery (momentum's edge requires sitting through volatility). So the brake is
# DISABLED by default (thresholds 1.0 = never triggers) but remains configurable.
DEFAULT_SECTOR_CAP_PCT = 0.30        # max book weight in any one GICS sector
DEFAULT_STOP_LOSS_PCT = 0.20         # force-exit a holding down this much from its avg cost
DEFAULT_DD_HALVE_PCT = 1.0           # drawdown brake disabled by default (toxic to momentum)
DEFAULT_DD_FLATTEN_PCT = 1.0         # disabled by default; set <1 to re-enable

_QTY_EPSILON = 1e-9


def _cap_and_redistribute(weights: dict[str, float], cap: float) -> dict[str, float]:
    """Cap each weight at ``cap`` and push the excess onto the uncapped names, iterating.

    Preserves the total weight (gross exposure) unless every name is capped. Keeps the
    book diversified without silently leaking exposure to cash on the first capped name.
    """
    w = dict(weights)
    for _ in range(len(w) + 1):
        over = {s: v for s, v in w.items() if v > cap + 1e-12}
        if not over:
            break
        excess = sum(v - cap for v in over.values())
        for s in over:
            w[s] = cap
        uncapped = [s for s in w if w[s] < cap - 1e-12]
        if not uncapped or excess <= 0:
            break
        share = excess / len(uncapped)
        for s in uncapped:
            w[s] = min(cap, w[s] + share)
    return w


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
    """Rebalance ``portfolio`` toward equal-weight target holdings for ``as_of``.

    ``signals``: list of dicts with ``symbol``, ``signal_label`` (buy/sell/hold), and
    optional ``signal_score``. ``prices``: symbol → reference (fill) price for ``as_of``;
    must cover every held name and every buy candidate. Returns the executed trades.
    """
    params = params or {}
    max_positions = int(params.get("max_positions", DEFAULT_MAX_POSITIONS))
    max_invested = float(params.get("target_invested_pct", DEFAULT_MAX_INVESTED_PCT))
    base_exposure = float(params.get("base_exposure_pct", DEFAULT_BASE_EXPOSURE_PCT))
    min_conviction = float(params.get("min_conviction", DEFAULT_MIN_CONVICTION))
    # Legacy ``position_size_pct`` (old per-cash sizing) is reinterpreted as the per-name
    # weight cap so existing backtest param grids still tune concentration meaningfully.
    max_pos_pct = float(
        params.get("max_position_pct", params.get("position_size_pct", DEFAULT_MAX_POSITION_PCT))
    )
    band = float(params.get("rebalance_band_pct", DEFAULT_REBALANCE_BAND_PCT))
    sector_cap = float(params.get("sector_cap_pct", DEFAULT_SECTOR_CAP_PCT))
    stop_loss = float(params.get("stop_loss_pct", DEFAULT_STOP_LOSS_PCT))
    dd_halve = float(params.get("dd_halve_pct", DEFAULT_DD_HALVE_PCT))
    dd_flatten = float(params.get("dd_flatten_pct", DEFAULT_DD_FLATTEN_PCT))

    positions = {
        p.symbol: p
        for p in db.execute(
            select(PaperPosition).where(PaperPosition.portfolio_id == portfolio.id)
        ).scalars()
    }
    cash = float(portfolio.current_cash)

    sig: dict[str, tuple[Optional[str], float]] = {}
    for s in signals:
        score = s.get("signal_score")
        sig[s["symbol"]] = (s.get("signal_label"), float(score) if score is not None else 0.0)

    def price_of(sym: str) -> Optional[float]:
        p = prices.get(sym)
        return float(p) if p is not None and p > 0 else None

    # --- Mark the book and compute total equity (cash + positions at current prices) ---
    positions_value = 0.0
    for sym, pos in positions.items():
        px = price_of(sym) or float(pos.avg_cost)  # hold at cost if no fresh mark
        positions_value += float(pos.quantity) * px
    equity = cash + positions_value
    if equity <= 0:
        return []

    # --- Select target holdings: buys + retained holds (exclude sells), ranked by score ---
    sell_syms = {sym for sym, (lbl, _) in sig.items() if lbl == "sell"}
    candidates: dict[str, float] = {}
    for sym in positions:  # keep currently-held names unless they signal sell
        if sym in sell_syms or price_of(sym) is None:
            continue
        candidates[sym] = sig.get(sym, ("hold", 0.0))[1]
    for sym, (lbl, score) in sig.items():  # add fresh buy candidates
        if lbl == "buy" and sym not in sell_syms and price_of(sym) is not None:
            candidates[sym] = score
    ranked = sorted(candidates.items(), key=lambda kv: kv[1], reverse=True)[:max_positions]
    # Conviction = positive score. Drop names with no remaining edge — a manager exits a
    # thesis that has decayed rather than holding it for its own sake.
    slate = [(sym, max(score, 0.0)) for sym, score in ranked if score > min_conviction]
    targets = {sym for sym, _ in slate}

    # --- Conviction-weighted target dollars with dynamic gross exposure ---
    target_dollars: dict[str, float] = {}
    if slate:
        mean_conviction = sum(c for _, c in slate) / len(slate)
        # Lean in when conviction is strong/broad; raise cash when it's weak. Bounded so we
        # never go past the gross ceiling and always retain a cash buffer.
        gross = max(0.0, min(max_invested, base_exposure + mean_conviction))
        total_conviction = sum(c for _, c in slate)
        if total_conviction > 0:
            rel = {sym: c / total_conviction for sym, c in slate}
        else:  # all exactly at the floor — fall back to equal weight
            rel = {sym: 1.0 / len(slate) for sym, _ in slate}
        abs_weights = _cap_and_redistribute({sym: w * gross for sym, w in rel.items()}, max_pos_pct)
        for sym, w in abs_weights.items():
            target_dollars[sym] = w * equity

    # --- Risk overlay: stop-loss, sector caps, drawdown brake -----------------
    # 1) Stop-loss: force-exit any holding down more than stop_loss from its average
    #    cost, and bar it from this cycle's targets (don't immediately re-buy a stop-out).
    if stop_loss > 0:
        for sym, pos in list(positions.items()):
            px = price_of(sym)
            if px is not None and px < float(pos.avg_cost) * (1.0 - stop_loss):
                target_dollars[sym] = 0.0
                targets.discard(sym)

    # 2) Sector cap: scale every name in an over-cap sector down pro-rata (excess → cash).
    if sector_cap > 0 and target_dollars:
        by_sector: dict[str, float] = {}
        for sym, dollars in target_dollars.items():
            by_sector[sector_of(sym)] = by_sector.get(sector_of(sym), 0.0) + dollars
        cap_dollars = sector_cap * equity
        for sym in list(target_dollars):
            sec_total = by_sector[sector_of(sym)]
            if sec_total > cap_dollars > 0:
                target_dollars[sym] *= cap_dollars / sec_total

    # 3) Drawdown brake: de-risk as the book draws down from its high-water mark.
    peak = float(portfolio.peak_value) if getattr(portfolio, "peak_value", None) else 0.0
    if peak > 0:
        drawdown = 1.0 - equity / peak
        if drawdown >= dd_flatten:
            target_dollars = {sym: 0.0 for sym in target_dollars}
        elif drawdown >= dd_halve:
            target_dollars = {sym: d * 0.5 for sym, d in target_dollars.items()}

    # --- Compute rebalance deltas (skip small drift on existing holdings) ---
    deltas: dict[str, tuple[float, float]] = {}
    for sym in set(positions) | targets:
        px = price_of(sym)
        if px is None:
            continue  # can't value or trade without a price — leave the position untouched
        cur_val = float(positions[sym].quantity) * px if sym in positions else 0.0
        tgt = target_dollars.get(sym, 0.0)
        delta = tgt - cur_val
        full_exit = tgt == 0.0 and sym in positions
        new_entry = sym not in positions and tgt > 0.0
        if not full_exit and not new_entry and abs(delta) < band * equity:
            continue  # within rebalance band — not worth the turnover
        deltas[sym] = (delta, px)

    trades: list[PaperTrade] = []

    # --- Sells first (most-negative delta first), freeing cash for the buys ---
    for sym, (delta, px) in sorted(deltas.items(), key=lambda kv: kv[1][0]):
        if delta >= 0:
            continue
        pos = positions.get(sym)
        if pos is None:
            continue
        sell_qty = min(float(pos.quantity), (-delta) / px)
        if sell_qty <= _QTY_EPSILON:
            continue
        res = executor.execute(sym, "sell", sell_qty, px)
        if not res.filled:
            continue
        cash += res.quantity * res.price
        trades.append(_record_trade(db, portfolio, res, as_of, sig.get(sym, (None, 0.0))[1]))
        remaining = float(pos.quantity) - res.quantity
        if remaining <= _QTY_EPSILON:
            db.delete(pos)
            del positions[sym]
        else:
            pos.quantity = remaining

    # --- Buys (largest delta first), constrained by available cash ---
    for sym, (delta, px) in sorted(deltas.items(), key=lambda kv: kv[1][0], reverse=True):
        if delta <= 0:
            continue
        spend = min(delta, cash)
        if spend <= 0:
            continue
        res = executor.execute(sym, "buy", spend / px, px)
        if not res.filled:
            continue
        cost = res.quantity * res.price
        if cost > cash:  # slippage nudged cost over cash — trim to fit
            res = res._replace(quantity=cash / res.price)
            cost = res.quantity * res.price
        if res.quantity <= _QTY_EPSILON:
            continue
        cash -= cost
        pos = positions.get(sym)
        if pos is None:
            pos = PaperPosition(
                portfolio_id=portfolio.id, symbol=sym, quantity=res.quantity, avg_cost=res.price
            )
            db.add(pos)
            positions[sym] = pos
        else:  # topping up — blend the average cost
            total_qty = float(pos.quantity) + res.quantity
            pos.avg_cost = (float(pos.quantity) * float(pos.avg_cost) + cost) / total_qty
            pos.quantity = total_qty
        trades.append(_record_trade(db, portfolio, res, as_of, sig.get(sym, (None, 0.0))[1]))

    portfolio.current_cash = cash
    db.add(portfolio)
    return trades
