"""Cash/position math for the strategy + valuation, via a lightweight fake session.

Real Postgres integration (upserts, the full backtest loop) is exercised end-to-end in
the Phase 3 backtest test. Here we isolate the arithmetic with no DB.
"""
from datetime import date
from types import SimpleNamespace

import pytest
from sqlalchemy import Select

from app.paper_trading.executor import SimulatedExecutor
from app.paper_trading.strategy import apply_signals_to_portfolio
from app.paper_trading.valuation import mark_to_market


class _Scalars:
    def __init__(self, items):
        self._items = list(items)

    def __iter__(self):
        return iter(self._items)

    def all(self):
        return list(self._items)


class _Result:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return _Scalars(self._items)


class FakeSession:
    """Answers any Select with the seeded positions; records add/delete; no-ops upserts."""

    def __init__(self, positions=None):
        self.positions = list(positions or [])
        self.added = []
        self.deleted = []

    def execute(self, stmt):
        if isinstance(stmt, Select):
            return _Result(self.positions)
        return SimpleNamespace()  # pg_insert upsert — ignored

    def add(self, obj):
        self.added.append(obj)

    def delete(self, obj):
        self.deleted.append(obj)


def _portfolio(cash=10_000.0, **kw):
    return SimpleNamespace(
        id="pf-1",
        current_cash=cash,
        starting_cash=kw.get("starting_cash", cash),
        benchmark_symbol=kw.get("benchmark_symbol", "SPY"),
        benchmark_start_price=kw.get("benchmark_start_price", None),
        peak_value=kw.get("peak_value", None),
    )


def _position(symbol, qty, cost):
    return SimpleNamespace(portfolio_id="pf-1", symbol=symbol, quantity=qty, avg_cost=cost)


_NO_SLIP = SimulatedExecutor(slippage_bps=0)
_AS_OF = date(2024, 6, 3)


# --- strategy (target-weight portfolio rebalancer) ----------------------------

def _qty_added(db, symbol):
    """Quantity bought for ``symbol`` across *positions* added this cycle.

    Both ``PaperPosition`` and ``PaperTrade`` carry ``symbol``/``quantity``; positions are
    distinguished by ``avg_cost`` so trades aren't double-counted.
    """
    return sum(
        float(a.quantity)
        for a in db.added
        if getattr(a, "symbol", None) == symbol and hasattr(a, "avg_cost")
    )


def test_conviction_weighting_sizes_best_idea_larger():
    """Higher-scored ideas get a larger target weight (not naive equal-weight)."""
    db = FakeSession()
    pf = _portfolio(cash=10_000.0)
    signals = [
        {"symbol": "AAPL", "signal_label": "buy", "signal_score": 0.6},
        {"symbol": "MSFT", "signal_label": "buy", "signal_score": 0.3},
        {"symbol": "GOOG", "signal_label": "buy", "signal_score": 0.1},
    ]
    prices = {"AAPL": 100.0, "MSFT": 100.0, "GOOG": 100.0}
    # Relax the caps so this isolates conviction sizing (caps have their own tests).
    params = {"max_positions": 5, "max_position_pct": 0.9, "sector_cap_pct": 1.0}
    apply_signals_to_portfolio(db, pf, signals, prices, _NO_SLIP, params, _AS_OF)
    qa, qm, qg = _qty_added(db, "AAPL"), _qty_added(db, "MSFT"), _qty_added(db, "GOOG")
    assert qa > qm > qg > 0  # sized by conviction, all funded


def test_dynamic_exposure_raises_cash_on_weak_conviction():
    """Weak/broad conviction ⇒ less invested (more cash) than strong conviction."""
    weak_signals = [{"symbol": s, "signal_label": "buy", "signal_score": 0.1}
                    for s in ("A", "B", "C")]
    strong_signals = [{"symbol": s, "signal_label": "buy", "signal_score": 0.6}
                      for s in ("A", "B", "C")]
    prices = {"A": 100.0, "B": 100.0, "C": 100.0}

    weak_db, weak_pf = FakeSession(), _portfolio(cash=10_000.0)
    apply_signals_to_portfolio(weak_db, weak_pf, weak_signals, prices, _NO_SLIP, {}, _AS_OF)

    strong_db, strong_pf = FakeSession(), _portfolio(cash=10_000.0)
    apply_signals_to_portfolio(strong_db, strong_pf, strong_signals, prices, _NO_SLIP, {}, _AS_OF)

    assert weak_pf.current_cash > strong_pf.current_cash  # de-risked when conviction is weak
    assert strong_pf.current_cash < 10_000.0  # but still deployed capital


