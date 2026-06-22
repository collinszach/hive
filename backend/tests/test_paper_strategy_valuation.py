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
    )


def _position(symbol, qty, cost):
    return SimpleNamespace(portfolio_id="pf-1", symbol=symbol, quantity=qty, avg_cost=cost)


_NO_SLIP = SimulatedExecutor(slippage_bps=0)
_AS_OF = date(2024, 6, 3)


# --- strategy -----------------------------------------------------------------

def test_buy_opens_position_and_debits_cash():
    db = FakeSession()
    pf = _portfolio(cash=10_000.0)
    signals = [{"symbol": "AAPL", "signal_label": "buy", "signal_score": 0.6}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"AAPL": 100.0}, _NO_SLIP,
                                        {"position_size_pct": 0.2, "max_positions": 5}, _AS_OF)
    assert pf.current_cash == pytest.approx(8_000.0)  # spent 20% = 2000
    assert len(trades) == 1
    new_pos = [a for a in db.added if getattr(a, "symbol", None) == "AAPL" and hasattr(a, "quantity")]
    assert new_pos and float(new_pos[0].quantity) == pytest.approx(20.0)


def test_sell_to_flat_credits_cash_and_removes_position():
    pos = _position("AAPL", 20.0, 100.0)
    db = FakeSession(positions=[pos])
    pf = _portfolio(cash=8_000.0)
    signals = [{"symbol": "AAPL", "signal_label": "sell"}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"AAPL": 110.0}, _NO_SLIP, {}, _AS_OF)
    assert pf.current_cash == pytest.approx(8_000.0 + 20 * 110.0)  # 10,200
    assert pos in db.deleted
    assert len(trades) == 1


def test_no_short_sell_when_not_held():
    db = FakeSession(positions=[])
    pf = _portfolio(cash=5_000.0)
    signals = [{"symbol": "TSLA", "signal_label": "sell"}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"TSLA": 200.0}, _NO_SLIP, {}, _AS_OF)
    assert trades == []
    assert db.deleted == []
    assert pf.current_cash == pytest.approx(5_000.0)


def test_no_add_to_existing_position():
    pos = _position("AAPL", 10.0, 100.0)
    db = FakeSession(positions=[pos])
    pf = _portfolio(cash=10_000.0)
    signals = [{"symbol": "AAPL", "signal_label": "buy"}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"AAPL": 100.0}, _NO_SLIP, {}, _AS_OF)
    assert trades == []
    assert pf.current_cash == pytest.approx(10_000.0)


def test_max_positions_cap_blocks_new_buys():
    held = [_position(s, 1.0, 100.0) for s in ("A", "B", "C", "D", "E")]
    db = FakeSession(positions=held)
    pf = _portfolio(cash=10_000.0)
    signals = [{"symbol": "NEW", "signal_label": "buy"}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"NEW": 100.0}, _NO_SLIP,
                                        {"max_positions": 5}, _AS_OF)
    assert trades == []


def test_same_day_sell_frees_slot_for_buy():
    held = [_position(s, 1.0, 100.0) for s in ("A", "B", "C", "D", "E")]
    db = FakeSession(positions=held)
    pf = _portfolio(cash=10_000.0)
    signals = [
        {"symbol": "A", "signal_label": "sell"},
        {"symbol": "NEW", "signal_label": "buy"},
    ]
    trades = apply_signals_to_portfolio(db, pf, signals, {"A": 100.0, "NEW": 50.0}, _NO_SLIP,
                                        {"max_positions": 5, "position_size_pct": 0.1}, _AS_OF)
    sides = sorted(t.side for t in trades)
    assert sides == ["buy", "sell"]


def test_hold_signal_is_noop():
    db = FakeSession()
    pf = _portfolio(cash=10_000.0)
    signals = [{"symbol": "AAPL", "signal_label": "hold"}]
    trades = apply_signals_to_portfolio(db, pf, signals, {"AAPL": 100.0}, _NO_SLIP, {}, _AS_OF)
    assert trades == []
    assert pf.current_cash == pytest.approx(10_000.0)


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
