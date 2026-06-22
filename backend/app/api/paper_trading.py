"""Paper-trading API — virtual portfolio, signals, trades, performance, backtests.

Gated by the existing ``require_snaptrade`` dependency (Pro plan or admin). This surface
is deliberately separate from the real-money SnapTrade router and never feeds the
"not investment advice" advisor — it describes a sandboxed simulation only.
"""
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.gates import require_snaptrade
from app.models.paper_backtest_run import PaperBacktestRun
from app.models.paper_performance_snapshot import PaperPerformanceSnapshot
from app.models.paper_portfolio import PaperPortfolio
from app.models.paper_signal import PaperSignal
from app.models.paper_trade import PaperTrade
from app.models.paper_watchlist_symbol import PaperWatchlistSymbol
from app.models.user import User
from app.paper_trading.report import EVALUATION_DAYS, compute_evaluation_report

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/paper-trading", tags=["paper-trading"])

_DEFAULT_STARTING_CASH = 100_000.0


# ----------------------------- response models ------------------------------

class PortfolioOut(BaseModel):
    id: str
    name: str
    status: str
    starting_cash: float
    current_cash: float
    strategy_params: Optional[dict] = None
    benchmark_symbol: str
    started_at: Optional[datetime] = None
    evaluation_ends_at: Optional[datetime] = None


class SignalOut(BaseModel):
    symbol: str
    as_of: date
    signal_score: float
    signal_label: str
    confidence: float
    regime_label: Optional[str] = None
    indicators: Optional[dict] = None
    source: str


class TradeOut(BaseModel):
    id: str
    symbol: str
    side: str
    quantity: float
    price: float
    executor_type: str
    signal_score: Optional[float] = None
    as_of: date
    executed_at: Optional[datetime] = None


class PerformancePointOut(BaseModel):
    as_of: date
    cash: float
    positions_value: float
    portfolio_value: float
    benchmark_value: Optional[float] = None


class WatchlistSymbolOut(BaseModel):
    symbol: str
    is_active: bool


class BacktestRunOut(BaseModel):
    id: str
    portfolio_id: Optional[str] = None
    train_start: date
    train_end: date
    validation_start: date
    validation_end: date
    selected_params: Optional[dict] = None
    train_sharpe: Optional[float] = None
    validation_sharpe: Optional[float] = None
    validation_total_return: Optional[float] = None
    validation_vs_benchmark: Optional[float] = None
    created_at: Optional[datetime] = None


# ----------------------------- request models -------------------------------

class CreatePortfolioIn(BaseModel):
    name: str = "Paper Portfolio"
    starting_cash: float = _DEFAULT_STARTING_CASH
    strategy_params: Optional[dict] = None
    benchmark_symbol: str = "SPY"


class AddSymbolIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=12)


class BacktestRequestIn(BaseModel):
    symbols: list[str]
    train_start: date
    train_end: date
    validation_start: date
    validation_end: date
    param_grid: Optional[dict] = None
    starting_cash: float = _DEFAULT_STARTING_CASH


# ------------------------------- helpers ------------------------------------

def _portfolio_out(p: PaperPortfolio) -> PortfolioOut:
    return PortfolioOut(
        id=str(p.id),
        name=p.name,
        status=p.status,
        starting_cash=float(p.starting_cash),
        current_cash=float(p.current_cash),
        strategy_params=p.strategy_params,
        benchmark_symbol=p.benchmark_symbol,
        started_at=p.started_at,
        evaluation_ends_at=p.evaluation_ends_at,
    )


async def _current_portfolio(db: AsyncSession, user: User) -> Optional[PaperPortfolio]:
    return (await db.execute(
        select(PaperPortfolio)
        .where(PaperPortfolio.user_id == user.id, PaperPortfolio.status == "live")
        .order_by(desc(PaperPortfolio.created_at))
        .limit(1)
    )).scalar_one_or_none()


# ------------------------------- portfolio ----------------------------------

