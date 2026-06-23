"""API tests for the paper-trading router — real require_snaptrade gating + shapes.

Integration test against a real Postgres (async + sync engines target the same DB).
Skips automatically when no database is reachable.
"""
from datetime import date
from types import SimpleNamespace

import pytest

pytest.importorskip("sqlalchemy")
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.models  # noqa: E402,F401
from app.api.auth import _create_access_token  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import Base  # noqa: E402
from app.models.paper_backtest_run import PaperBacktestRun  # noqa: E402
from app.models.user import PlanTier, User, UserRole  # noqa: E402


@pytest.fixture(scope="module")
def engine():
    try:
        eng = create_engine(settings.database_sync_url)
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        pytest.skip(f"no database reachable: {exc}")
    from tests.conftest import require_disposable_db

    require_disposable_db(eng)  # never TRUNCATE a production database
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def client(engine):
    from fastapi.testclient import TestClient
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.db import get_db
    from app.main import app

    # TestClient runs a fresh event loop per request; the app's global pooled asyncpg
    # connections bind to a stale loop → "Event loop is closed". Override get_db with a
    # NullPool engine so each request opens a connection on its own loop.
    test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
    TestSession = async_sessionmaker(test_engine, expire_on_commit=False)

    async def _override_get_db():
        async with TestSession() as s:
            try:
                yield s
                await s.commit()
            except Exception:
                await s.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db

    # Clean slate for paper tables + test users each test.
    with Session(engine) as s:
        for tbl in ("paper_backtest_runs", "paper_performance_snapshots", "paper_trades",
                    "paper_positions", "paper_portfolios", "paper_signals",
                    "paper_watchlist_symbols"):
            s.execute(text(f"TRUNCATE TABLE {tbl} CASCADE"))
        s.execute(text("DELETE FROM users WHERE username IN ('pt_pro','pt_free')"))
        s.add(User(username="pt_pro", password_hash="x", role=UserRole.viewer, plan=PlanTier.pro, is_active=True))
        s.add(User(username="pt_free", password_hash="x", role=UserRole.viewer, plan=PlanTier.free, is_active=True))
        s.commit()

    # No `with` → don't trigger app lifespan/startup side effects.
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)


def _auth(username):
    return {"Authorization": f"Bearer {_create_access_token(username, 'viewer')}"}


PRO = "pt_pro"
FREE = "pt_free"


# ------------------------------- gating -------------------------------------

def test_requires_auth(client):
    assert client.get("/api/paper-trading/portfolio").status_code == 401


def test_free_plan_blocked_402(client):
    r = client.get("/api/paper-trading/portfolio", headers=_auth(FREE))
    assert r.status_code == 402
    assert r.json()["detail"]["gate"] == "snaptrade"


def test_pro_plan_no_portfolio_404(client):
    r = client.get("/api/paper-trading/portfolio", headers=_auth(PRO))
    assert r.status_code == 404


# ----------------------------- portfolio ------------------------------------

def test_create_then_get_portfolio(client):
    created = client.post("/api/paper-trading/portfolio", headers=_auth(PRO),
                          json={"name": "My Bot", "starting_cash": 50000})
    assert created.status_code == 200
    body = created.json()
    assert body["name"] == "My Bot"
    assert body["starting_cash"] == 50000
    assert body["status"] == "live"
    assert body["evaluation_ends_at"] is not None

    got = client.get("/api/paper-trading/portfolio", headers=_auth(PRO))
    assert got.status_code == 200
    assert got.json()["id"] == body["id"]


# ----------------------------- watchlist ------------------------------------

def test_watchlist_crud(client):
    add = client.post("/api/paper-trading/watchlist", headers=_auth(PRO), json={"symbol": "aapl"})
    assert add.status_code == 200
    assert add.json() == {"symbol": "AAPL", "is_active": True}

    listed = client.get("/api/paper-trading/watchlist", headers=_auth(PRO))
    assert listed.status_code == 200
    assert any(s["symbol"] == "AAPL" for s in listed.json())

    removed = client.delete("/api/paper-trading/watchlist/AAPL", headers=_auth(PRO))
    assert removed.status_code == 200
    assert client.delete("/api/paper-trading/watchlist/AAPL", headers=_auth(PRO)).status_code == 404


def test_watchlist_gated_for_free(client):
    assert client.get("/api/paper-trading/watchlist", headers=_auth(FREE)).status_code == 402


# ------------------------ signals / trades / report -------------------------

def test_signals_and_trades_empty_ok(client):
    assert client.get("/api/paper-trading/signals", headers=_auth(PRO)).json() == []
    assert client.get("/api/paper-trading/trades", headers=_auth(PRO)).json() == []


def test_report_requires_portfolio_then_returns_metrics(client):
    assert client.get("/api/paper-trading/report", headers=_auth(PRO)).status_code == 404
    client.post("/api/paper-trading/portfolio", headers=_auth(PRO), json={"starting_cash": 100000})
    r = client.get("/api/paper-trading/report", headers=_auth(PRO))
    assert r.status_code == 200
    body = r.json()
    assert body["starting_cash"] == 100000
    assert body["status"] == "in_progress"
    assert "sharpe" in body and "max_drawdown" in body


# ------------------------------- backtest -----------------------------------

def test_start_backtest_enqueues(client, monkeypatch):
    import app.tasks.paper_trading as pt

    monkeypatch.setattr(pt.run_backtest, "delay", lambda **kw: SimpleNamespace(id="task-123"))
    r = client.post("/api/paper-trading/backtest", headers=_auth(PRO), json={
        "symbols": ["AAPL"],
        "train_start": "2022-01-01", "train_end": "2022-06-30",
        "validation_start": "2022-07-01", "validation_end": "2022-12-31",
    })
    assert r.status_code == 200
    assert r.json() == {"status": "queued", "task_id": "task-123"}


def test_get_backtest_run(client, engine):
    with Session(engine) as s:
        run = PaperBacktestRun(
            train_start=date(2022, 1, 1), train_end=date(2022, 6, 30),
            validation_start=date(2022, 7, 1), validation_end=date(2022, 12, 31),
            selected_params={"position_size_pct": 0.2}, train_sharpe=1.1,
            validation_sharpe=0.8, validation_total_return=0.05, validation_vs_benchmark=-0.01,
        )
        s.add(run)
        s.commit()
        run_id = str(run.id)

    r = client.get(f"/api/paper-trading/backtest/{run_id}", headers=_auth(PRO))
    assert r.status_code == 200
    body = r.json()
    assert body["validation_sharpe"] == 0.8
    assert body["selected_params"] == {"position_size_pct": 0.2}

    import uuid
    assert client.get(f"/api/paper-trading/backtest/{uuid.uuid4()}", headers=_auth(PRO)).status_code == 404


def test_list_backtests(client, engine):
    with Session(engine) as s:
        for vs in (0.8, 1.2):
            s.add(PaperBacktestRun(
                train_start=date(2022, 1, 1), train_end=date(2022, 6, 30),
                validation_start=date(2022, 7, 1), validation_end=date(2022, 12, 31),
                validation_sharpe=vs, validation_total_return=0.04,
            ))
        s.commit()
    r = client.get("/api/paper-trading/backtest", headers=_auth(PRO))
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    # Free plan is gated out.
    assert client.get("/api/paper-trading/backtest", headers=_auth(FREE)).status_code == 402
