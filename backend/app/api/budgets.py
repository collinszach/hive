"""Budgets API — monthly budget management with actual spend tracking."""
import logging
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, field_validator
from sqlalchemy import and_, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.budget import Budget
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


class BudgetOut(BaseModel):
    id: uuid.UUID
    category: str
    month: date
    budget_amount: float
    actual_spend: float
    pct_used: float
    remaining: float
    has_budget: bool = True  # False for categories with spend but no budget row in DB

    model_config = {"from_attributes": True}


class BudgetUpsertRequest(BaseModel):
    category: str
    month: str  # YYYY-MM
    budget_amount: float

    @field_validator("month")
    @classmethod
    def validate_month(cls, v: str) -> str:
        try:
            year, mo = int(v[:4]), int(v[5:7])
            if not (1 <= mo <= 12):
                raise ValueError
        except (ValueError, IndexError):
            raise ValueError("month must be YYYY-MM format")
        return v

    @field_validator("budget_amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v < 0:
            raise ValueError("budget_amount must be non-negative")
        return v


def _month_bounds(month_str: str) -> tuple[date, date]:
    year, mo = int(month_str[:4]), int(month_str[5:7])
    start = date(year, mo, 1)
    end = date(year + 1, 1, 1) if mo == 12 else date(year, mo + 1, 1)
    return start, end


@router.get("", response_model=list[BudgetOut])
async def list_budgets(
    month: Optional[str] = Query(None, description="YYYY-MM, defaults to current month"),
    db: AsyncSession = Depends(get_db),
) -> list[BudgetOut]:
    """List all budgets for a given month with actual spend from transactions."""
    if month is None:
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

    try:
        start, end = _month_bounds(month)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="month must be YYYY-MM format")

    # Fetch budgets
    budget_result = await db.execute(
        select(Budget).where(Budget.month == start).order_by(Budget.category)
    )
    budgets = budget_result.scalars().all()

    # Actual spend per category (non-excluded, non-pending, non-transfer, positive amounts)
    spend_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount))
        .where(
            and_(
                Transaction.date >= start,
                Transaction.date < end,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.is_transfer == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.amount > 0,
                Transaction.category != "Transfers",
            )
        )
        .group_by(Transaction.category)
    )
    actual_by_category: dict[str, float] = {
        row[0]: float(row[1]) for row in spend_result.all() if row[0]
    }

    out = []
    budgeted_categories = set()
    for b in budgets:
        actual = actual_by_category.get(b.category, 0.0)
        budget_amt = float(b.budget_amount)
        pct = round((actual / budget_amt * 100) if budget_amt > 0 else 0.0, 1)
        out.append(BudgetOut(
            id=b.id,
            category=b.category,
            month=b.month,
            budget_amount=budget_amt,
            actual_spend=round(actual, 2),
            pct_used=pct,
            remaining=round(budget_amt - actual, 2),
        ))
        budgeted_categories.add(b.category)

    # Also include categories with actual spend but no budget set
    for category, actual in actual_by_category.items():
        if category not in budgeted_categories:
            out.append(BudgetOut(
                id=uuid.uuid4(),
                category=category,
                month=start,
                budget_amount=0.0,
                actual_spend=round(actual, 2),
                pct_used=0.0,
                remaining=round(-actual, 2),
                has_budget=False,
            ))

    out.sort(key=lambda x: x.actual_spend, reverse=True)
    # Only return categories that have an actual budget row — ghost categories
    # (spending but no budget set) are excluded; users add budgets explicitly.
    return [b for b in out if b.has_budget]


@router.post("", response_model=BudgetOut)
async def upsert_budget(
    body: BudgetUpsertRequest,
    db: AsyncSession = Depends(get_db),
) -> BudgetOut:
    """Create or update a budget for a category/month. Upserts on conflict."""
    start, end = _month_bounds(body.month)

    stmt = pg_insert(Budget).values(
        category=body.category,
        month=start,
        budget_amount=body.budget_amount,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_budget_category_month",
        set_={"budget_amount": stmt.excluded.budget_amount},
    )
    await db.execute(stmt)
    await db.commit()

    # Fetch the upserted record
    result = await db.execute(
        select(Budget).where(
            and_(Budget.category == body.category, Budget.month == start)
        )
    )
    b = result.scalar_one()

    # Compute actual spend
    spend_result = await db.execute(
        select(func.sum(Transaction.amount)).where(
            and_(
                Transaction.category == body.category,
                Transaction.date >= start,
                Transaction.date < end,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.is_transfer == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.amount > 0,
            )
        )
    )
    actual = float(spend_result.scalar_one() or 0)
    budget_amt = float(b.budget_amount)
    pct = round((actual / budget_amt * 100) if budget_amt > 0 else 0.0, 1)

    return BudgetOut(
        id=b.id,
        category=b.category,
        month=b.month,
        budget_amount=budget_amt,
        actual_spend=round(actual, 2),
        pct_used=pct,
        remaining=round(budget_amt - actual, 2),
    )


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a budget by ID."""
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")
    await db.delete(b)
    await db.commit()
    return Response(status_code=204)
