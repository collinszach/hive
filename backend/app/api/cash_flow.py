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

# Shared WHERE clause fragments used across all spending queries
# Subscriptions are excluded from "spending" totals — they're tracked separately
_SPEND_EXCLUDE = """
    AND NOT t.is_transfer
    AND NOT t.is_excluded
    AND NOT t.is_subscription
    AND NOT t.pending
    AND t.amount > 0
    AND a.is_active = TRUE
    AND a.subtype NOT IN ('savings', 'cd', 'money market')
"""

_ACCT_JOIN = "JOIN accounts a ON t.account_id = a.id"


@router.get("/monthly")
async def monthly_cash_flow(
    months: int = 12,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return monthly income and expenses for the last N months."""
    cutoff = date.today().replace(day=1) - timedelta(days=30 * (months - 1))
    cutoff = cutoff.replace(day=1)

    result = await session.execute(
        text(f"""
            SELECT
                TO_CHAR(t.date, 'YYYY-MM') AS month,
                SUM(CASE WHEN t.category = 'Income' AND t.amount < 0 AND NOT t.pending THEN ABS(t.amount) ELSE 0 END) AS income,
                SUM(CASE WHEN t.amount > 0 AND NOT t.is_excluded AND NOT t.is_subscription AND NOT t.pending
                         AND a.subtype NOT IN ('savings', 'cd', 'money market') THEN t.amount ELSE 0 END) AS expenses
            FROM transactions t
            {_ACCT_JOIN}
            WHERE t.date >= :cutoff
              AND NOT t.is_transfer
              AND a.is_active = TRUE
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
        text(f"""
            SELECT
                SUM(CASE WHEN t.category = 'Income' AND t.amount < 0 AND NOT t.pending THEN ABS(t.amount) ELSE 0 END) AS income,
                SUM(CASE WHEN t.amount > 0 AND NOT t.is_excluded AND NOT t.is_subscription AND NOT t.pending
                         AND a.subtype NOT IN ('savings', 'cd', 'money market') THEN t.amount ELSE 0 END) AS expenses
            FROM transactions t
            {_ACCT_JOIN}
            WHERE t.date >= :month_start
              AND t.date <= :month_end
              AND NOT t.is_transfer
              AND a.is_active = TRUE
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

    # Fetch income and total expenses (subscriptions excluded)
    result = await session.execute(
        text(f"""
            SELECT
                SUM(CASE WHEN t.category = 'Income' AND t.amount < 0 AND NOT t.pending THEN ABS(t.amount) ELSE 0 END) AS income,
                SUM(CASE WHEN t.amount > 0 AND NOT t.is_excluded AND NOT t.is_subscription AND NOT t.pending
                         AND a.subtype NOT IN ('savings', 'cd', 'money market') THEN t.amount ELSE 0 END) AS expenses
            FROM transactions t
            {_ACCT_JOIN}
            WHERE t.date >= :month_start
              AND t.date <= :month_end
              AND NOT t.is_transfer
              AND a.is_active = TRUE
        """),
        {"month_start": month_start, "month_end": month_end},
    )
    row = result.fetchone()
    income = float(row.income or 0)
    expenses = float(row.expenses or 0)
    savings = income - expenses

    # Fetch expense breakdown by top-level category (subscriptions excluded)
    cat_result = await session.execute(
        text(f"""
            SELECT
                COALESCE(t.category, 'Uncategorized') AS category,
                SUM(t.amount) AS total
            FROM transactions t
            {_ACCT_JOIN}
            WHERE t.date >= :month_start
              AND t.date <= :month_end
              AND NOT t.is_transfer
              AND NOT t.is_excluded
              AND NOT t.is_subscription
              AND NOT t.pending
              AND t.amount > 0
              AND t.category NOT IN ('Transfers', 'Income')
              AND a.is_active = TRUE
              AND a.subtype NOT IN ('savings', 'cd', 'money market')
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
        text(f"""
            SELECT
                TO_CHAR(t.date, 'YYYY-MM') AS month,
                SUM(t.amount) AS total
            FROM transactions t
            {_ACCT_JOIN}
            WHERE t.date >= :cutoff
              AND t.category = :category
              AND NOT t.is_excluded
              AND NOT t.is_subscription
              AND NOT t.is_transfer
              AND NOT t.pending
              AND t.amount > 0
              AND a.is_active = TRUE
              AND a.subtype NOT IN ('savings', 'cd', 'money market')
            GROUP BY 1
            ORDER BY 1
        """),
        {"cutoff": cutoff, "category": category},
    )
    return [
        {"month": row.month, "total": round(float(row.total or 0), 2)}
        for row in result.fetchall()
    ]


@router.get("/daily")
async def daily_spend(
    month: Optional[str] = None,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return spend totals per day-of-month for calendar heat map."""
    today = date.today()
    if month:
        try:
            y, m = int(month[:4]), int(month[5:7])
            month_start = date(y, m, 1)
            month_end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    else:
        month_start = today.replace(day=1)
        month_end = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)
        month = today.strftime("%Y-%m")

    result = await session.execute(
        text(f"""
            SELECT
                t.date,
                SUM(t.amount) AS total,
                COUNT(*) AS count
            FROM transactions t
            {_ACCT_JOIN}
            WHERE t.date >= :start
              AND t.date < :end
              AND NOT t.is_excluded
              AND NOT t.is_subscription
              AND NOT t.is_transfer
              AND NOT t.pending
              AND t.amount > 0
              AND a.is_active = TRUE
              AND a.subtype NOT IN ('savings', 'cd', 'money market')
            GROUP BY t.date
            ORDER BY t.date
        """),
        {"start": month_start, "end": month_end},
    )
    return [
        {"date": str(row.date), "total": round(float(row.total or 0), 2), "count": row.count}
        for row in result.fetchall()
    ]
