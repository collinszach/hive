"""Reports builder API."""
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["reports"])

_ACCOUNT_FILTER = "a.is_active = TRUE AND a.is_excluded = FALSE"
_SAVINGS_SUBTYPES = "('savings', 'cd', 'money market')"


@router.get("/spending-by-category")
async def spending_by_category(
    start_date: str | None = None,
    end_date: str | None = None,
    account_id: str | None = None,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Spending breakdown by category for a date range, optionally filtered to one account."""
    end = date.fromisoformat(end_date) if end_date else date.today()
    start = date.fromisoformat(start_date) if start_date else end.replace(day=1)

    acct_clause = "AND t.account_id = :account_id" if account_id else ""

    params: dict = {"start": start, "end": end}
    if account_id:
        params["account_id"] = account_id
    result = await session.execute(
        text(f"""
            SELECT
                t.category,
                t.subcategory,
                COUNT(*) AS transaction_count,
                SUM(t.amount) AS total,
                AVG(t.amount) AS avg_transaction
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date BETWEEN :start AND :end
              AND t.amount > 0
              AND NOT t.is_excluded
              AND NOT t.is_transfer
              AND NOT t.pending
              AND {_ACCOUNT_FILTER}
              AND a.subtype NOT IN {_SAVINGS_SUBTYPES}
              {acct_clause}
            GROUP BY t.category, t.subcategory
            ORDER BY total DESC
        """),
        params,
    )
    return [
        {
            "category": row.category or "Uncategorized",
            "subcategory": row.subcategory,
            "transaction_count": row.transaction_count,
            "total": round(float(row.total or 0), 2),
            "avg_transaction": round(float(row.avg_transaction or 0), 2),
        }
        for row in result.fetchall()
    ]


@router.get("/monthly-summary")
async def monthly_summary(
    year: int | None = None,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Month-by-month summary for a full year."""
    y = year or date.today().year
    result = await session.execute(
        text(f"""
            SELECT
                TO_CHAR(t.date, 'YYYY-MM') AS month,
                SUM(CASE WHEN t.amount > 0 AND NOT t.is_excluded AND NOT t.is_transfer
                         AND a.subtype NOT IN {_SAVINGS_SUBTYPES} THEN t.amount ELSE 0 END) AS expenses,
                SUM(CASE WHEN t.amount < 0 AND a.subtype = 'checking' THEN ABS(t.amount) ELSE 0 END) AS income,
                COUNT(CASE WHEN t.amount > 0 AND NOT t.is_excluded AND NOT t.is_transfer THEN 1 END) AS expense_count
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE EXTRACT(YEAR FROM t.date) = :year
              AND NOT t.pending
              AND NOT t.is_transfer
              AND NOT t.is_excluded
              AND {_ACCOUNT_FILTER}
            GROUP BY 1
            ORDER BY 1
        """),
        {"year": y},
    )
    return [
        {
            "month": row.month,
            "expenses": round(float(row.expenses or 0), 2),
            "income": round(float(row.income or 0), 2),
            "net": round(float(row.income or 0) - float(row.expenses or 0), 2),
            "expense_count": row.expense_count,
        }
        for row in result.fetchall()
    ]


@router.get("/tax-export")
async def tax_export(
    year: int | None = None,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """All non-excluded transactions for a tax year, sorted by category."""
    y = year or date.today().year
    result = await session.execute(
        text(f"""
            SELECT
                t.date, t.amount, COALESCE(t.merchant, t.raw_description) AS merchant,
                t.category, t.subcategory, t.raw_description
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE EXTRACT(YEAR FROM t.date) = :year
              AND NOT t.is_excluded
              AND NOT t.is_transfer
              AND NOT t.pending
              AND t.amount > 0
              AND {_ACCOUNT_FILTER}
              AND a.subtype NOT IN {_SAVINGS_SUBTYPES}
            ORDER BY t.category, t.date
        """),
        {"year": y},
    )
    return [
        {
            "date": row.date.isoformat(),
            "amount": float(row.amount),
            "merchant": row.merchant,
            "category": row.category or "Uncategorized",
            "subcategory": row.subcategory,
        }
        for row in result.fetchall()
    ]
