"""Backtest-level anti-lookahead proofs ("no cheating") — real Postgres integration.

Skips automatically if no database is reachable (e.g. local Mac runs), so it only
executes where a throwaway Postgres is provided. The function-level proofs (full vs.
truncated series → identical indicators/regime/score) live in ``test_signal_engine.py``;
this file proves the property holds through the *whole* walk-forward loop and that
``select_strategy_params`` only reads the training window.

Construction: a synthetic candle series with a huge price spike planted strictly AFTER
the cutoff. If any future bar leaked into a past decision, the spike would change trades
and the portfolio-value series — so identical results before/after adding the spike is
the proof.
"""
from datetime import date, timedelta

import numpy as np
import pytest

sa = pytest.importorskip("sqlalchemy")
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.models  # noqa: E402,F401  (register all tables on Base.metadata)
from app.config import settings  # noqa: E402
from app.db import Base  # noqa: E402
from app.models.paper_candle import PaperCandle  # noqa: E402
from app.models.paper_watchlist_symbol import PaperWatchlistSymbol  # noqa: E402
from app.paper_trading.backtest import run_walk_forward_backtest, select_strategy_params  # noqa: E402


@pytest.fixture(scope="module")
def engine():
    try:
        eng = create_engine(settings.database_sync_url)
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # no DB available — skip the whole module
        pytest.skip(f"no database reachable for integration test: {exc}")
    Base.metadata.create_all(eng)
    return eng


_PAPER_TABLES = [
    "paper_performance_snapshots",
    "paper_trades",
    "paper_positions",
    "paper_backtest_runs",
    "paper_portfolios",
    "paper_signals",
    "paper_candles",
    "paper_watchlist_symbols",
]


@pytest.fixture
def db(engine):
    with Session(engine) as s:
        for tbl in _PAPER_TABLES:
            s.execute(text(f"TRUNCATE TABLE {tbl} CASCADE"))
        s.commit()
        yield s
        s.rollback()


def _seed_candles(db, symbol, prices, start=date(2022, 1, 3)):
    """Insert a deterministic OHLCV series (consecutive calendar days)."""
    for i, p in enumerate(prices):
        d = start + timedelta(days=i)
        db.add(PaperCandle(
            symbol=symbol, date=d,
            open=p, high=p * 1.01, low=p * 0.99, close=p, volume=1_000_000, adj_close=p,
        ))
    db.flush()


def _wave(n, base=100.0, amp=12.0, period=40, drift=0.05, seed=0):
    rng = np.random.default_rng(seed)
    x = np.arange(n)
    series = base + drift * x + amp * np.sin(2 * np.pi * x / period) + rng.normal(0, 0.6, n)
    return np.maximum(series, 1.0).tolist()


# ~80 warmup bars (indicators need 50) + a trading window.
_START = date(2022, 1, 3)
_WARMUP = 80
_WINDOW_DAYS = 45
_WINDOW_START = _START + timedelta(days=_WARMUP)
_WINDOW_END = _WINDOW_START + timedelta(days=_WINDOW_DAYS - 1)


def _seed_universe(db, n_bars):
    aapl = _wave(n_bars, base=100, amp=14, period=35, drift=0.08, seed=1)
    spy = _wave(n_bars, base=400, amp=20, period=50, drift=0.10, seed=2)
    _seed_candles(db, "AAPL", aapl)
    _seed_candles(db, "SPY", spy)
    db.add(PaperWatchlistSymbol(symbol="AAPL", is_active=True))
    db.flush()


def test_walk_forward_runs_and_marks(db):
    _seed_universe(db, _WARMUP + _WINDOW_DAYS)
    result = run_walk_forward_backtest(db, ["AAPL"], _WINDOW_START, _WINDOW_END,
                                       {"position_size_pct": 0.2, "max_positions": 3})
    assert result.trading_days > 0
    assert result.final_value > 0
    assert result.benchmark_return is not None
    snaps = db.execute(text(
        "SELECT count(*) FROM paper_performance_snapshots WHERE portfolio_id = :p"
    ), {"p": result.portfolio_id}).scalar()
    assert snaps == result.trading_days


def _portfolio_value_series(db, portfolio_id):
    rows = db.execute(text(
        "SELECT as_of, portfolio_value FROM paper_performance_snapshots "
        "WHERE portfolio_id = :p ORDER BY as_of"
    ), {"p": portfolio_id}).all()
    return [(r[0], float(r[1])) for r in rows]


def test_future_candles_do_not_change_past_backtest(db):
    """The core no-cheating proof at the loop level."""
    params = {"position_size_pct": 0.2, "max_positions": 3}

    # Run 1: candles exist only through the window end.
    _seed_universe(db, _WARMUP + _WINDOW_DAYS)
    res1 = run_walk_forward_backtest(db, ["AAPL"], _WINDOW_START, _WINDOW_END, params)
    series1 = _portfolio_value_series(db, res1.portfolio_id)

    # Plant a massive price spike strictly AFTER the window, then re-run the SAME window.
    future_start = _START + timedelta(days=_WARMUP + _WINDOW_DAYS)
    spike = [10_000.0 + i for i in range(30)]
    _seed_candles(db, "AAPL", spike, start=future_start)
    _seed_candles(db, "SPY", spike, start=future_start)

    res2 = run_walk_forward_backtest(db, ["AAPL"], _WINDOW_START, _WINDOW_END, params)
    series2 = _portfolio_value_series(db, res2.portfolio_id)

    assert series1 == series2  # future data never reached a past decision
    assert res1.final_value == res2.final_value
    assert res1.sharpe == res2.sharpe


def test_select_strategy_params_ignores_post_train_data(db):
    grid = {"position_size_pct": [0.1, 0.2], "max_positions": [3, 5],
            "rsi_oversold": [30.0], "rsi_overbought": [70.0]}

    _seed_universe(db, _WARMUP + _WINDOW_DAYS)
    sel1 = select_strategy_params(db, ["AAPL"], _WINDOW_START, _WINDOW_END, grid)

    # Add post-train candles that would change scoring IF they leaked into the search.
    future_start = _START + timedelta(days=_WARMUP + _WINDOW_DAYS)
    spike = [10_000.0 + i for i in range(30)]
    _seed_candles(db, "AAPL", spike, start=future_start)
    _seed_candles(db, "SPY", spike, start=future_start)

    sel2 = select_strategy_params(db, ["AAPL"], _WINDOW_START, _WINDOW_END, grid)

    assert sel1["params"] == sel2["params"]
    assert sel1["train_sharpe"] == sel2["train_sharpe"]