def test_diversification_cap_limits_single_name():
    """A single high-conviction name is capped by ``max_position_pct`` (rest stays cash)."""
    db = FakeSession()
    pf = _portfolio(cash=10_000.0)
    signals = [{"symbol": "NVDA", "signal_label": "buy", "signal_score": 0.9}]
    apply_signals_to_portfolio(db, pf, signals, {"NVDA": 100.0}, _NO_SLIP,
                               {"max_position_pct": 0.3}, _AS_OF)
    assert _qty_added(db, "NVDA") == pytest.approx(30.0)  # 0.3 * 10_000 / 100
    assert pf.current_cash == pytest.approx(7_000.0)


def test_full_exit_on_sell_signal():
    pos = _position("AAPL", 20.0, 100.0)
    db = FakeSession(positions=[pos])
    pf = _portfolio(cash=8_000.0)
    signals = [{"symbol": "AAPL", "signal_label": "sell"}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"AAPL": 110.0}, _NO_SLIP, {}, _AS_OF)
    assert pf.current_cash == pytest.approx(8_000.0 + 20 * 110.0)  # 10,200
    assert pos in db.deleted
    assert [t.side for t in trades] == ["sell"]


def test_decayed_holding_rotated_into_better_idea():
    """Capital rotates: a held name with no edge is exited when a stronger idea wins the slot."""
    old = _position("OLD", 10.0, 100.0)
    db = FakeSession(positions=[old])
    pf = _portfolio(cash=0.0)  # fully invested in OLD; equity = 1_000
    signals = [
        {"symbol": "OLD", "signal_label": "hold", "signal_score": 0.0},
        {"symbol": "NEW", "signal_label": "buy", "signal_score": 0.6},
    ]
    prices = {"OLD": 100.0, "NEW": 100.0}
    trades = apply_signals_to_portfolio(db, pf, signals, prices, _NO_SLIP,
                                        {"max_positions": 1}, _AS_OF)
    assert old in db.deleted  # exited the decayed holding
    assert _qty_added(db, "NEW") > 0  # rotated into the better idea
    assert sorted(t.side for t in trades) == ["buy", "sell"]


def test_no_short_sell_when_not_held():
    db = FakeSession(positions=[])
    pf = _portfolio(cash=5_000.0)
    signals = [{"symbol": "TSLA", "signal_label": "sell"}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"TSLA": 200.0}, _NO_SLIP, {}, _AS_OF)
    assert trades == []
    assert db.deleted == []
    assert pf.current_cash == pytest.approx(5_000.0)


def test_max_positions_caps_holdings():
    db = FakeSession()
    pf = _portfolio(cash=10_000.0)
    signals = [
        {"symbol": s, "signal_label": "buy", "signal_score": score}
        for s, score in (("A", 0.6), ("B", 0.5), ("C", 0.4), ("D", 0.3), ("E", 0.2))
    ]
    prices = {s: 100.0 for s in ("A", "B", "C", "D", "E")}
    apply_signals_to_portfolio(db, pf, signals, prices, _NO_SLIP, {"max_positions": 3}, _AS_OF)
    bought = {a.symbol for a in db.added if hasattr(a, "quantity")}
    assert bought == {"A", "B", "C"}  # only the 3 highest-conviction names


def test_rebalance_band_skips_small_drift():
    """A holding already near its target weight is left alone (avoids churn/slippage)."""
    pos = _position("AAPL", 34.0, 100.0)  # 3_400 of a 10_000 book; target ≈ 3_500
    db = FakeSession(positions=[pos])
    pf = _portfolio(cash=6_600.0)
    signals = [{"symbol": "AAPL", "signal_label": "buy", "signal_score": 0.9}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"AAPL": 100.0}, _NO_SLIP,
                                        {"max_position_pct": 0.35, "rebalance_band_pct": 0.05},
                                        _AS_OF)
    assert trades == []  # 100 drift < 5% band (500) — no trade
    assert pf.current_cash == pytest.approx(6_600.0)


# --- risk overlay -------------------------------------------------------------

def test_stop_loss_forces_exit_despite_buy_signal():
    """A holding down past the stop is sold even when it still signals buy."""
    pos = _position("LOSE", 10.0, 100.0)
    db = FakeSession(positions=[pos])
    pf = _portfolio(cash=0.0)  # equity = 10 * 75 = 750
    signals = [{"symbol": "LOSE", "signal_label": "buy", "signal_score": 0.6}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"LOSE": 75.0}, _NO_SLIP,
                                        {"stop_loss_pct": 0.20}, _AS_OF)  # 75 < 100*0.8
    assert pos in db.deleted
    assert [t.side for t in trades] == ["sell"]


