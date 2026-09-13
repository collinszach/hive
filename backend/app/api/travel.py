"""Travel planner API — trips, legs, and the comparison board.

Phase 1 of docs/TRAVEL-SPEC.md: no external APIs. Options are entered by hand, which
is deliberate — Costco Travel and the issuer portals have no public API and their terms
forbid scraping, and the comparison is the product regardless of where a quote came
from.
"""
import logging
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.trip import TravelOption, Trip, TripLeg
from app.travel.affordability import routes_for_award, spend_it_advice
from app.travel.transfer_partners import VERIFIED_ON, partners_for
from app.travel.valuation import judge, true_cost

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/travel", tags=["travel"])

TRIP_STATUSES = ("dreaming", "planning", "booked", "taken")
LEG_KINDS = ("flight", "hotel", "car", "activity")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TripIn(BaseModel):
    name: str = Field(..., max_length=200)
    destination: Optional[str] = Field(None, max_length=200)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    travelers: int = Field(1, ge=1, le=20)
    status: str = "dreaming"
    cash_budget: Optional[float] = None
    notes: Optional[str] = None


class TripOut(BaseModel):
    id: uuid.UUID
    name: str
    destination: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    travelers: int
    status: str
    cash_budget: Optional[float]
    notes: Optional[str]
    leg_count: int = 0
    # Sum of the selected option on each leg, as one comparable number.
    estimated_true_cost: Optional[float] = None


class LegIn(BaseModel):
    kind: str = "flight"
    title: Optional[str] = Field(None, max_length=200)
    origin: Optional[str] = Field(None, max_length=100)
    destination: Optional[str] = Field(None, max_length=100)
    leg_date: Optional[date] = None
    notes: Optional[str] = None


class OptionIn(BaseModel):
    source: str = "manual_cash"
    label: Optional[str] = Field(None, max_length=200)
    cash_price: Optional[float] = None
    points_price: Optional[float] = None
    program: Optional[str] = Field(None, max_length=100)
    fees: float = 0.0
    url: Optional[str] = None
    quoted_on: Optional[date] = None
    notes: Optional[str] = None


class OptionOut(BaseModel):
    id: uuid.UUID
    leg_id: uuid.UUID
    source: str
    label: Optional[str]
    cash_price: Optional[float]
    points_price: Optional[float]
    program: Optional[str]
    fees: float
    url: Optional[str]
    quoted_on: Optional[date]
    is_selected: bool
    notes: Optional[str]
    # Derived — never stored, so a change to the maths can't leave stale rows behind.
    cents_per_point: Optional[float] = None
    rating: str = "unknown"
    verdict: str = ""
    true_cost: Optional[float] = None
    is_best: bool = False


