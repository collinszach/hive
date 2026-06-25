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

from app.analytics.spend import net_spend_expr
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
    rollover: bool = False
    rollover_amount: float = 0.0   # underspend carried from prior month
    effective_budget: float = 0.0  # budget_amount + rollover_amount
    actual_spend: float
    pct_used: float
    remaining: float
    has_budget: bool = True  # False for categories with spend but no budget row in DB

    model_config = {"from_attributes": True}


class BudgetUpsertRequest(BaseModel):
    category: str
    month: str  # YYYY-MM
    budget_amount: float
    rollover: bool = False

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


def _prior_month_bounds(current_start: date) -> tuple[date, date]:
    """Return (start, end) for the month before current_start."""
    if current_start.month == 1:
        prior_start = date(current_start.year - 1, 12, 1)
    else:
        prior_start = date(current_start.year, current_start.month - 1, 1)
    return prior_start, current_start


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

    # Actual spend per category (non-excluded, non-pending, non-transfer, positive amounts).
    # Spend is netted by what others owe the user (expense shares).
    spend_result = await db.execute(
        select(Transaction.category, func.sum(net_spend_expr()))
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

    # For rollover budgets: compute prior month's underspend per category
    rollover_categories = [b.category for b in budgets if b.rollover]
    prior_underspend: dict[str, float] = {}
    if rollover_categories:
        prior_start, prior_end = _prior_month_bounds(start)
        # Fetch prior month budgets for rollover categories
        prior_budget_result = await db.execute(
            select(Budget).where(
                and_(Budget.month == prior_start, Budget.category.in_(rollover_categories))
            )
        )
        prior_budgets = {pb.category: float(pb.budget_amount) for pb in prior_budget_result.scalars().all()}

        # Fetch prior month actual spend (netted by expense shares)
        prior_spend_result = await db.execute(
            select(Transaction.category, func.sum(net_spend_expr()))
            .where(
                and_(
                    Transaction.date >= prior_start,
                    Transaction.date < prior_end,
                    Transaction.is_excluded == False,  # noqa: E712
                    Transaction.is_transfer == False,  # noqa: E712
                    Transaction.pending == False,  # noqa: E712
                    Transaction.amount > 0,
                    Transaction.category.in_(rollover_categories),
                )
            )
            .group_by(Transaction.category)
        )
        prior_actual: dict[str, float] = {
            row[0]: float(row[1]) for row in prior_spend_result.all() if row[0]
        }

        for cat in rollover_categories:
            pb_amt = prior_budgets.get(cat, 0.0)
            pa_amt = prior_actual.get(cat, 0.0)
            underspend = pb_amt - pa_amt
            prior_underspend[cat] = max(0.0, round(underspend, 2))

    out = []
    budgeted_categories = set()
    for b in budgets:
        actual = actual_by_category.get(b.category, 0.0)
        budget_amt = float(b.budget_amount)
        rollover_amt = prior_underspend.get(b.category, 0.0) if b.rollover else 0.0
        effective = budget_amt + rollover_amt
        pct = round((actual / effective * 100) if effective > 0 else 0.0, 1)
        out.append(BudgetOut(
            id=b.id,
            category=b.category,
            month=b.month,
            budget_amount=budget_amt,
            rollover=b.rollover,
            rollover_amount=rollover_amt,
            effective_budget=round(effective, 2),
            actual_spend=round(actual, 2),
            pct_used=pct,
            remaining=round(effective - actual, 2),
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
        rollover=body.rollover,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_budget_category_month",
        set_={
            "budget_amount": stmt.excluded.budget_amount,
            "rollover": stmt.excluded.rollover,
        },
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

    # Compute actual spend (netted by expense shares)
    spend_result = await db.execute(
        select(func.sum(net_spend_expr())).where(
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
        rollover=b.rollover,
        rollover_amount=0.0,
        effective_budget=budget_amt,
        actual_spend=round(actual, 2),
        pct_used=pct,
        remaining=round(budget_amt - actual, 2),
    )


class BudgetCopyRequest(BaseModel):
    from_month: str   # YYYY-MM to copy from
    to_month: str     # YYYY-MM to copy to
    overwrite: bool = False  # If True, overwrite existing budgets in to_month


@router.post("/copy", response_model=dict)
async def copy_budgets(
    body: BudgetCopyRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Copy all budgets from one month to another.
    Skips categories that already have a budget in to_month unless overwrite=True.
    Returns { copied: int, skipped: int }.
    """
    try:
        from_start, _ = _month_bounds(body.from_month)
        to_start, _   = _month_bounds(body.to_month)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid month format — use YYYY-MM")

    if from_start == to_start:
        raise HTTPException(status_code=400, detail="from_month and to_month must be different")

    # Fetch source budgets
    src_res = await db.execute(
        select(Budget).where(Budget.month == from_start)
    )
    source_budgets = src_res.scalars().all()
    if not source_budgets:
        return {"copied": 0, "skipped": 0, "message": f"No budgets found for {body.from_month}"}

    # Fetch existing budgets in target month
    dst_res = await db.execute(
        select(Budget.category).where(Budget.month == to_start)
    )
    existing_categories = {row[0] for row in dst_res.all()}

    copied = 0
    skipped = 0
    for src in source_budgets:
        if src.category in existing_categories and not body.overwrite:
            skipped += 1
            continue
        stmt = pg_insert(Budget).values(
            category=src.category,
            month=to_start,
            budget_amount=src.budget_amount,
            rollover=src.rollover,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_budget_category_month",
            set_={
                "budget_amount": stmt.excluded.budget_amount,
                "rollover": stmt.excluded.rollover,
            },
        )
        await db.execute(stmt)
        copied += 1

    await db.commit()
    return {"copied": copied, "skipped": skipped}


@router.get("/suggest")
async def suggest_budgets(
    month: Optional[str] = Query(None, description="YYYY-MM of the target month (defaults to next month)"),
    lookback_months: int = Query(3, ge=1, le=12, description="Months of history to average"),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Suggest budget amounts for each spending category based on historical average.

    Returns categories with their 3-month average spend and a suggested budget
    (rounded up to the nearest $5, with a small 10% buffer).
    """
    today = date.today()
    if month:
        try:
            year, mo = int(month[:4]), int(month[5:7])
            target_month = date(year, mo, 1)
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM format")
    else:
        # Default: next month
        if today.month == 12:
            target_month = date(today.year + 1, 1, 1)
        else:
            target_month = date(today.year, today.month + 1, 1)

    # Historical window: lookback_months before target_month
    if target_month.month <= lookback_months:
        history_start = date(target_month.year - 1, 12 - (lookback_months - target_month.month), 1)
    else:
        history_start = date(target_month.year, target_month.month - lookback_months, 1)

    rows = await db.execute(
        select(Transaction.category, func.sum(net_spend_expr()).label("total"))
        .where(
            and_(
                Transaction.date >= history_start,
                Transaction.date < target_month,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.is_transfer == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.amount > 0,
                Transaction.category.isnot(None),
                Transaction.category != "Transfers",
            )
        )
        .group_by(Transaction.category)
        .order_by(func.sum(net_spend_expr()).desc())
    )
    results = rows.all()

    suggestions = []
    for row in results:
        avg = float(row.total) / lookback_months
        # Round up to nearest $5 and add 10% buffer
        suggested = max(10.0, round((avg * 1.10 + 4.99) / 5) * 5)
        suggestions.append({
            "category": row.category,
            "avg_monthly": round(avg, 2),
            "suggested_budget": suggested,
            "lookback_months": lookback_months,
        })

    return suggestions


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
