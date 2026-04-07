"""Cash flow analysis API — income vs expense bars + Prophet forecast."""
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cash-flow", tags=["cash-flow"])


@router.get("/monthly")
async def monthly_cash_flow(
    months: int = 12,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return monthly income and expenses for the last N months."""
    cutoff = date.today().replace(day=1) - timedelta(days=30 * (months - 1))
    cutoff = cutoff.replace(day=1)

    result = await session.execute(
        text("""
            SELECT
                TO_CHAR(date, 'YYYY-MM') AS month,
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS income,
                SUM(CASE WHEN amount > 0 AND NOT is_excluded AND NOT pending THEN amount ELSE 0 END) AS expenses
            FROM transactions
            WHERE date >= :cutoff
              AND NOT is_transfer
            GROUP BY 1
            ORDER BY 1
        """),
        {"cutoff": cutoff},
    )
    rows = result.fetchall()
    return [
        {
            "month": row.month,
            "income": round(float(row.income or 0), 2),
            "expenses": round(float(row.expenses or 0), 2),
            "net": round(float(row.income or 0) - float(row.expenses or 0), 2),
        }
        for row in rows
    ]


@router.get("/summary")
async def cash_flow_summary(
    month: str | None = None,   # YYYY-MM; defaults to current month
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Income, expenses, and savings rate for a given month (default: current)."""
    import calendar

    if month:
        try:
            year, m = int(month[:4]), int(month[5:7])
            month_start = date(year, m, 1)
            last_day = calendar.monthrange(year, m)[1]
            month_end = date(year, m, last_day)
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    else:
        today = date.today()
        month_start = today.replace(day=1)
        month_end = today

    result = await session.execute(
        text("""
            SELECT
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS income,
                SUM(CASE WHEN amount > 0 AND NOT is_excluded AND NOT pending THEN amount ELSE 0 END) AS expenses
            FROM transactions
            WHERE date >= :month_start
              AND date <= :month_end
              AND NOT is_transfer
        """),
        {"month_start": month_start, "month_end": month_end},
    )
    row = result.fetchone()
    income = float(row.income or 0)
    expenses = float(row.expenses or 0)
    savings = income - expenses
    savings_rate = (savings / income * 100) if income > 0 else 0

    return {
        "month": month or date.today().strftime("%Y-%m"),
        "income": round(income, 2),
        "expenses": round(expenses, 2),
        "net_savings": round(savings, 2),
        "savings_rate_pct": round(savings_rate, 1),
    }


@router.get("/flow")
async def cash_flow_sankey(
    month: str | None = None,   # YYYY-MM; defaults to current month
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Income → expense category breakdown for Sankey visualization."""
    import calendar

    if month:
        try:
            year, m = int(month[:4]), int(month[5:7])
            month_start = date(year, m, 1)
            last_day = calendar.monthrange(year, m)[1]
            month_end = date(year, m, last_day)
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    else:
        today = date.today()
        month_start = today.replace(day=1)
        month_end = today

    # Fetch income and total expenses
    result = await session.execute(
        text("""
            SELECT
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS income,
                SUM(CASE WHEN amount > 0 AND NOT is_excluded AND NOT pending THEN amount ELSE 0 END) AS expenses
            FROM transactions
            WHERE date >= :month_start
              AND date <= :month_end
              AND NOT is_transfer
        """),
        {"month_start": month_start, "month_end": month_end},
    )
    row = result.fetchone()
    income = float(row.income or 0)
    expenses = float(row.expenses or 0)
    savings = income - expenses

    # Fetch expense breakdown by top-level category
    cat_result = await session.execute(
        text("""
            SELECT
                COALESCE(category, 'Uncategorized') AS category,
                SUM(amount) AS total
            FROM transactions
            WHERE date >= :month_start
              AND date <= :month_end
              AND NOT is_transfer
              AND NOT is_excluded
              AND NOT pending
              AND amount > 0
              AND category != 'Transfers'
            GROUP BY 1
            ORDER BY 2 DESC
        """),
        {"month_start": month_start, "month_end": month_end},
    )
    categories = []
    for r in cat_result.fetchall():
        amt = float(r.total or 0)
        categories.append({
            "category": r.category,
            "amount": round(amt, 2),
            "pct": round((amt / income * 100) if income > 0 else 0, 1),
        })

    return {
        "month": month or date.today().strftime("%Y-%m"),
        "income": round(income, 2),
        "expenses": round(expenses, 2),
        "savings": round(savings, 2),
        "categories": categories,
    }


@router.get("/category-trend")
async def category_trend(
    category: str,
    months: int = 6,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Monthly spend for a specific category."""
    cutoff = date.today().replace(day=1) - timedelta(days=30 * (months - 1))
    cutoff = cutoff.replace(day=1)

    result = await session.execute(
        text("""
            SELECT
                TO_CHAR(date, 'YYYY-MM') AS month,
                SUM(amount) AS total
            FROM transactions
            WHERE date >= :cutoff
              AND category = :category
              AND NOT is_excluded
              AND NOT is_transfer
              AND NOT pending
              AND amount > 0
            GROUP BY 1
            ORDER BY 1
        """),
        {"cutoff": cutoff, "category": category},
    )
    return [
        {"month": row.month, "total": round(float(row.total or 0), 2)}
        for row in result.fetchall()
    ]
