"""Celery tasks for the paper-trading signal engine.

All paper-trading tasks live in this module. Phase 1 covers market-data ingestion:
``backfill_historical_candles`` (one-time/on-demand multi-year pull the backtester
learns from) and ``fetch_market_data`` (ongoing daily latest-bar fetch). Later phases
add ``generate_signals``, ``run_backtest``, and ``run_simulation_cycle`` here.

Follows the sync-session + retry/rollback shape of ``app/tasks/snaptrade_sync.py`` and
skips gracefully when no market-data key is configured (``get_connector() is None``).
"""
import logging
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.celery_app import app
from app.db import get_sync_db
from app.marketdata.connector import get_connector
from app.models.paper_candle import PaperCandle
from app.models.paper_watchlist_symbol import PaperWatchlistSymbol

logger = logging.getLogger(__name__)

# Benchmark symbol always tracked alongside the watchlist (SPY-equivalent).
BENCHMARK_SYMBOL = "SPY"
# How far back to pull on a full backfill. Tiingo free EOD reaches back decades;
# several years is plenty for walk-forward train/validation.
_BACKFILL_YEARS = 6


def _active_symbols(db) -> list[str]:
    """Distinct active watchlist symbols + the benchmark, upper-cased and deduped."""
    rows = db.execute(
        select(PaperWatchlistSymbol.symbol).where(
            PaperWatchlistSymbol.is_active == True  # noqa: E712
        )
    ).scalars().all()
    symbols = {s.strip().upper() for s in rows if s and s.strip()}
    symbols.add(BENCHMARK_SYMBOL)
    return sorted(symbols)


def _upsert_candles(db, symbol: str, candles: list[dict]) -> int:
    """Bulk-upsert candles for one symbol on the (symbol, date) unique key."""
    written = 0
    for bar in candles:
        if bar.get("date") is None:
            continue
        stmt = pg_insert(PaperCandle).values(
            symbol=symbol,
            date=bar["date"],
            open=bar.get("open"),
            high=bar.get("high"),
            low=bar.get("low"),
            close=bar.get("close"),
            volume=bar.get("volume"),
            adj_close=bar.get("adj_close"),
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_paper_candle_symbol_date",
            set_={
                "open": stmt.excluded.open,
                "high": stmt.excluded.high,
                "low": stmt.excluded.low,
                "close": stmt.excluded.close,
                "volume": stmt.excluded.volume,
                "adj_close": stmt.excluded.adj_close,
                "updated_at": func.now(),
            },
        )
        db.execute(stmt)
        written += 1
    return written