def test_sector_cap_limits_concentration():
    """Two same-sector winners are scaled so the sector stays within its cap."""
    db = FakeSession()
    pf = _portfolio(cash=10_000.0)
    # NVDA + AMD are both Information Technology in the sector map.
    signals = [
        {"symbol": "NVDA", "signal_label": "buy", "signal_score": 0.6},
        {"symbol": "AMD", "signal_label": "buy", "signal_score": 0.6},
    ]
    apply_signals_to_portfolio(db, pf, signals, {"NVDA": 100.0, "AMD": 100.0}, _NO_SLIP,
                               {"sector_cap_pct": 0.30, "max_position_pct": 0.20}, _AS_OF)
    it_value = (_qty_added(db, "NVDA") + _qty_added(db, "AMD")) * 100.0
    assert it_value == pytest.approx(3_000.0, rel=1e-3)  # capped at 30% of the book


def test_sector_cap_redistributes_excess_to_other_sectors():
    """Excess trimmed from a capped sector fills an under-cap sector, not cash."""
    db = FakeSession()
    pf = _portfolio(cash=10_000.0)
    # NVDA+AMD (Information Technology) over-cap; JPM (Financials) has room.
    signals = [
        {"symbol": "NVDA", "signal_label": "buy", "signal_score": 0.6},
        {"symbol": "AMD", "signal_label": "buy", "signal_score": 0.6},
        {"symbol": "JPM", "signal_label": "buy", "signal_score": 0.3},
    ]
    prices = {"NVDA": 100.0, "AMD": 100.0, "JPM": 100.0}
    apply_signals_to_portfolio(db, pf, signals, prices, _NO_SLIP,
                               {"sector_cap_pct": 0.30, "max_position_pct": 0.35}, _AS_OF)
    it_value = (_qty_added(db, "NVDA") + _qty_added(db, "AMD")) * 100.0
    jpm_value = _qty_added(db, "JPM") * 100.0
    assert it_value == pytest.approx(3_000.0, rel=1e-3)   # IT held at its 30% cap
    assert jpm_value == pytest.approx(3_000.0, rel=1e-3)  # filled to Financials' cap (was 2_500)


def test_drawdown_brake_flattens_to_cash():
    """Past the flatten threshold, all targets go to zero and holdings are sold."""
    pos = _position("AAPL", 75.0, 100.0)
    db = FakeSession(positions=[pos])
    pf = _portfolio(cash=300.0, peak_value=10_000.0)  # equity 7_800 → 22% drawdown
    signals = [{"symbol": "AAPL", "signal_label": "buy", "signal_score": 0.6}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"AAPL": 100.0}, _NO_SLIP,
                                        {"dd_flatten_pct": 0.20}, _AS_OF)
    assert pos in db.deleted  # flattened despite the buy signal
    assert pf.current_cash == pytest.approx(7_800.0)
    assert all(t.side == "sell" for t in trades)


# --- valuation ----------------------------------------------------------------

def test_mark_to_market_values_cash_plus_positions():
    pos = _position("AAPL", 20.0, 100.0)
    db = FakeSession(positions=[pos])
    pf = _portfolio(cash=8_000.0, starting_cash=10_000.0)
    out = mark_to_market(db, pf, {"AAPL": 110.0, "SPY": 400.0}, _AS_OF)
    assert out["positions_value"] == pytest.approx(2_200.0)
    assert out["portfolio_value"] == pytest.approx(10_200.0)
    # benchmark anchored on first mark → equals starting cash
    assert pf.benchmark_start_price == pytest.approx(400.0)
    assert out["benchmark_value"] == pytest.approx(10_000.0)


def test_benchmark_tracks_spy_growth():
    db = FakeSession(positions=[])
    pf = _portfolio(cash=10_000.0, starting_cash=10_000.0, benchmark_start_price=400.0)
    out = mark_to_market(db, pf, {"SPY": 440.0}, _AS_OF)
    assert out["benchmark_value"] == pytest.approx(11_000.0)  # +10%


def test_missing_price_falls_back_to_cost():
    pos = _position("AAPL", 10.0, 100.0)
    db = FakeSession(positions=[pos])
    pf = _portfolio(cash=0.0, starting_cash=1_000.0)
    out = mark_to_market(db, pf, {}, _AS_OF)  # no price for AAPL
    assert out["positions_value"] == pytest.approx(1_000.0)  # 10 * avg_cost 100