class LegOut(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    kind: str
    title: Optional[str]
    origin: Optional[str]
    destination: Optional[str]
    leg_date: Optional[date]
    sort_order: int
    notes: Optional[str]
    options: list[OptionOut] = []


class TripDetail(TripOut):
    legs: list[LegOut] = []


class PointsRouteOut(BaseModel):
    program: str
    available: float
    needed: float
    direct: bool
    partner: Optional[str]
    ratio: float
    shortfall: float
    covered: bool
    typical_days: int
    warning: Optional[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _current_balances(db: AsyncSession) -> dict[str, float]:
    """Latest snapshot per programme, rolled forward the same way /points/summary does.

    Uses raw SQL for DISTINCT ON, matching the existing points endpoint.
    """
    rows = await db.execute(text(
        "SELECT DISTINCT ON (program) program, balance, as_of "
        "FROM points_balances ORDER BY program, as_of DESC"
    ))
    snapshots = {r[0]: (float(r[1]), r[2]) for r in rows.all()}
    if not snapshots:
        return {}

    # Rolled forward per programme in Python: each snapshot has its own date, so a
    # single aggregate can't express the cutoff without a correlated subquery per row.
    balances: dict[str, float] = {}
    for program, (balance, as_of) in snapshots.items():
        since = (await db.execute(text(
            "SELECT COALESCE(SUM(pl.points_earned), 0) FROM points_ledger pl "
            "JOIN transactions t ON t.id = pl.transaction_id "
            "WHERE pl.program = :p AND t.date > :d"
        ), {"p": program, "d": as_of})).scalar_one() or 0
        spent = (await db.execute(text(
            "SELECT COALESCE(SUM(points_spent), 0) FROM points_redemptions "
            "WHERE program = :p AND status = 'confirmed' AND redeemed_on > :d"
        ), {"p": program, "d": as_of})).scalar_one() or 0
        balances[program] = max(0.0, balance + float(since) - float(spent))
    return balances


def _option_out(o: TravelOption) -> OptionOut:
    cash = float(o.cash_price) if o.cash_price is not None else None
    pts = float(o.points_price) if o.points_price is not None else None
    fees = float(o.fees or 0)
    v = judge(cash, pts, o.program, fees)
    return OptionOut(
        id=o.id, leg_id=o.leg_id, source=o.source, label=o.label,
        cash_price=cash, points_price=pts, program=o.program, fees=fees,
        url=o.url, quoted_on=o.quoted_on, is_selected=bool(o.is_selected), notes=o.notes,
        cents_per_point=v.cpp, rating=v.rating, verdict=v.summary,
        true_cost=true_cost(cash, pts, o.program, fees),
    )


def _rank(options: list[OptionOut]) -> list[OptionOut]:
    """Cheapest true cost first; unpriced options sink rather than disappear."""
    options.sort(key=lambda o: (o.true_cost is None, o.true_cost or 0.0))
    for o in options:
        o.is_best = False
    for o in options:
        if o.true_cost is not None:
            o.is_best = True
            break
    return options


# ---------------------------------------------------------------------------
# Trips
# ---------------------------------------------------------------------------

@router.get("/trips", response_model=list[TripOut])
async def list_trips(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[TripOut]:
    q = select(Trip).order_by(Trip.start_date.nullslast(), Trip.created_at.desc())
    if status:
        q = q.where(Trip.status == status)
    trips = (await db.execute(q)).scalars().all()

    counts = dict((r[0], r[1]) for r in (await db.execute(
        select(TripLeg.trip_id, func.count()).group_by(TripLeg.trip_id)
    )).all())

    out = []
    for t in trips:
        out.append(TripOut(
            id=t.id, name=t.name, destination=t.destination,
            start_date=t.start_date, end_date=t.end_date, travelers=t.travelers,
            status=t.status,
            cash_budget=float(t.cash_budget) if t.cash_budget is not None else None,
            notes=t.notes, leg_count=counts.get(t.id, 0),
        ))
    return out


@router.post("/trips", response_model=TripOut, status_code=201)
async def create_trip(body: TripIn, db: AsyncSession = Depends(get_db)) -> TripOut:
    if body.status not in TRIP_STATUSES:
        raise HTTPException(422, f"status must be one of {', '.join(TRIP_STATUSES)}")
    if body.start_date and body.end_date and body.end_date < body.start_date:
        raise HTTPException(422, "end_date cannot be before start_date")
    t = Trip(**body.model_dump())
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return TripOut(
        id=t.id, name=t.name, destination=t.destination, start_date=t.start_date,
        end_date=t.end_date, travelers=t.travelers, status=t.status,
        cash_budget=float(t.cash_budget) if t.cash_budget is not None else None,
        notes=t.notes, leg_count=0,
    )


@router.get("/trips/{trip_id}", response_model=TripDetail)
async def get_trip(trip_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> TripDetail:
    """The comparison board: every leg with its options ranked by true cost."""
    t = (await db.execute(select(Trip).where(Trip.id == trip_id))).scalar_one_or_none()
    if t is None:
        raise HTTPException(404, "Trip not found")

    legs = (await db.execute(
        select(TripLeg).where(TripLeg.trip_id == trip_id)
        .order_by(TripLeg.sort_order, TripLeg.created_at)
    )).scalars().all()

    opts = (await db.execute(
        select(TravelOption).where(
            TravelOption.leg_id.in_([l.id for l in legs]) if legs else False
        )
    )).scalars().all() if legs else []

    by_leg: dict[uuid.UUID, list[OptionOut]] = {}
    for o in opts:
        by_leg.setdefault(o.leg_id, []).append(_option_out(o))

    leg_out = []
    total = 0.0
    have_total = False
    for l in legs:
        options = _rank(by_leg.get(l.id, []))
        # Prefer what's actually been chosen; fall back to the best on offer so a
        # trip shows a number before anything is decided.
        chosen = next((o for o in options if o.is_selected), None) \
            or next((o for o in options if o.is_best), None)
        if chosen and chosen.true_cost is not None:
            total += chosen.true_cost
            have_total = True
        leg_out.append(LegOut(
            id=l.id, trip_id=l.trip_id, kind=l.kind, title=l.title, origin=l.origin,
            destination=l.destination, leg_date=l.leg_date, sort_order=l.sort_order,
            notes=l.notes, options=options,
        ))

    return TripDetail(
        id=t.id, name=t.name, destination=t.destination, start_date=t.start_date,
        end_date=t.end_date, travelers=t.travelers, status=t.status,
        cash_budget=float(t.cash_budget) if t.cash_budget is not None else None,
        notes=t.notes, leg_count=len(legs),
        estimated_true_cost=round(total, 2) if have_total else None,
        legs=leg_out,
    )


@router.delete("/trips/{trip_id}", status_code=204)
async def delete_trip(trip_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    t = (await db.execute(select(Trip).where(Trip.id == trip_id))).scalar_one_or_none()
    if t is None:
        raise HTTPException(404, "Trip not found")
    await db.delete(t)   # legs and options cascade
    await db.commit()


# ---------------------------------------------------------------------------
# Legs & options
# ---------------------------------------------------------------------------

@router.post("/trips/{trip_id}/legs", response_model=LegOut, status_code=201)
async def add_leg(
    trip_id: uuid.UUID, body: LegIn, db: AsyncSession = Depends(get_db)
) -> LegOut:
    if body.kind not in LEG_KINDS:
        raise HTTPException(422, f"kind must be one of {', '.join(LEG_KINDS)}")
    exists = (await db.execute(select(Trip.id).where(Trip.id == trip_id))).scalar_one_or_none()
    if exists is None:
        raise HTTPException(404, "Trip not found")

    next_order = (await db.execute(
        select(func.coalesce(func.max(TripLeg.sort_order), -1) + 1)
        .where(TripLeg.trip_id == trip_id)
    )).scalar_one()

    l = TripLeg(trip_id=trip_id, sort_order=next_order, **body.model_dump())
    db.add(l)
    await db.commit()
    await db.refresh(l)
    return LegOut(
        id=l.id, trip_id=l.trip_id, kind=l.kind, title=l.title, origin=l.origin,
        destination=l.destination, leg_date=l.leg_date, sort_order=l.sort_order,
        notes=l.notes, options=[],
    )


@router.delete("/legs/{leg_id}", status_code=204)
async def delete_leg(leg_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    l = (await db.execute(select(TripLeg).where(TripLeg.id == leg_id))).scalar_one_or_none()
    if l is None:
        raise HTTPException(404, "Leg not found")
    await db.delete(l)
    await db.commit()


@router.post("/legs/{leg_id}/options", response_model=OptionOut, status_code=201)
async def add_option(
    leg_id: uuid.UUID, body: OptionIn, db: AsyncSession = Depends(get_db)
) -> OptionOut:
    """Add a quote — a cash price, an award, a Costco or portal quote typed in."""
    exists = (await db.execute(select(TripLeg.id).where(TripLeg.id == leg_id))).scalar_one_or_none()
    if exists is None:
        raise HTTPException(404, "Leg not found")
    if body.cash_price is None and body.points_price is None:
        raise HTTPException(422, "Give a cash price, a points price, or both")
    if body.points_price is not None and not body.program:
        raise HTTPException(422, "A points price needs a program — otherwise it can't be valued")

    o = TravelOption(leg_id=leg_id, **body.model_dump())
    db.add(o)
    await db.commit()
    await db.refresh(o)
    return _option_out(o)


@router.post("/options/{option_id}/select", response_model=OptionOut)
async def select_option(option_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> OptionOut:
    """Mark the option you're going with; clears any other on the same leg."""
    o = (await db.execute(
        select(TravelOption).where(TravelOption.id == option_id)
    )).scalar_one_or_none()
    if o is None:
        raise HTTPException(404, "Option not found")

    siblings = (await db.execute(
        select(TravelOption).where(TravelOption.leg_id == o.leg_id)
    )).scalars().all()
    for s in siblings:
        s.is_selected = (s.id == option_id)
        db.add(s)
    await db.commit()
    await db.refresh(o)
    return _option_out(o)


@router.delete("/options/{option_id}", status_code=204)
async def delete_option(option_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    o = (await db.execute(
        select(TravelOption).where(TravelOption.id == option_id)
    )).scalar_one_or_none()
    if o is None:
        raise HTTPException(404, "Option not found")
    await db.delete(o)
    await db.commit()


# ---------------------------------------------------------------------------
# The points question
# ---------------------------------------------------------------------------

@router.get("/routes", response_model=list[PointsRouteOut])
async def award_routes(
    program: str = Query(..., description="The currency the award is priced in"),
    points: float = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
) -> list[PointsRouteOut]:
    """How you could pay for an award: direct balances first, then transfers."""
    balances = await _current_balances(db)
    return [
        PointsRouteOut(
            program=r.program, available=r.available, needed=r.needed, direct=r.direct,
            partner=r.partner, ratio=r.ratio, shortfall=r.shortfall, covered=r.covered,
            typical_days=r.typical_days, warning=r.warning,
        )
        for r in routes_for_award(
            target_program=program, points_price=points, balances=balances
        )
    ]


@router.get("/balances")
async def travel_balances(db: AsyncSession = Depends(get_db)) -> dict:
    """Balances with transfer reach and a currency-specific nudge.

    Surfaces ``verified_on`` so a stale transfer ratio is never shown as current fact.
    """
    balances = await _current_balances(db)
    out = []
    for program, balance in sorted(balances.items(), key=lambda kv: -kv[1]):
        partners = partners_for(program)
        out.append({
            "program": program,
            "balance": round(balance, 2),
            "transferable": bool(partners),
            "partner_count": len(partners),
            "partners": [
                {"name": p.to_partner, "kind": p.kind, "ratio": p.ratio,
                 "typical_days": p.typical_days}
                for p in partners
            ],
            "advice": spend_it_advice(program, balance),
        })
    return {"programs": out, "partners_verified_on": VERIFIED_ON.isoformat()}