@app.task(
    name="app.tasks.paper_trading.backfill_historical_candles",
    bind=True,
    max_retries=3,
    default_retry_delay=120,
)
def backfill_historical_candles(self, years: int = _BACKFILL_YEARS) -> dict:
    """One-time/on-demand: pull several years of daily candles for every watchlist
    symbol + SPY and upsert into ``paper_candles``. This is the data the backtest
    learns from. Idempotent — safe to re-run (upserts).
    """
    connector = get_connector()
    if connector is None:
        logger.info("backfill_historical_candles: market data not configured, skipping")
        return {"symbols": 0, "candles": 0, "skipped": "not configured"}

    db = get_sync_db()
    try:
        symbols = _active_symbols(db)
        start = date.today() - timedelta(days=365 * years)
        total_candles = 0
        per_symbol: dict[str, int] = {}
        for symbol in symbols:
            try:
                candles = connector.get_candles(symbol, start=start)
            except Exception:
                logger.exception("backfill: fetch failed for %s", symbol)
                continue
            n = _upsert_candles(db, symbol, candles)
            per_symbol[symbol] = n
            total_candles += n
        db.commit()
        logger.info(
            "backfill_historical_candles: symbols=%d candles=%d", len(symbols), total_candles
        )
        return {"symbols": len(symbols), "candles": total_candles, "per_symbol": per_symbol}
    except Exception as exc:
        logger.exception("backfill_historical_candles failed")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@app.task(
    name="app.tasks.paper_trading.run_backtest",
    bind=True,
    max_retries=1,
    default_retry_delay=120,
)
def run_backtest(
    self,
    symbols: list[str],
    train_start: str,
    train_end: str,
    validation_start: str,
    validation_end: str,
    param_grid: Optional[dict] = None,
    starting_cash: float = 100_000.0,
) -> dict:
    """On-demand: learn params on the training window, score once on the validation
    window, and write a durable ``PaperBacktestRun``. Dates are ISO strings (YYYY-MM-DD).

    Backfills candles first if the watchlist symbols have none cached yet.
    """
    from datetime import date as _date

    from app.models.paper_backtest_run import PaperBacktestRun
    from app.models.paper_candle import PaperCandle
    from app.paper_trading.backtest import run_walk_forward_backtest, select_strategy_params

    syms = sorted({s.strip().upper() for s in symbols if s and s.strip()})
    ts, te = _date.fromisoformat(train_start), _date.fromisoformat(train_end)
    vs, ve = _date.fromisoformat(validation_start), _date.fromisoformat(validation_end)

    db = get_sync_db()
    try:
        # Ensure we have data to learn from.
        have = db.execute(
            select(func.count()).select_from(PaperCandle).where(PaperCandle.symbol.in_(syms + [BENCHMARK_SYMBOL]))
        ).scalar() or 0
        if have == 0:
            logger.info("run_backtest: no candles cached, backfilling first")
            backfill_historical_candles.run()

        selection = select_strategy_params(db, syms, ts, te, param_grid, starting_cash=starting_cash)
        params = selection["params"]
        train_sharpe = selection["train_sharpe"]

        validation = run_walk_forward_backtest(
            db, syms, vs, ve, params, starting_cash=starting_cash, status="backtest"
        )

        run = PaperBacktestRun(
            portfolio_id=validation.portfolio_id,
            train_start=ts,
            train_end=te,
            validation_start=vs,
            validation_end=ve,
            selected_params=params,
            train_sharpe=train_sharpe,
            validation_sharpe=validation.sharpe,
            validation_total_return=validation.total_return,
            validation_vs_benchmark=validation.vs_benchmark,
        )
        db.add(run)
        db.commit()
        logger.info(
            "run_backtest: train_sharpe=%s validation_sharpe=%s params=%s",
            train_sharpe, validation.sharpe, params,
        )
        return {
            "backtest_run_id": str(run.id),
            "selected_params": params,
            "train_sharpe": train_sharpe,
            "validation_sharpe": validation.sharpe,
            "validation_total_return": validation.total_return,
            "validation_vs_benchmark": validation.vs_benchmark,
        }
    except Exception as exc:
        logger.exception("run_backtest failed")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@app.task(
    name="app.tasks.paper_trading.generate_signals",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def generate_signals(self) -> dict:
    """Ongoing daily: generate live signals for every watchlist symbol as of today.

    Calls the same point-in-time signal engine the backtester uses, with
    ``as_of=today`` and ``source="live"``.
    """
    from app.ml.signal_engine import run_signal_generation

    db = get_sync_db()
    try:
        result = run_signal_generation(db, as_of=date.today(), source="live")
        db.commit()
        logger.info("generate_signals: %s", result)
        return result
    except Exception as exc:
        logger.exception("generate_signals failed")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@app.task(
    name="app.tasks.paper_trading.run_simulation_cycle",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def run_simulation_cycle(self) -> dict:
    """The daily 'trading day' for live paper portfolios: apply today's signals via the
    simulated executor, then mark-to-market. Skips portfolios past their evaluation window.
    """
    from datetime import datetime, timezone

    from app.models.paper_portfolio import PaperPortfolio
    from app.models.paper_signal import PaperSignal
    from app.paper_trading.executor import get_executor
    from app.paper_trading.strategy import apply_signals_to_portfolio
    from app.paper_trading.valuation import get_reference_prices, mark_to_market

    db = get_sync_db()
    try:
        as_of = date.today()
        now = datetime.now(timezone.utc)
        portfolios = db.execute(
            select(PaperPortfolio).where(PaperPortfolio.status == "live")
        ).scalars().all()

        executor = get_executor()
        processed = 0
        for pf in portfolios:
            if pf.evaluation_ends_at is not None and now > pf.evaluation_ends_at:
                continue  # evaluation window closed — stop trading this portfolio
            signal_rows = db.execute(
                select(PaperSignal.symbol, PaperSignal.signal_label, PaperSignal.signal_score)
                .where(PaperSignal.source == "live", PaperSignal.as_of == as_of)
            ).all()
            signals = [
                {"symbol": s, "signal_label": lbl, "signal_score": score}
                for (s, lbl, score) in signal_rows
            ]
            symbols = sorted({s["symbol"] for s in signals} | {pf.benchmark_symbol or BENCHMARK_SYMBOL})
            prices = get_reference_prices(db, symbols, as_of)
            apply_signals_to_portfolio(db, pf, signals, prices, executor, pf.strategy_params, as_of)
            mark_to_market(db, pf, prices, as_of)
            processed += 1

        db.commit()
        logger.info("run_simulation_cycle: portfolios=%d as_of=%s", processed, as_of)
        return {"portfolios": processed, "as_of": as_of.isoformat()}
    except Exception as exc:
        logger.exception("run_simulation_cycle failed")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@app.task(
    name="app.tasks.paper_trading.fetch_market_data",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def fetch_market_data(self) -> dict:
    """Ongoing daily: pull just the latest candle per watchlist symbol + SPY and
    upsert. Runs post-close on the beat schedule.
    """
    connector = get_connector()
    if connector is None:
        logger.info("fetch_market_data: market data not configured, skipping")
        return {"symbols": 0, "candles": 0, "skipped": "not configured"}

    db = get_sync_db()
    try:
        symbols = _active_symbols(db)
        total = 0
        for symbol in symbols:
            try:
                bar = connector.get_quote(symbol)
            except Exception:
                logger.exception("fetch_market_data: fetch failed for %s", symbol)
                continue
            if bar is not None:
                total += _upsert_candles(db, symbol, [bar])
        db.commit()
        logger.info("fetch_market_data: symbols=%d candles=%d", len(symbols), total)
        return {"symbols": len(symbols), "candles": total}
    except Exception as exc:
        logger.exception("fetch_market_data failed")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()
