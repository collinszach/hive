"""Unit tests for the evaluation report — hand-computed fixtures."""
from datetime import date, timedelta

import pytest

from app.paper_trading.report import (
    _max_drawdown,
    _realized_trade_pnls,
    compute_evaluation_report,
)


def _snaps(values_and_bench, start=date(2024, 1, 1)):
    return [
        {"as_of": start + timedelta(days=i), "portfolio_value": pv, "benchmark_value": bv}
        for i, (pv, bv) in enumerate(values_and_bench)
    ]


def test_max_drawdown_basic():
    assert _max_drawdown([100, 110, 99]) == pytest.approx(99 / 110 - 1)  # -0.1
    assert _max_drawdown([100, 120, 140]) == pytest.approx(0.0)  # monotonic up
    assert _max_drawdown([]) == 0.0


def test_realized_pnls_win_and_loss():
    trades = [
        {"symbol": "AAPL", "side": "buy", "quantity": 10, "price": 100},
        {"symbol": "AAPL", "side": "sell", "quantity": 10, "price": 120},
        {"symbol": "TSLA", "side": "buy", "quantity": 5, "price": 200},
        {"symbol": "TSLA", "side": "sell", "quantity": 5, "price": 150},
    ]
    pnls = _realized_trade_pnls(trades)
    assert pnls == [pytest.approx(200.0), pytest.approx(-250.0)]


def test_report_metrics_hand_computed():
    snaps = _snaps([(100_000, 100_000), (110_000, 105_000), (99_000, 102_000)])
    trades = [
        {"symbol": "AAPL", "side": "buy", "quantity": 10, "price": 100},
        {"symbol": "AAPL", "side": "sell", "quantity": 10, "price": 120},
        {"symbol": "TSLA", "side": "buy", "quantity": 5, "price": 200},
        {"symbol": "TSLA", "side": "sell", "quantity": 5, "price": 150},
    ]
    r = compute_evaluation_report(100_000, snaps, trades)
    assert r["total_return"] == pytest.approx(-0.01)
    assert r["benchmark_return"] == pytest.approx(0.02)
    assert r["alpha"] == pytest.approx(-0.03)
    assert r["max_drawdown"] == pytest.approx(-0.1)
    assert r["win_rate"] == pytest.approx(0.5)
    assert r["avg_win"] == pytest.approx(200.0)
    assert r["avg_loss"] == pytest.approx(-250.0)
    assert r["trades_closed"] == 2
    assert r["days_elapsed"] == 2
    assert r["status"] == "in_progress"


def test_report_beta_and_jensen_alpha():
    # Portfolio daily return is exactly 2x the benchmark's each day → beta 2, alpha 0.
    bench = [100.0, 110.0, 104.5, 114.95]      # returns +10%, -5%, +10%
    port = [100.0, 120.0, 108.0, 129.6]        # returns +20%, -10%, +20%
    snaps = _snaps(list(zip(port, bench)))
    r = compute_evaluation_report(100.0, snaps, [])
    assert r["beta"] == pytest.approx(2.0, abs=0.02)
    assert r["alpha_annualized"] == pytest.approx(0.0, abs=1e-6)
    assert r["benchmark_sharpe"] is not None


def test_report_beta_null_without_enough_history():
    snaps = _snaps([(100_000, 100_000), (110_000, 105_000)])  # only 1 return
    r = compute_evaluation_report(100_000, snaps, [])
    assert r["beta"] is None
    assert r["alpha_annualized"] is None


def test_report_status_complete_after_window():
    snaps = _snaps([(100_000, 100_000)] + [(101_000, 100_500)])
    # stretch the last day past the 180-day window
    snaps[-1]["as_of"] = date(2024, 1, 1) + timedelta(days=200)
    r = compute_evaluation_report(100_000, snaps, [])
    assert r["days_elapsed"] == 200
    assert r["status"] == "complete"


def test_report_empty_snapshots_safe():
    r = compute_evaluation_report(100_000, [], [])
    assert r["final_value"] == 100_000
    assert r["total_return"] == 0.0
    assert r["win_rate"] is None
    assert r["status"] == "in_progress"


def test_report_no_benchmark_yields_null_alpha():
    snaps = [{"as_of": date(2024, 1, 1), "portfolio_value": 100_000, "benchmark_value": None},
             {"as_of": date(2024, 1, 2), "portfolio_value": 105_000, "benchmark_value": None}]
    r = compute_evaluation_report(100_000, snaps, [])
    assert r["benchmark_return"] is None
    assert r["alpha"] is None
    assert r["total_return"] == pytest.approx(0.05)
