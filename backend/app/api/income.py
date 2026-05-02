"""Income API — breakdown of income transactions by source and month."""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/income", tags=["income"])


def _month_bounds(month_str: str) -> tuple[date, date]:
    try:
        year, mo = int(month_str[:4]), int(month_str[5:7])
        start = date(year, mo, 1)
        end = date(year + 1, 1, 1) if mo == 12 else date(year, mo + 1, 1)
        return start, end
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="month must be YYYY-MM format")


@router.get("/summary")
async def income_summary(
    month: Optional[str] = Query(None, description="YYYY-MM, defaults to current month"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Return total income and breakdown by source (merchant) for a given month.
    Income = transactions categorised as "Income" (salary, payroll, etc).
    Refunds, credits on expense categories, and transfers are excluded.
    """
    if month is None:
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

    start, end = _month_bounds(month)

    _income_filters = [
        Transaction.date >= start,
        Transaction.date < end,
        Transaction.amount < 0,
        Transaction.category == "Income",
        Transaction.is_excluded == False,  # noqa: E712
        Transaction.pending == False,  # noqa: E712
    ]

    # Total income
    total_result = await db.execute(
        select(func.sum(Transaction.amount).label("total"))
        .where(and_(*_income_filters))
    )
    total_income = abs(float(total_result.scalar_one() or 0))

    # Breakdown by merchant (top sources)
    sources_result = await db.execute(
        select(
            func.coalesce(Transaction.merchant, Transaction.raw_description).label("source"),
            func.sum(Transaction.amount).label("total"),
            func.count().label("count"),
        )
        .where(and_(*_income_filters))
        .group_by(func.coalesce(Transaction.merchant, Transaction.raw_description))
        .order_by(func.sum(Transaction.amount))  # most negative = most income
        .limit(20)
    )
    sources = [
        {
            "source": row.source,
            "amount": round(abs(float(row.total)), 2),
            "count": row.count,
            "pct": round(abs(float(row.total)) / total_income * 100, 1) if total_income > 0 else 0,
        }
        for row in sources_result.all()
    ]

    return {
        "month": month,
        "total_income": round(total_income, 2),
        "sources": sources,
    }


@router.get("/monthly")
async def income_monthly(
    months: int = Query(12, ge=1, le=36),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return monthly income totals for the last N months."""
    from datetime import date as _date
    today = _date.today()
    # Compute cutoff: first day of the month N months ago
    year = today.year
    mo = today.month - months
    while mo <= 0:
        mo += 12
        year -= 1
    cutoff = _date(year, mo, 1)

    _month_trunc = func.date_trunc(text("'month'"), Transaction.date)
    result = await db.execute(
        select(
            func.to_char(_month_trunc, "YYYY-MM").label("month"),
            func.sum(func.abs(Transaction.amount)).label("income"),
            func.count().label("count"),
        )
        .where(
            and_(
                Transaction.amount < 0,
                Transaction.category == "Income",
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.date >= cutoff,
            )
        )
        .group_by(_month_trunc)
        .order_by(_month_trunc)
    )
    return [
        {
            "month": row[0],
            "income": round(float(row[1]), 2),
            "count": row[2],
        }
        for row in result.all()
    ]