@router.post("/portfolio", response_model=PortfolioOut)
async def create_portfolio(
    body: CreatePortfolioIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> PortfolioOut:
    """Create a live forward paper portfolio with a 6-month evaluation window."""
    now = datetime.now(timezone.utc)
    pf = PaperPortfolio(
        user_id=user.id,
        name=body.name,
        status="live",
        starting_cash=body.starting_cash,
        current_cash=body.starting_cash,
        strategy_params=body.strategy_params,
        benchmark_symbol=body.benchmark_symbol,
        started_at=now,
        evaluation_ends_at=now + timedelta(days=EVALUATION_DAYS),
    )
    db.add(pf)
    await db.flush()
    return _portfolio_out(pf)


@router.get("/portfolio", response_model=PortfolioOut)
async def get_portfolio(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> PortfolioOut:
    pf = await _current_portfolio(db, user)
    if pf is None:
        raise HTTPException(status_code=404, detail="No paper portfolio yet")
    return _portfolio_out(pf)


# -------------------------------- signals -----------------------------------

@router.get("/signals", response_model=list[SignalOut])
async def list_signals(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> list[SignalOut]:
    """Latest live signals, most recent first."""
    rows = (await db.execute(
        select(PaperSignal)
        .where(PaperSignal.source == "live")
        .order_by(desc(PaperSignal.as_of), PaperSignal.symbol)
        .limit(min(limit, 500))
    )).scalars().all()
    return [
        SignalOut(
            symbol=s.symbol, as_of=s.as_of, signal_score=float(s.signal_score),
            signal_label=s.signal_label, confidence=float(s.confidence),
            regime_label=s.regime_label, indicators=s.indicators, source=s.source,
        )
        for s in rows
    ]


# --------------------------------- trades -----------------------------------

@router.get("/trades", response_model=list[TradeOut])
async def list_trades(
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> list[TradeOut]:
    pf = await _current_portfolio(db, user)
    if pf is None:
        return []
    rows = (await db.execute(
        select(PaperTrade)
        .where(PaperTrade.portfolio_id == pf.id)
        .order_by(desc(PaperTrade.as_of), desc(PaperTrade.executed_at))
        .limit(min(limit, 1000))
    )).scalars().all()
    return [
        TradeOut(
            id=str(t.id), symbol=t.symbol, side=t.side, quantity=float(t.quantity),
            price=float(t.price), executor_type=t.executor_type,
            signal_score=float(t.signal_score) if t.signal_score is not None else None,
            as_of=t.as_of, executed_at=t.executed_at,
        )
        for t in rows
    ]


# ------------------------------ performance ---------------------------------

@router.get("/performance", response_model=list[PerformancePointOut])
async def performance_series(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> list[PerformancePointOut]:
    pf = await _current_portfolio(db, user)
    if pf is None:
        return []
    rows = (await db.execute(
        select(PaperPerformanceSnapshot)
        .where(PaperPerformanceSnapshot.portfolio_id == pf.id)
        .order_by(PaperPerformanceSnapshot.as_of)
    )).scalars().all()
    return [
        PerformancePointOut(
            as_of=r.as_of, cash=float(r.cash), positions_value=float(r.positions_value),
            portfolio_value=float(r.portfolio_value),
            benchmark_value=float(r.benchmark_value) if r.benchmark_value is not None else None,
        )
        for r in rows
    ]


# ------------------------------ evaluation ----------------------------------

@router.get("/report")
async def evaluation_report(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> dict:
    pf = await _current_portfolio(db, user)
    if pf is None:
        raise HTTPException(status_code=404, detail="No paper portfolio yet")
    snaps = (await db.execute(
        select(PaperPerformanceSnapshot)
        .where(PaperPerformanceSnapshot.portfolio_id == pf.id)
        .order_by(PaperPerformanceSnapshot.as_of)
    )).scalars().all()
    trades = (await db.execute(
        select(PaperTrade).where(PaperTrade.portfolio_id == pf.id).order_by(PaperTrade.executed_at)
    )).scalars().all()
    report = compute_evaluation_report(
        starting_cash=float(pf.starting_cash),
        snapshots=[
            {"as_of": s.as_of, "portfolio_value": float(s.portfolio_value),
             "benchmark_value": float(s.benchmark_value) if s.benchmark_value is not None else None}
            for s in snaps
        ],
        trades=[{"symbol": t.symbol, "side": t.side, "quantity": float(t.quantity), "price": float(t.price)}
                for t in trades],
    )
    report["portfolio_id"] = str(pf.id)
    return report


# ------------------------------- watchlist ----------------------------------

@router.get("/watchlist", response_model=list[WatchlistSymbolOut])
async def list_watchlist(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> list[WatchlistSymbolOut]:
    rows = (await db.execute(
        select(PaperWatchlistSymbol)
        .where(PaperWatchlistSymbol.user_id == user.id)
        .order_by(PaperWatchlistSymbol.symbol)
    )).scalars().all()
    return [WatchlistSymbolOut(symbol=r.symbol, is_active=r.is_active) for r in rows]


@router.post("/watchlist", response_model=WatchlistSymbolOut)
async def add_watchlist_symbol(
    body: AddSymbolIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> WatchlistSymbolOut:
    symbol = body.symbol.strip().upper()
    existing = (await db.execute(
        select(PaperWatchlistSymbol).where(
            PaperWatchlistSymbol.user_id == user.id, PaperWatchlistSymbol.symbol == symbol
        )
    )).scalar_one_or_none()
    if existing is not None:
        existing.is_active = True
        await db.flush()
        return WatchlistSymbolOut(symbol=existing.symbol, is_active=existing.is_active)
    row = PaperWatchlistSymbol(user_id=user.id, symbol=symbol, is_active=True)
    db.add(row)
    await db.flush()
    return WatchlistSymbolOut(symbol=row.symbol, is_active=row.is_active)


@router.delete("/watchlist/{symbol}")
async def remove_watchlist_symbol(
    symbol: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> dict:
    row = (await db.execute(
        select(PaperWatchlistSymbol).where(
            PaperWatchlistSymbol.user_id == user.id,
            PaperWatchlistSymbol.symbol == symbol.strip().upper(),
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Symbol not on watchlist")
    await db.delete(row)
    return {"removed": symbol.strip().upper()}


# -------------------------------- backtest ----------------------------------

@router.post("/backtest")
async def start_backtest(
    body: BacktestRequestIn,
    user: User = Depends(require_snaptrade),
) -> dict:
    """Kick off a walk-forward backtest (train→validation). Runs async via Celery."""
    from app.tasks.paper_trading import run_backtest

    async_result = run_backtest.delay(
        symbols=body.symbols,
        train_start=body.train_start.isoformat(),
        train_end=body.train_end.isoformat(),
        validation_start=body.validation_start.isoformat(),
        validation_end=body.validation_end.isoformat(),
        param_grid=body.param_grid,
        starting_cash=body.starting_cash,
    )
    return {"status": "queued", "task_id": str(async_result.id)}


def _backtest_out(run: PaperBacktestRun) -> BacktestRunOut:
    return BacktestRunOut(
        id=str(run.id),
        portfolio_id=str(run.portfolio_id) if run.portfolio_id else None,
        train_start=run.train_start, train_end=run.train_end,
        validation_start=run.validation_start, validation_end=run.validation_end,
        selected_params=run.selected_params,
        train_sharpe=float(run.train_sharpe) if run.train_sharpe is not None else None,
        validation_sharpe=float(run.validation_sharpe) if run.validation_sharpe is not None else None,
        validation_total_return=float(run.validation_total_return) if run.validation_total_return is not None else None,
        validation_vs_benchmark=float(run.validation_vs_benchmark) if run.validation_vs_benchmark is not None else None,
        created_at=run.created_at,
    )


@router.get("/backtest", response_model=list[BacktestRunOut])
async def list_backtests(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> list[BacktestRunOut]:
    """Recent backtest runs, most recent first — so the UI can show the latest result."""
    rows = (await db.execute(
        select(PaperBacktestRun).order_by(desc(PaperBacktestRun.created_at)).limit(min(limit, 100))
    )).scalars().all()
    return [_backtest_out(r) for r in rows]


@router.get("/backtest/{run_id}", response_model=BacktestRunOut)
async def get_backtest(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> BacktestRunOut:
    run = (await db.execute(
        select(PaperBacktestRun).where(PaperBacktestRun.id == run_id)
    )).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Backtest run not found")
    return _backtest_out(run)
