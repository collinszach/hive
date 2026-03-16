"""Points API — summary, optimizer, and ledger endpoints."""
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.points_balance import PointsBalance
from app.models.points_ledger import PointsLedger
from app.points.tracker import (
    POINT_VALUES_CPP,
    REDEMPTION_THRESHOLDS,
    CardOption,
    get_best_card_for_purchase,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/points", tags=["points"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class ProgramSummary(BaseModel):
    program: str
    points_earned_90d: float
    manual_balance: Optional[int]
    estimated_value_dollars: float
    redemption_threshold: Optional[int]
    above_threshold: bool


class PointsSummaryResponse(BaseModel):
    programs: list[ProgramSummary]
    total_estimated_value_dollars: float


class CardOptionOut(BaseModel):
    card_slug: str
    program: str
    earn_rate: float
    points_earned: float
    dollar_value: float
    is_best: bool


class OptimizerResponse(BaseModel):
    category: Optional[str]
    subcategory: Optional[str]
    amount: float
    cards: list[CardOptionOut]


class LedgerEntryOut(BaseModel):
    transaction_id: uuid.UUID
    account_id: uuid.UUID
    card_slug: str
    program: str
    points_earned: float
    earn_rate: float
    category: Optional[str]
    subcategory: Optional[str]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=PointsSummaryResponse)
async def points_summary(db: AsyncSession = Depends(get_db)) -> PointsSummaryResponse:
    """
    Total points earned (last 90 days) per program, plus manual balance if entered,
    estimated dollar value, and redemption nudge.
    """
    # Aggregate earned points from ledger (last 90 days already filtered by task)
    earned_rows = await db.execute(
        select(PointsLedger.program, func.sum(PointsLedger.points_earned))
        .group_by(PointsLedger.program)
    )
    earned_by_program: dict[str, float] = {
        row[0]: float(row[1]) for row in earned_rows.all()
    }

    # Latest manual balances
    # Subquery: max as_of per card_slug
    latest_balances = await db.execute(
        select(PointsBalance.program, func.sum(PointsBalance.balance))
        .group_by(PointsBalance.program)
    )
    manual_by_program: dict[str, int] = {
        row[0]: int(row[1]) for row in latest_balances.all()
    }

    all_programs = set(earned_by_program) | set(manual_by_program) | set(POINT_VALUES_CPP)
    programs = []
    total_value = 0.0

    for program in sorted(all_programs):
        earned = earned_by_program.get(program, 0.0)
        manual = manual_by_program.get(program)
        cpp = POINT_VALUES_CPP.get(program, 1.0)
        threshold = REDEMPTION_THRESHOLDS.get(program)

        # Dollar value based on manual balance if available, otherwise earned
        balance_for_value = float(manual) if manual is not None else earned
        est_value = round(balance_for_value * cpp / 100.0, 2)
        total_value += est_value

        programs.append(ProgramSummary(
            program=program,
            points_earned_90d=round(earned, 2),
            manual_balance=manual,
            estimated_value_dollars=est_value,
            redemption_threshold=threshold,
            above_threshold=threshold is not None and balance_for_value >= threshold,
        ))

    return PointsSummaryResponse(
        programs=programs,
        total_estimated_value_dollars=round(total_value, 2),
    )


@router.get("/optimize", response_model=OptimizerResponse)
async def optimize_card(
    category: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    amount: float = Query(100.0, gt=0),
) -> OptimizerResponse:
    """
    Return ranked card list for a given purchase category and amount.
    Best card is first, marked with is_best=True.
    """
    options: list[CardOption] = get_best_card_for_purchase(category, subcategory, amount)

    cards_out = []
    for i, opt in enumerate(options):
        cards_out.append(CardOptionOut(
            card_slug=opt.card_slug,
            program=opt.program,
            earn_rate=opt.earn_rate,
            points_earned=opt.points_earned,
            dollar_value=opt.dollar_value,
            is_best=(i == 0),
        ))

    return OptimizerResponse(
        category=category,
        subcategory=subcategory,
        amount=amount,
        cards=cards_out,
    )


@router.get("/ledger", response_model=list[LedgerEntryOut])
async def points_ledger(
    account_id: Optional[uuid.UUID] = Query(None),
    month: Optional[str] = Query(None, description="YYYY-MM"),
    db: AsyncSession = Depends(get_db),
) -> list[LedgerEntryOut]:
    """Transaction-level points ledger with optional filters."""
    from datetime import date
    from sqlalchemy import and_
    from app.models.transaction import Transaction

    filters = []
    if account_id:
        filters.append(PointsLedger.account_id == account_id)

    if month:
        try:
            year, mo = int(month[:4]), int(month[5:7])
            start = date(year, mo, 1)
            end = date(year + 1, 1, 1) if mo == 12 else date(year, mo + 1, 1)
            # Join to filter by transaction date
            result = await db.execute(
                select(PointsLedger)
                .join(Transaction, PointsLedger.transaction_id == Transaction.id)
                .where(and_(
                    Transaction.date >= start,
                    Transaction.date < end,
                    *filters,
                ))
                .order_by(Transaction.date.desc())
                .limit(500)
            )
            return [LedgerEntryOut.model_validate(r) for r in result.scalars().all()]
        except (ValueError, IndexError):
            pass

    result = await db.execute(
        select(PointsLedger)
        .where(and_(*filters) if filters else True)
        .order_by(PointsLedger.computed_at.desc())
        .limit(500)
    )
    return [LedgerEntryOut.model_validate(r) for r in result.scalars().all()]
