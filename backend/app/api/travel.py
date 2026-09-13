"""Travel planner API — trips, legs, and the comparison board.

Phase 1 of docs/TRAVEL-SPEC.md: no external APIs. Options are entered by hand, which
is deliberate — Costco Travel and the issuer portals have no public API and their terms
forbid scraping, and the comparison is the product regardless of where a quote came
from.
"""
import logging
import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.trip import TravelOption, Trip, TripLeg, TripTransaction
from app.analytics.spend import net_spend_expr
from app.travel.affordability import judge_cash, routes_for_award, spend_it_advice
from app.travel.connector_amadeus import AmadeusError
from app.travel.connector_amadeus import get_connector as get_amadeus
from app.travel.connector_seats import SeatsAeroError
from app.travel.connector_seats import get_connector as get_seats
from app.travel.transfer_partners import VERIFIED_ON, has_transfer_data, partners_for
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


class LinkedTransactionOut(BaseModel):
    transaction_id: uuid.UUID
    date: date
    merchant: Optional[str]
    amount: float          # the user's own portion, net of expense shares
    category: Optional[str]
    subcategory: Optional[str]
    card_slug: Optional[str]


class TripSpendOut(BaseModel):
    """Planned against actual, in cash terms only.

    Points aren't dollars: an award's *cash* cost is its fees, and the points it burns
    are reported separately. Folding a baseline valuation into "actual spend" would
    make a trip look more expensive than the money that actually left the account.
    """
    planned_cash: float
    actual_cash: float
    variance: float                # actual − planned; positive means over
    planned_points: dict[str, float]
    transactions: list[LinkedTransactionOut]
    has_plan: bool                 # false when no option has been chosen or priced


class AffordabilityOut(BaseModel):
    cash_needed: float
    cash_available: float
    affordable: bool
    summary: str
    days_until: Optional[int]
    # Only meaningful with a start date: what you'd need to put aside each month.
    monthly_to_save: Optional[float]
    points_needed: dict[str, float]
    points_shortfalls: dict[str, float]
    points_covered: bool


class FlightQuoteOut(BaseModel):
    price: float
    currency: str
    carrier: Optional[str]
    departure: Optional[str]
    arrival: Optional[str]
    stops: int
    duration: Optional[str]
    label: str


class FlightSearchOut(BaseModel):
    """Live cash quotes for a leg, plus enough context to judge them.

    ``configured`` false means no Amadeus credentials are set — the planner still
    works on manual quotes, so this is a missing capability, not an error.
    """
    configured: bool
    quotes: list[FlightQuoteOut] = []
    # Test data is illustrative, not real pricing. Surfaced so the UI can say so
    # rather than letting a cached fare masquerade as a live one.
    is_test_data: bool = False
    error: Optional[str] = None


class AwardQuoteOut(BaseModel):
    source: str
    program: str
    cabin: str
    cabin_label: str
    miles: float
    taxes: float
    taxes_currency: str
    date: Optional[str]
    origin: Optional[str]
    destination: Optional[str]
    direct: bool
    seats: Optional[int]
    airlines: Optional[str]
    label: str
    # ── coverage, against the balances actually held ──────────────────────
    #   covered  — a balance (direct or via transfer) can pay for this
    #   short    — a route exists but there aren't enough points
    #   no_route — nothing held reaches this programme
    #   unknown  — the transfer table has no data for this programme at all,
    #              which is a gap in curated data, not a fact about your points
    coverage: str = "unknown"
    best_program: Optional[str] = None
    shortfall: Optional[float] = None


class AwardSearchOut(BaseModel):
    configured: bool
    quotes: list[AwardQuoteOut] = []
    error: Optional[str] = None


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

async def _chosen_options(db: AsyncSession, trip_id: uuid.UUID) -> list[TravelOption]:
    """The option picked for each leg, falling back to the cheapest priced one.

    Mirrors what the board shows, so the plan you read is the plan that's costed.
    """
    legs = (await db.execute(
        select(TripLeg).where(TripLeg.trip_id == trip_id)
    )).scalars().all()
    if not legs:
        return []
    opts = (await db.execute(
        select(TravelOption).where(TravelOption.leg_id.in_([l.id for l in legs]))
    )).scalars().all()

    by_leg: dict[uuid.UUID, list[TravelOption]] = {}
    for o in opts:
        by_leg.setdefault(o.leg_id, []).append(o)

    chosen: list[TravelOption] = []
    for leg in legs:
        candidates = by_leg.get(leg.id, [])
        if not candidates:
            continue
        selected = next((o for o in candidates if o.is_selected), None)
        if selected:
            chosen.append(selected)
            continue
        priced = [
            o for o in candidates
            if true_cost(
                float(o.cash_price) if o.cash_price is not None else None,
                float(o.points_price) if o.points_price is not None else None,
                o.program, float(o.fees or 0),
            ) is not None
        ]
        if priced:
            chosen.append(min(priced, key=lambda o: true_cost(
                float(o.cash_price) if o.cash_price is not None else None,
                float(o.points_price) if o.points_price is not None else None,
                o.program, float(o.fees or 0),
            )))
    return chosen


