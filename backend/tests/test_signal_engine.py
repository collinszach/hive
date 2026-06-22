"""Unit tests for the signal engine — deterministic synthetic OHLCV.

Covers indicator correctness (RSI bounds, MACD sign), regime clustering, signal
scoring, and the point-in-time / anti-lookahead contract at the function level.
"""
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from app.ml import signal_engine as se


def _candles(prices, start=date(2023, 1, 2)):
    """Build a candle DataFrame from a close-price list (business-ish daily dates)."""
    dates = [start + timedelta(days=i) for i in range(len(prices))]
    p = np.asarray(prices, dtype=float)
    return pd.DataFrame({
        "date": dates,
        "open": p,
        "high": p * 1.01,
        "low": p * 0.99,
        "close": p,
        "volume": np.full(len(p), 1_000_000.0),
        "adj_close": p,
    })


def test_rsi_bounded_0_100_on_noisy_series():
    rng = np.random.default_rng(7)
    prices = 100 + np.cumsum(rng.normal(0, 1, 200))
    df = _candles(prices.tolist())
    ind = se.compute_technical_indicators(df, as_of=df["date"].iloc[-1])
    rsi = ind["rsi_14"].dropna()
    assert len(rsi) > 0
    assert rsi.min() >= 0.0
    assert rsi.max() <= 100.0


def test_rsi_saturates_high_on_pure_uptrend():
    prices = [100 + i for i in range(60)]  # monotonic up → no losses
    df = _candles(prices)
    ind = se.compute_technical_indicators(df, as_of=df["date"].iloc[-1])
    assert ind["rsi_14"].iloc[-1] == pytest.approx(100.0)


def test_macd_positive_on_uptrend_negative_on_downtrend():
    up = _candles([100 + i for i in range(80)])
    down = _candles([200 - i for i in range(80)])
    up_ind = se.compute_technical_indicators(up, as_of=up["date"].iloc[-1])
    down_ind = se.compute_technical_indicators(down, as_of=down["date"].iloc[-1])
    assert up_ind["macd"].iloc[-1] > 0
    assert down_ind["macd"].iloc[-1] < 0


def test_sma_ordering_reflects_trend():
    up = _candles([100 + i for i in range(80)])
    ind = se.compute_technical_indicators(up, as_of=up["date"].iloc[-1])
    assert ind["sma_20"].iloc[-1] > ind["sma_50"].iloc[-1]


def test_detect_regime_returns_valid_label_with_enough_data():
    rng = np.random.default_rng(3)
    prices = 100 + np.cumsum(rng.normal(0.1, 1.0, 150))
    df = _candles(prices.tolist())
    ind = se.compute_technical_indicators(df, as_of=df["date"].iloc[-1])
    regime = se.detect_regime(ind, as_of=df["date"].iloc[-1])
    assert regime in {"bullish", "neutral", "bearish"}


def test_detect_regime_unknown_when_insufficient():
    df = _candles([100 + i for i in range(10)])  # far too few rows
    ind = se.compute_technical_indicators(df, as_of=df["date"].iloc[-1])
    assert se.detect_regime(ind, as_of=df["date"].iloc[-1]) == "unknown"


def test_score_signal_buy_on_clean_bullish_row():
    # MACD>signal (+0.3), SMA20>SMA50 (+0.2), RSI neutral (0), bullish regime (+0.2) = 0.7
    row = pd.Series({"macd": 1.2, "macd_signal": 1.0, "sma_20": 105.0, "sma_50": 100.0, "rsi_14": 55.0})
    out = se.score_signal(row, "bullish")
    assert out["signal_score"] == pytest.approx(0.7)
    assert out["signal_label"] == "buy"


def test_score_signal_sell_on_clean_bearish_row():
    row = pd.Series({"macd": 0.8, "macd_signal": 1.0, "sma_20": 95.0, "sma_50": 100.0, "rsi_14": 45.0})
    out = se.score_signal(row, "bearish")
    assert out["signal_score"] == pytest.approx(-0.7)
    assert out["signal_label"] == "sell"


def test_score_signal_overbought_uptrend_trims_to_hold():
    # Trend up (+0.5) but RSI overbought (-0.3), neutral regime → 0.2, below buy threshold.
    row = pd.Series({"macd": 1.2, "macd_signal": 1.0, "sma_20": 105.0, "sma_50": 100.0, "rsi_14": 80.0})
    out = se.score_signal(row, "neutral")
    assert out["signal_score"] == pytest.approx(0.2)
    assert out["signal_label"] == "hold"


def test_composite_sell_on_downtrend():
    # A sustained decline: MACD<signal and SMA20<SMA50 dominate → net sell.
    df = _candles([200 - i for i in range(80)])
    sig = se.generate_signal_for_symbol(df, as_of=df["date"].iloc[-1])
    assert sig is not None
    assert sig["signal_score"] < 0
    assert sig["signal_label"] in {"sell", "hold"}


def test_score_signal_hold_on_missing_indicators():
    row = pd.Series({"macd": np.nan, "macd_signal": 1.0, "sma_20": 1.0, "sma_50": 1.0, "rsi_14": 50.0})
    out = se.score_signal(row, "neutral")
    assert out == {"signal_score": 0.0, "signal_label": "hold", "confidence": 0.0}


def test_signal_score_bounded():
    df = _candles([100 + i for i in range(80)])
    sig = se.generate_signal_for_symbol(df, as_of=df["date"].iloc[-1])
    assert -1.0 <= sig["signal_score"] <= 1.0
    assert 0.0 <= sig["confidence"] <= 1.0


# --- Anti-lookahead contract: full series vs truncated-at-as_of must match -----

def test_indicators_no_lookahead():
    rng = np.random.default_rng(11)
    # Big future spike that would distort any leaking indicator.
    body = 100 + np.cumsum(rng.normal(0, 1, 160))
    spike = body.copy()
    spike[120:] += 500  # huge move strictly after the as_of index
    full = _candles(spike.tolist())
    as_of = full["date"].iloc[100]

    truncated = full[full["date"] <= as_of].copy()
    ind_full = se.compute_technical_indicators(full, as_of=as_of)
    ind_trunc = se.compute_technical_indicators(truncated, as_of=as_of)

    pd.testing.assert_frame_equal(
        ind_full.reset_index(drop=True), ind_trunc.reset_index(drop=True)
    )


def test_regime_no_lookahead():
    rng = np.random.default_rng(13)
    body = 100 + np.cumsum(rng.normal(0.05, 1.0, 200))
    body[150:] += 1000  # future regime-shifting spike
    full = _candles(body.tolist())
    as_of = full["date"].iloc[120]

    ind_full = se.compute_technical_indicators(full, as_of=as_of)
    ind_trunc = se.compute_technical_indicators(
        full[full["date"] <= as_of].copy(), as_of=as_of
    )
    assert se.detect_regime(ind_full, as_of=as_of) == se.detect_regime(ind_trunc, as_of=as_of)


def test_full_signal_no_lookahead():
    rng = np.random.default_rng(17)
    body = 100 + np.cumsum(rng.normal(0, 1, 200))
    body[140:] += 800
    full = _candles(body.tolist())
    as_of = full["date"].iloc[110]

    sig_full = se.generate_signal_for_symbol(full, as_of=as_of)
    sig_trunc = se.generate_signal_for_symbol(full[full["date"] <= as_of].copy(), as_of=as_of)
    assert sig_full == sig_trunc
