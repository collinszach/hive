"""Unit tests for trade executors — fills, slippage, and live-stub inertness."""
import pytest

from app.paper_trading.executor import (
    SimulatedExecutor,
    SnapTradeLiveExecutor,
    TradeExecutor,
    get_executor,
)


def test_simulated_buy_fills_above_reference():
    ex = SimulatedExecutor(slippage_bps=10)  # 0.10%
    res = ex.execute("AAPL", "buy", 10, 100.0)
    assert res.filled
    assert res.price == pytest.approx(100.10)
    assert res.quantity == 10
    assert res.executor_type == "simulated"


def test_simulated_sell_fills_below_reference():
    ex = SimulatedExecutor(slippage_bps=10)
    res = ex.execute("AAPL", "sell", 10, 100.0)
    assert res.filled
    assert res.price == pytest.approx(99.90)


def test_zero_slippage_fills_at_reference():
    ex = SimulatedExecutor(slippage_bps=0)
    assert ex.execute("AAPL", "buy", 5, 50.0).price == pytest.approx(50.0)


def test_invalid_quantity_not_filled():
    ex = SimulatedExecutor()
    assert ex.execute("AAPL", "buy", 0, 100.0).filled is False
    assert ex.execute("AAPL", "buy", -3, 100.0).filled is False


def test_invalid_price_not_filled():
    ex = SimulatedExecutor()
    assert ex.execute("AAPL", "buy", 5, 0.0).filled is False


def test_bad_side_not_filled():
    ex = SimulatedExecutor()
    assert ex.execute("AAPL", "hold", 5, 100.0).filled is False


def test_snaptrade_live_executor_is_inert():
    ex = SnapTradeLiveExecutor()
    assert isinstance(ex, TradeExecutor)
    with pytest.raises(NotImplementedError):
        ex.execute("AAPL", "buy", 1, 100.0)


def test_get_executor_returns_simulated():
    ex = get_executor()
    assert isinstance(ex, SimulatedExecutor)
    assert ex.executor_type == "simulated"
