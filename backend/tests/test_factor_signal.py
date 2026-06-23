"""Unit tests for the cross-sectional momentum factor signal (no DB)."""
from datetime import date, timedelta

import pandas as pd
import pytest

from app.ml.factor_signal import (
    _LOOKBACK,
    _MIN_ROWS,
    compute_momentum,
    score_cross_section,
)


def _candles(start_price, daily_growth, n=_MIN_ROWS + 5, start=date(2022, 1, 3)):
    """Synthetic daily candles compounding at ``daily_growth`` per bar."""
    rows = []
    price = start_price
    d = start
    for _ in range(n):
        rows.append({"date": d, "close": price, "adj_close": price})
        price *= (1.0 + daily_growth)
        d += timedelta(days=1)
    return pd.DataFrame(rows)


def test_momentum_positive_for_uptrend():
    df = _candles(100.0, 0.001)  # steadily rising
    mom = compute_momentum(df, df["date"].iloc[-1])
    assert mom is not None and mom > 0


def test_momentum_negative_for_downtrend():
    df = _candles(100.0, -0.001)  # steadily falling
    mom = compute_momentum(df, df["date"].iloc[-1])
    assert mom is not None and mom < 0


def test_momentum_none_without_enough_history():
    df = _candles(100.0, 0.001, n=_LOOKBACK - 10)
    assert compute_momentum(df, df["date"].iloc[-1]) is None


def test_momentum_is_point_in_time():
    """Truncating future bars must not change momentum at as_of (no lookahead)."""
    full = _candles(100.0, 0.001, n=_MIN_ROWS + 60)
    as_of = full["date"].iloc[_MIN_ROWS + 10]
    truncated = full[full["date"] <= as_of]
    assert compute_momentum(full, as_of) == pytest.approx(compute_momentum(truncated, as_of))


def test_cross_section_ranks_winners_buy_losers_sell():
    raw = {"WIN": 0.40, "MID": 0.10, "LOSE": -0.20}
    scored = score_cross_section(raw)
    assert scored["WIN"]["signal_label"] == "buy"
    assert scored["LOSE"]["signal_label"] == "sell"
    # Highest momentum gets the highest (most positive) score.
    assert scored["WIN"]["signal_score"] > scored["MID"]["signal_score"] > scored["LOSE"]["signal_score"]
    # Score is the conviction used for sizing — winner positive, loser negative.
    assert scored["WIN"]["signal_score"] > 0 > scored["LOSE"]["signal_score"]


def test_cross_section_flat_when_no_dispersion():
    raw = {"A": 0.1, "B": 0.1, "C": 0.1}  # identical → no relative information
    scored = score_cross_section(raw)
    assert all(v["signal_label"] == "hold" and v["signal_score"] == 0.0 for v in scored.values())


def test_cross_section_handles_single_name():
    scored = score_cross_section({"ONLY": 0.3})
    assert scored["ONLY"]["signal_label"] == "hold"  # nothing to rank against