def _cash_out(o: TravelOption) -> float:
    """Money that actually leaves the account for this option.

    An award costs its fees, not the value of the points — that's the number to
    compare against a bank balance.
    """
    if o.points_price:
        return float(o.fees or 0)
    return float(o.cash_price or 0)


def _points_out(options: list[TravelOption]) -> dict[str, float]:
    totals: dict[str, float] = {}
    for o in options:
        if o.points_price and o.program:
            totals[o.program] = totals.get(o.program, 0.0) + float(o.points_price)
    return totals


@router.get("/trips/{trip_id}/spend", response_model=TripSpendOut)
async def trip_spend(trip_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> TripSpendOut:
    """What you planned to spend against what actually left the account."""
    exists = (await db.execute(select(Trip.id).where(Trip.id == trip_id))).scalar_one_or_none()
    if exists is None:
        raise HTTPException(404, "Trip not found")

    chosen = await _chosen_options(db, trip_id)
    planned_cash = sum(_cash_out(o) for o in chosen)

    rows = (await db.execute(
        select(Transaction, net_spend_expr().label("own"), Account.card_slug)
        .join(TripTransaction, TripTransaction.transaction_id == Transaction.id)
        .join(Account, Account.id == Transaction.account_id, isouter=True)
        .where(TripTransaction.trip_id == trip_id)
        .order_by(Transaction.date)
    )).all()

    linked = [
        LinkedTransactionOut(
            transaction_id=tx.id, date=tx.date, merchant=tx.merchant or tx.raw_description,
            amount=round(float(own), 2), category=tx.category, subcategory=tx.subcategory,
            card_slug=slug,
        )
        for tx, own, slug in rows
    ]
    actual_cash = round(sum(t.amount for t in linked), 2)

    return TripSpendOut(
        planned_cash=round(planned_cash, 2),
        actual_cash=actual_cash,
        variance=round(actual_cash - planned_cash, 2),
        planned_points=_points_out(chosen),
        transactions=linked,
        has_plan=bool(chosen),
    )


@router.get("/trips/{trip_id}/suggested-transactions", response_model=list[LinkedTransactionOut])
async def suggested_transactions(
    trip_id: uuid.UUID,
    window_days: int = Query(45, ge=0, le=365),
    db: AsyncSession = Depends(get_db),
) -> list[LinkedTransactionOut]:
    """Travel charges near the trip's dates that might belong to it.

    Suggestions only. Travel posts weeks either side of a trip, so a date window would
    quietly claim a neighbouring holiday's flights if it linked them automatically.
    Anything already attached to a trip is excluded.
    """
    trip = (await db.execute(select(Trip).where(Trip.id == trip_id))).scalar_one_or_none()
    if trip is None:
        raise HTTPException(404, "Trip not found")

    anchor = trip.start_date or trip.end_date
    if anchor is None:
        return []
    end_anchor = trip.end_date or trip.start_date

    filters = [
        Transaction.amount > 0,
        Transaction.is_excluded == False,  # noqa: E712
        Transaction.is_transfer == False,  # noqa: E712
        Transaction.category == "Travel",
        Transaction.date >= anchor - timedelta(days=window_days),
        Transaction.date <= end_anchor + timedelta(days=window_days),
        ~Transaction.id.in_(select(TripTransaction.transaction_id)),
    ]

    rows = (await db.execute(
        select(Transaction, net_spend_expr().label("own"), Account.card_slug)
        .join(Account, Account.id == Transaction.account_id, isouter=True)
        .where(*filters)
        .order_by(Transaction.date.desc())
        .limit(50)
    )).all()

    return [
        LinkedTransactionOut(
            transaction_id=tx.id, date=tx.date, merchant=tx.merchant or tx.raw_description,
            amount=round(float(own), 2), category=tx.category, subcategory=tx.subcategory,
            card_slug=slug,
        )
        for tx, own, slug in rows
    ]


@router.post("/trips/{trip_id}/transactions/{transaction_id}", status_code=204)
async def link_transaction(
    trip_id: uuid.UUID, transaction_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> None:
    """Attach a transaction to a trip. Idempotent."""
    if (await db.execute(select(Trip.id).where(Trip.id == trip_id))).scalar_one_or_none() is None:
        raise HTTPException(404, "Trip not found")

    existing = (await db.execute(
        select(TripTransaction).where(TripTransaction.transaction_id == transaction_id)
    )).scalar_one_or_none()
    if existing is not None:
        if existing.trip_id == trip_id:
            return
        raise HTTPException(409, "That transaction is already attached to another trip")

    db.add(TripTransaction(trip_id=trip_id, transaction_id=transaction_id))
    await db.commit()


@router.delete("/trips/{trip_id}/transactions/{transaction_id}", status_code=204)
async def unlink_transaction(
    trip_id: uuid.UUID, transaction_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> None:
    link = (await db.execute(
        select(TripTransaction).where(
            TripTransaction.trip_id == trip_id,
            TripTransaction.transaction_id == transaction_id,
        )
    )).scalar_one_or_none()
    if link is None:
        raise HTTPException(404, "Not attached to this trip")
    await db.delete(link)
    await db.commit()


@router.get("/trips/{trip_id}/affordability", response_model=AffordabilityOut)
async def trip_affordability(
    trip_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> AffordabilityOut:
    """Can this be paid for — in cash, and in points.

    Cash is measured against liquid position (depository balances less credit and loan
    balances), not this month's safe-to-spend: a trip six months out is a saving
    question, not a discretionary-spend one.
    """
    trip = (await db.execute(select(Trip).where(Trip.id == trip_id))).scalar_one_or_none()
    if trip is None:
        raise HTTPException(404, "Trip not found")

    chosen = await _chosen_options(db, trip_id)
    cash_needed = sum(_cash_out(o) for o in chosen)

    cash_row = (await db.execute(text(
        """
        SELECT
          COALESCE(SUM(CASE WHEN type = 'depository' THEN current_balance ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type IN ('credit', 'loan') THEN current_balance ELSE 0 END), 0)
          AS cash
        FROM accounts
        WHERE is_active AND NOT is_excluded
        """
    ))).fetchone()
    cash_available = float(cash_row.cash or 0)

    verdict = judge_cash(cash_needed, cash_available)

    days_until: Optional[int] = None
    monthly_to_save: Optional[float] = None
    if trip.start_date:
        days_until = (trip.start_date - date.today()).days
        if days_until > 0 and not verdict.affordable:
            months = max(1.0, days_until / 30.0)
            monthly_to_save = round((cash_needed - cash_available) / months, 2)

    points_needed = _points_out(chosen)
    balances = await _current_balances(db)
    shortfalls = {
        program: round(needed - balances.get(program, 0.0), 2)
        for program, needed in points_needed.items()
        if needed > balances.get(program, 0.0)
    }

    return AffordabilityOut(
        cash_needed=round(cash_needed, 2),
        cash_available=round(cash_available, 2),
        affordable=verdict.affordable,
        summary=verdict.summary,
        days_until=days_until,
        monthly_to_save=monthly_to_save,
        points_needed=points_needed,
        points_shortfalls=shortfalls,
        points_covered=not shortfalls,
    )


@router.get("/legs/{leg_id}/search-flights", response_model=FlightSearchOut)
async def search_flights_for_leg(
    leg_id: uuid.UUID,
    adults: int = Query(1, ge=1, le=9),
    db: AsyncSession = Depends(get_db),
) -> FlightSearchOut:
    """Live cash fares for this leg, to price the award against.

    Needs the leg's origin, destination and date — a fare can't be looked up without
    them. Never raises for a missing key or a provider outage: the planner's manual
    lane is the fallback, so a failed search degrades rather than breaking the board.
    """
    leg = (await db.execute(select(TripLeg).where(TripLeg.id == leg_id))).scalar_one_or_none()
    if leg is None:
        raise HTTPException(404, "Leg not found")

    connector = get_amadeus()
    if connector is None:
        return FlightSearchOut(configured=False)

    if leg.kind != "flight":
        return FlightSearchOut(configured=True, error="Live search covers flights only.")
    if not leg.origin or not leg.destination or not leg.leg_date:
        return FlightSearchOut(
            configured=True,
            is_test_data=connector.is_test_host,
            error="Add an origin, destination and date to this leg to search fares.",
        )

    try:
        quotes = await run_in_threadpool(
            connector.search_flights,
            origin=leg.origin,
            destination=leg.destination,
            departure=leg.leg_date,
            adults=adults,
        )
    except AmadeusError as exc:
        logger.warning("Amadeus search failed for leg %s: %s", leg_id, exc)
        return FlightSearchOut(
            configured=True, is_test_data=connector.is_test_host, error=str(exc)
        )

    return FlightSearchOut(
        configured=True,
        is_test_data=connector.is_test_host,
        quotes=[
            FlightQuoteOut(
                price=q.price, currency=q.currency, carrier=q.carrier,
                departure=q.departure, arrival=q.arrival, stops=q.stops,
                duration=q.duration, label=q.label,
            )
            for q in quotes
        ],
    )


@router.post("/legs/{leg_id}/options/from-quote", response_model=OptionOut, status_code=201)
async def option_from_quote(
    leg_id: uuid.UUID,
    body: FlightQuoteOut,
    db: AsyncSession = Depends(get_db),
) -> OptionOut:
    """Save a live quote as an option so it ranks alongside everything else.

    Stored with ``source="amadeus"`` and today's ``quoted_on`` — a fare is only true
    on the day it was fetched, and the board shows that date for exactly that reason.
    """
    if (await db.execute(select(TripLeg.id).where(TripLeg.id == leg_id))).scalar_one_or_none() is None:
        raise HTTPException(404, "Leg not found")

    o = TravelOption(
        leg_id=leg_id,
        source="amadeus",
        label=body.label,
        cash_price=body.price,
        quoted_on=date.today(),
        notes=body.duration,
    )
    db.add(o)
    await db.commit()
    await db.refresh(o)
    return _option_out(o)


@router.get("/legs/{leg_id}/search-awards", response_model=AwardSearchOut)
async def search_awards_for_leg(
    leg_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> AwardSearchOut:
    """Award space on this leg's route, annotated with whether you can pay for it.

    The annotation is the point. An award priced in a programme you can't reach is
    just trivia; what matters is which of *your* balances covers it, directly or by
    transfer. Never raises — a missing key or provider outage degrades to the manual
    lane rather than breaking the board.
    """
    leg = (await db.execute(select(TripLeg).where(TripLeg.id == leg_id))).scalar_one_or_none()
    if leg is None:
        raise HTTPException(404, "Leg not found")

    connector = get_seats()
    if connector is None:
        return AwardSearchOut(configured=False)
    if leg.kind != "flight":
        return AwardSearchOut(configured=True, error="Award search covers flights only.")
    if not leg.origin or not leg.destination or not leg.leg_date:
        return AwardSearchOut(
            configured=True,
            error="Add an origin, destination and date to this leg to search award space.",
        )

    try:
        quotes = await run_in_threadpool(
            connector.search_awards,
            origin=leg.origin,
            destination=leg.destination,
            start=leg.leg_date,
        )
    except SeatsAeroError as exc:
        logger.warning("seats.aero search failed for leg %s: %s", leg_id, exc)
        return AwardSearchOut(configured=True, error=str(exc))

    balances = await _current_balances(db)
    return AwardSearchOut(
        configured=True,
        quotes=[_award_out(q, balances) for q in quotes],
    )


def _award_out(q, balances: dict[str, float]) -> AwardQuoteOut:
    """Attach coverage to an award quote.

    Distinguishes "nothing you hold reaches this programme" from "this table knows
    nothing about the programme" — the second is a gap in curated data, and reporting
    it as the first would tell the user their points are useless on a route where they
    may well work.
    """
    routes = routes_for_award(
        target_program=q.program, points_price=q.miles, balances=balances
    )
    if routes:
        best = routes[0]
        coverage = "covered" if best.covered else "short"
        best_program = best.program
        shortfall = None if best.covered else best.shortfall
    elif has_transfer_data(q.program):
        coverage, best_program, shortfall = "no_route", None, None
    else:
        coverage, best_program, shortfall = "unknown", None, None

    return AwardQuoteOut(
        source=q.source, program=q.program, cabin=q.cabin, cabin_label=q.cabin_label,
        miles=q.miles, taxes=q.taxes, taxes_currency=q.taxes_currency, date=q.date,
        origin=q.origin, destination=q.destination, direct=q.direct, seats=q.seats,
        airlines=q.airlines, label=q.label,
        coverage=coverage, best_program=best_program, shortfall=shortfall,
    )


@router.post("/legs/{leg_id}/options/from-award", response_model=OptionOut, status_code=201)
async def option_from_award(
    leg_id: uuid.UUID,
    body: AwardQuoteOut,
    db: AsyncSession = Depends(get_db),
) -> OptionOut:
    """Save an award result as an option so it ranks against the cash quotes.

    Priced in the *mileage programme* the award is issued by, not the card currency
    you'd transfer from — that's what the award actually costs, and the transfer path
    is a separate question the routes view answers.
    """
    if (await db.execute(select(TripLeg.id).where(TripLeg.id == leg_id))).scalar_one_or_none() is None:
        raise HTTPException(404, "Leg not found")

    o = TravelOption(
        leg_id=leg_id,
        source="seats_aero",
        label=body.label,
        points_price=body.miles,
        program=body.program,
        fees=body.taxes,
        quoted_on=date.today(),
        notes=body.airlines,
    )
    db.add(o)
    await db.commit()
    await db.refresh(o)
    return _option_out(o)


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
