"""Planning & forecasting API (Epic 8, Phase 2).

Scenarios bundle assumptions, income streams, and plan events. The projection endpoint assembles
inputs from real account balances + trailing spend and runs the pure engine in `app.planning.engine`.
"""
import logging
import uuid as uuid_mod
from dataclasses import asdict
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.income_stream import IncomeStream
from app.models.plan_assumption import PlanAssumption
from app.models.plan_event import PlanEvent
from app.models.plan_scenario import PlanScenario
from app.planning.engine import Assumptions
from app.planning.engine import IncomeStream as EngineIncome
from app.planning.engine import PlanEventInput, ProjectionInputs, project

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/planning", tags=["planning"])

RECURRENCES = {"once", "monthly", "quarterly", "semiannual", "annual"}
KINDS = {"inflow", "outflow"}
TARGETS = {"cash", "investment"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _month_index(anchor: date, d: date) -> int:
    """1-based projection month for a calendar date. Month 1 == anchor + 1 month.

    Dates at or before the anchor clamp to month 1 (active from the start of the projection).
    """
    idx = (d.year * 12 + d.month) - (anchor.year * 12 + anchor.month)
    return max(idx, 1)


def _month_index_opt(anchor: date, d: Optional[date]) -> Optional[int]:
    return None if d is None else _month_index(anchor, d)


def _parse_date(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {s!r} (expected YYYY-MM-DD)")


async def _get_scenario_or_404(session: AsyncSession, scenario_id: str) -> PlanScenario:
    try:
        sid = uuid_mod.UUID(scenario_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scenario id")
    result = await session.execute(select(PlanScenario).where(PlanScenario.id == sid))
    scenario = result.scalar_one_or_none()
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


async def _get_or_create_assumptions(session: AsyncSession, scenario_id: uuid_mod.UUID) -> PlanAssumption:
    result = await session.execute(
        select(PlanAssumption).where(PlanAssumption.scenario_id == scenario_id)
    )
    assumptions = result.scalar_one_or_none()
    if assumptions is None:
        assumptions = PlanAssumption(scenario_id=scenario_id)
        session.add(assumptions)
        await session.flush()
    return assumptions


def _scenario_dict(s: PlanScenario) -> dict:
    return {"id": str(s.id), "name": s.name, "is_baseline": s.is_baseline,
            "created_at": s.created_at.isoformat() if s.created_at else None}


def _assumptions_dict(a: PlanAssumption) -> dict:
    return {
        "annual_return_pct": float(a.annual_return_pct),
        "annual_inflation_pct": float(a.annual_inflation_pct),
        "effective_tax_rate_pct": float(a.effective_tax_rate_pct),
        "emergency_floor": float(a.emergency_floor),
        "auto_invest_surplus": a.auto_invest_surplus,
        "band_spread_pct": float(a.band_spread_pct),
        "base_monthly_expenses": float(a.base_monthly_expenses) if a.base_monthly_expenses is not None else None,
    }


def _income_dict(s: IncomeStream) -> dict:
    return {
        "id": str(s.id), "name": s.name, "kind": s.kind,
        "monthly_amount": float(s.monthly_amount), "frequency": s.frequency,
        "start_date": s.start_date.isoformat(),
        "end_date": s.end_date.isoformat() if s.end_date else None,
        "growth_pct": float(s.growth_pct), "taxable": s.taxable, "is_active": s.is_active,
    }


def _event_dict(e: PlanEvent) -> dict:
    return {
        "id": str(e.id), "name": e.name, "amount": float(e.amount),
        "kind": e.kind, "target": e.target, "recurrence": e.recurrence,
        "event_date": e.event_date.isoformat(),
        "end_date": e.end_date.isoformat() if e.end_date else None,
        "growth_pct": float(e.growth_pct), "category": e.category, "notes": e.notes,
        "is_active": e.is_active,
    }


# ── Scenarios ────────────────────────────────────────────────────────────────

class ScenarioCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


@router.get("/scenarios")
async def list_scenarios(session: AsyncSession = Depends(get_db)) -> list[dict]:
    # Ensure a baseline always exists so the UI has something to render.
    existing = await session.execute(select(PlanScenario).where(PlanScenario.is_baseline == True))  # noqa: E712
    if existing.scalar_one_or_none() is None:
        baseline = PlanScenario(name="Baseline", is_baseline=True)
        session.add(baseline)
        await session.flush()
        await _get_or_create_assumptions(session, baseline.id)
    result = await session.execute(select(PlanScenario).order_by(PlanScenario.created_at))
    return [_scenario_dict(s) for s in result.scalars().all()]


@router.post("/scenarios", status_code=201)
async def create_scenario(body: ScenarioCreate, session: AsyncSession = Depends(get_db)) -> dict:
    scenario = PlanScenario(name=body.name, is_baseline=False)
    session.add(scenario)
    await session.flush()
    await _get_or_create_assumptions(session, scenario.id)
    return _scenario_dict(scenario)


@router.delete("/scenarios/{scenario_id}", status_code=204)
async def delete_scenario(scenario_id: str, session: AsyncSession = Depends(get_db)):
    scenario = await _get_scenario_or_404(session, scenario_id)
    if scenario.is_baseline:
        raise HTTPException(status_code=400, detail="Cannot delete the baseline scenario")
    await session.delete(scenario)  # cascades to assumptions, income streams, events


# ── Assumptions ──────────────────────────────────────────────────────────────

class AssumptionsUpdate(BaseModel):
    annual_return_pct: Optional[float] = None
    annual_inflation_pct: Optional[float] = None
    effective_tax_rate_pct: Optional[float] = None
    emergency_floor: Optional[float] = None
    auto_invest_surplus: Optional[bool] = None
    band_spread_pct: Optional[float] = None
    base_monthly_expenses: Optional[float] = None  # null clears the override (back to auto)


@router.get("/scenarios/{scenario_id}/assumptions")
async def get_assumptions(scenario_id: str, session: AsyncSession = Depends(get_db)) -> dict:
    scenario = await _get_scenario_or_404(session, scenario_id)
    assumptions = await _get_or_create_assumptions(session, scenario.id)
    return _assumptions_dict(assumptions)


@router.put("/scenarios/{scenario_id}/assumptions")
async def update_assumptions(
    scenario_id: str, body: AssumptionsUpdate, session: AsyncSession = Depends(get_db)
) -> dict:
    scenario = await _get_scenario_or_404(session, scenario_id)
    assumptions = await _get_or_create_assumptions(session, scenario.id)
    fields = body.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(assumptions, key, value)
    return _assumptions_dict(assumptions)


# ── Income streams ───────────────────────────────────────────────────────────

class IncomeStreamBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    kind: Optional[str] = None
    monthly_amount: float
    start_date: str
    end_date: Optional[str] = None
    growth_pct: float = 0.0
    taxable: bool = True


@router.get("/scenarios/{scenario_id}/income")
async def list_income(scenario_id: str, session: AsyncSession = Depends(get_db)) -> list[dict]:
    scenario = await _get_scenario_or_404(session, scenario_id)
    result = await session.execute(
        select(IncomeStream).where(IncomeStream.scenario_id == scenario.id).order_by(IncomeStream.start_date)
    )
    return [_income_dict(s) for s in result.scalars().all()]


@router.post("/scenarios/{scenario_id}/income", status_code=201)
async def create_income(scenario_id: str, body: IncomeStreamBody, session: AsyncSession = Depends(get_db)) -> dict:
    scenario = await _get_scenario_or_404(session, scenario_id)
    stream = IncomeStream(
        scenario_id=scenario.id, name=body.name, kind=body.kind,
        monthly_amount=body.monthly_amount, start_date=_parse_date(body.start_date),
        end_date=_parse_date(body.end_date) if body.end_date else None,
        growth_pct=body.growth_pct, taxable=body.taxable,
    )
    session.add(stream)
    await session.flush()
    return _income_dict(stream)


@router.delete("/income/{stream_id}", status_code=204)
async def delete_income(stream_id: str, session: AsyncSession = Depends(get_db)):
    try:
        sid = uuid_mod.UUID(stream_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid stream id")
    result = await session.execute(select(IncomeStream).where(IncomeStream.id == sid))
    stream = result.scalar_one_or_none()
    if stream is None:
        raise HTTPException(status_code=404, detail="Income stream not found")
    await session.delete(stream)


# ── Events (scenario-scoped) ─────────────────────────────────────────────────

class EventBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    amount: float = Field(..., gt=0)
    event_date: str
    kind: str = "outflow"
    target: str = "cash"
    recurrence: str = "once"
    end_date: Optional[str] = None
    growth_pct: float = 0.0
    category: Optional[str] = None
    notes: Optional[str] = None

    def _validate(self) -> None:
        if self.kind not in KINDS:
            raise HTTPException(status_code=400, detail=f"kind must be one of {sorted(KINDS)}")
        if self.target not in TARGETS:
            raise HTTPException(status_code=400, detail=f"target must be one of {sorted(TARGETS)}")
        if self.recurrence not in RECURRENCES:
            raise HTTPException(status_code=400, detail=f"recurrence must be one of {sorted(RECURRENCES)}")


@router.get("/scenarios/{scenario_id}/events")
async def list_events(scenario_id: str, session: AsyncSession = Depends(get_db)) -> list[dict]:
    scenario = await _get_scenario_or_404(session, scenario_id)
    result = await session.execute(
        select(PlanEvent).where(PlanEvent.scenario_id == scenario.id).order_by(PlanEvent.event_date)
    )
    return [_event_dict(e) for e in result.scalars().all()]


@router.post("/scenarios/{scenario_id}/events", status_code=201)
async def create_event(scenario_id: str, body: EventBody, session: AsyncSession = Depends(get_db)) -> dict:
    body._validate()
    scenario = await _get_scenario_or_404(session, scenario_id)
    event = PlanEvent(
        scenario_id=scenario.id, name=body.name, amount=body.amount,
        event_date=_parse_date(body.event_date),
        end_date=_parse_date(body.end_date) if body.end_date else None,
        kind=body.kind, target=body.target, recurrence=body.recurrence,
        growth_pct=body.growth_pct, category=body.category, notes=body.notes,
    )
    session.add(event)
    await session.flush()
    return _event_dict(event)


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(event_id: str, session: AsyncSession = Depends(get_db)):
    try:
        eid = uuid_mod.UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid event id")
    result = await session.execute(select(PlanEvent).where(PlanEvent.id == eid))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    await session.delete(event)


# ── Projection ───────────────────────────────────────────────────────────────

async def _starting_balances(session: AsyncSession) -> tuple[float, float]:
    """Return (starting_cash, starting_investments).

    Investments = invested/brokerage account balances. Cash = latest net-worth snapshot minus
    investments (so t=0 reconciles to the real net worth, liabilities included); falls back to
    depository minus credit/loan balances when no snapshot exists.
    """
    inv_row = (await session.execute(text(
        """
        SELECT COALESCE(SUM(current_balance), 0) AS inv
        FROM accounts
        WHERE is_active AND NOT is_excluded
          AND (type = 'investment' OR snaptrade_account_id IS NOT NULL)
        """
    ))).fetchone()
    investments = float(inv_row.inv or 0)

    nw_row = (await session.execute(text(
        "SELECT net_worth FROM net_worth_snapshots ORDER BY snapshot_date DESC LIMIT 1"
    ))).fetchone()
    if nw_row is not None and nw_row.net_worth is not None:
        return float(nw_row.net_worth) - investments, investments

    cash_row = (await session.execute(text(
        """
        SELECT
          COALESCE(SUM(CASE WHEN type = 'depository' THEN current_balance ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type IN ('credit', 'loan') THEN current_balance ELSE 0 END), 0) AS cash
        FROM accounts
        WHERE is_active AND NOT is_excluded
        """
    ))).fetchone()
    return float(cash_row.cash or 0), investments


async def _baseline_monthly_expenses(session: AsyncSession, anchor: date) -> float:
    cutoff = anchor - timedelta(days=90)
    row = (await session.execute(text(
        """
        SELECT COALESCE(SUM(amount), 0) / 3.0 AS e
        FROM transactions
        WHERE date >= :cutoff AND amount > 0
          AND NOT is_excluded AND NOT is_transfer AND NOT pending
        """
    ), {"cutoff": cutoff})).fetchone()
    return float(row.e or 0)


@router.get("/scenarios/{scenario_id}/projection")
async def get_projection(
    scenario_id: str, months: int = 24, session: AsyncSession = Depends(get_db)
) -> dict:
    if months < 1 or months > 600:
        raise HTTPException(status_code=400, detail="months must be between 1 and 600")
    scenario = await _get_scenario_or_404(session, scenario_id)
    a = await _get_or_create_assumptions(session, scenario.id)

    today = date.today()
    anchor = date(today.year, today.month, 1)

    starting_cash, starting_investments = await _starting_balances(session)
    if a.base_monthly_expenses is not None:
        base_expenses = float(a.base_monthly_expenses)
    else:
        base_expenses = await _baseline_monthly_expenses(session, anchor)

    streams = (await session.execute(
        select(IncomeStream).where(
            IncomeStream.scenario_id == scenario.id, IncomeStream.is_active == True  # noqa: E712
        )
    )).scalars().all()
    engine_streams = [
        EngineIncome(
            monthly_amount=float(s.monthly_amount),
            start_month=_month_index(anchor, s.start_date),
            end_month=_month_index_opt(anchor, s.end_date),
            growth_pct=float(s.growth_pct), taxable=s.taxable, name=s.name,
        )
        for s in streams
    ]

    events = (await session.execute(
        select(PlanEvent).where(
            PlanEvent.scenario_id == scenario.id, PlanEvent.is_active == True  # noqa: E712
        )
    )).scalars().all()
    engine_events = [
        PlanEventInput(
            amount=float(e.amount), kind=e.kind, target=e.target,
            start_month=_month_index(anchor, e.event_date),
            end_month=_month_index_opt(anchor, e.end_date),
            recurrence=e.recurrence, growth_pct=float(e.growth_pct), name=e.name,
        )
        for e in events
    ]

    inputs = ProjectionInputs(
        horizon_months=months,
        start_date=anchor,
        starting_cash=starting_cash,
        starting_investments=starting_investments,
        base_monthly_expenses=base_expenses,
        assumptions=Assumptions(
            annual_return_pct=float(a.annual_return_pct),
            annual_inflation_pct=float(a.annual_inflation_pct),
            effective_tax_rate_pct=float(a.effective_tax_rate_pct),
            emergency_floor=float(a.emergency_floor),
            auto_invest_surplus=a.auto_invest_surplus,
            band_spread_pct=float(a.band_spread_pct),
        ),
        income_streams=engine_streams,
        events=engine_events,
    )
    result = project(inputs)

    return {
        "scenario": _scenario_dict(scenario),
        "assumptions": _assumptions_dict(a),
        "inputs": {
            "horizon_months": months,
            "start_date": anchor.isoformat(),
            "starting_cash": round(starting_cash, 2),
            "starting_investments": round(starting_investments, 2),
            "base_monthly_expenses": round(base_expenses, 2),
            "income_streams": len(engine_streams),
            "events": len(engine_events),
        },
        **asdict(result),
    }
