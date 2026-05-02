"""Reports builder API."""
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["reports"])

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
        text("""
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
              AND NOT t.is_subscription
              AND NOT t.is_transfer
              AND NOT t.pending
              AND a.is_active = TRUE AND a.is_excluded = FALSE
              AND a.subtype NOT IN ('savings', 'cd', 'money market', 'checking')
              """ + acct_clause + """
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
        text("""
            SELECT
                TO_CHAR(t.date, 'YYYY-MM') AS month,
                SUM(CASE WHEN t.amount > 0 AND NOT t.is_excluded AND NOT t.is_subscription AND NOT t.is_transfer
                         AND a.subtype NOT IN ('savings', 'cd', 'money market', 'checking') THEN t.amount ELSE 0 END) AS expenses,
                SUM(CASE WHEN t.amount < 0 AND t.category = 'Income' THEN ABS(t.amount) ELSE 0 END) AS income,
                COUNT(CASE WHEN t.amount > 0 AND NOT t.is_excluded AND NOT t.is_subscription AND NOT t.is_transfer THEN 1 END) AS expense_count
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE EXTRACT(YEAR FROM t.date) = :year
              AND NOT t.pending
              AND a.is_active = TRUE AND a.is_excluded = FALSE
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
        text("""
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
              AND a.is_active = TRUE AND a.is_excluded = FALSE
              AND a.subtype NOT IN ('savings', 'cd', 'money market', 'checking')
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


@router.get("/yoy-comparison")
async def yoy_comparison(
    category: str | None = None,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Month-by-month spend for current year vs prior year, optionally filtered to one category."""
    today = date.today()
    current_year = today.year
    prior_year = current_year - 1

    cat_clause = "AND t.category = :category" if category else "AND t.category IS NOT NULL AND t.category != 'Transfers'"

    params: dict = {"current_year": current_year, "prior_year": prior_year}
    if category:
        params["category"] = category

    result = await session.execute(
        text(f"""
            SELECT
                EXTRACT(MONTH FROM t.date)::int AS month_num,
                SUM(CASE WHEN EXTRACT(YEAR FROM t.date) = :current_year THEN t.amount ELSE 0 END) AS current_year,
                SUM(CASE WHEN EXTRACT(YEAR FROM t.date) = :prior_year  THEN t.amount ELSE 0 END) AS prior_year
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE EXTRACT(YEAR FROM t.date) IN (:current_year, :prior_year)
              AND t.amount > 0
              AND NOT t.is_excluded
              AND NOT t.is_transfer
              AND NOT t.pending
              AND a.is_active = TRUE AND a.is_excluded = FALSE
              {cat_clause}
            GROUP BY month_num
            ORDER BY month_num
        """),
        params,
    )
    month_abbr = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [
        {
            "month_num": row.month_num,
            "month": month_abbr[row.month_num],
            "current_year": round(float(row.current_year or 0), 2),
            "prior_year": round(float(row.prior_year or 0), 2),
            "delta": round(float(row.current_year or 0) - float(row.prior_year or 0), 2),
        }
        for row in result.fetchall()
    ]


@router.get("/budget-history")
async def budget_history(
    months: int = 6,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Per-category budget vs actual spend for the last N months."""
    today = date.today()
    result_months = []
    for i in range(months - 1, -1, -1):
        mo = today.month - i
        yr = today.year
        while mo <= 0:
            mo += 12
            yr -= 1
        result_months.append(date(yr, mo, 1))

    if not result_months:
        return []

    # Pull all budget rows for the date range
    result = await session.execute(
        text("""
            SELECT
                TO_CHAR(b.month, 'YYYY-MM') AS month,
                b.category,
                b.budget_amount,
                COALESCE(SUM(t.amount), 0) AS actual_spend
            FROM budgets b
            LEFT JOIN transactions t ON
                t.category = b.category
                AND t.date >= b.month
                AND t.date < (b.month + INTERVAL '1 month')
                AND t.amount > 0
                AND NOT t.is_excluded
                AND NOT t.is_transfer
                AND NOT t.pending
            WHERE b.month >= :start_month
              AND b.month <= :end_month
            GROUP BY b.month, b.category, b.budget_amount
            ORDER BY b.month, b.category
        """),
        {
            "start_month": result_months[0],
            "end_month": result_months[-1],
        },
    )
    rows = result.fetchall()
    return [
        {
            "month": row.month,
            "category": row.category,
            "budget_amount": round(float(row.budget_amount or 0), 2),
            "actual_spend": round(float(row.actual_spend or 0), 2),
            "pct_used": round((float(row.actual_spend or 0) / float(row.budget_amount) * 100) if row.budget_amount else 0, 1),
        }
        for row in rows
    ]


@router.get("/spending-by-weekday")
async def spending_by_weekday(
    days: int = 90,
    category: Optional[str] = None,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Average daily spend broken down by day of week."""
    cutoff = date.today() - timedelta(days=days)

    cat_clause = "AND t.category = :category" if category else ""
    params: dict = {"cutoff": cutoff}
    if category:
        params["category"] = category

    result = await session.execute(
        text(f"""
            SELECT
                EXTRACT(DOW FROM t.date)::int AS dow,
                TO_CHAR(t.date, 'Dy')          AS day_name,
                COUNT(*)                        AS transaction_count,
                SUM(t.amount)                   AS total,
                AVG(t.amount)                   AS avg_transaction,
                COUNT(DISTINCT t.date)          AS days_with_spend
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date >= :cutoff
              AND t.amount > 0
              AND NOT t.is_excluded
              AND NOT t.is_transfer
              AND NOT t.pending
              AND a.is_active = TRUE AND a.is_excluded = FALSE
              AND a.subtype NOT IN ('savings', 'cd', 'money market', 'checking')
              {cat_clause}
            GROUP BY dow, day_name
            ORDER BY dow
        """),
        params,
    )
    rows = result.fetchall()

    # Build all 7 days with zeros for missing days
    DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    by_dow = {row.dow: row for row in rows}
    return [
        {
            "dow": i,
            "day_name": DOW_NAMES[i],
            "transaction_count": by_dow[i].transaction_count if i in by_dow else 0,
            "total": round(float(by_dow[i].total or 0), 2) if i in by_dow else 0.0,
            "avg_transaction": round(float(by_dow[i].avg_transaction or 0), 2) if i in by_dow else 0.0,
            "days_with_spend": by_dow[i].days_with_spend if i in by_dow else 0,
        }
        for i in range(7)
    ]


@router.get("/daily-spend")
async def daily_spend(
    year: int | None = None,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Daily spending totals for an entire year.
    Returns one entry per day that had spending (or every day if needed).
    Used for the calendar heatmap view.
    """
    y = year or date.today().year
    start = date(y, 1, 1)
    end   = date(y, 12, 31)

    result = await session.execute(
        text("""
            SELECT
                t.date,
                SUM(t.amount)   AS total,
                COUNT(*)        AS count
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date BETWEEN :start AND :end
              AND t.amount > 0
              AND NOT t.is_excluded
              AND NOT t.is_transfer
              AND NOT t.pending
              AND a.is_active = TRUE AND a.is_excluded = FALSE
              AND a.subtype NOT IN ('savings', 'cd', 'money market', 'checking')
            GROUP BY t.date
            ORDER BY t.date
        """),
        {"start": start, "end": end},
    )
    rows = result.fetchall()
    return [
        {
            "date":  row.date.isoformat(),
            "total": round(float(row.total or 0), 2),
            "count": row.count,
        }
        for row in rows
    ]


@router.get("/category-trend")
async def category_trend(
    category: str,
    months: int = 13,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Month-by-month spending for a specific category over the trailing N months.
    Used to show category spend trends.
    """
    today = date.today()
    start = (today.replace(day=1) - timedelta(days=30 * (months - 1))).replace(day=1)

    result = await session.execute(
        text("""
            SELECT
                TO_CHAR(t.date, 'YYYY-MM')  AS month,
                SUM(t.amount)               AS total,
                COUNT(*)                    AS count
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date >= :start
              AND t.category = :category
              AND t.amount > 0
              AND NOT t.is_excluded
              AND NOT t.is_transfer
              AND NOT t.pending
              AND a.is_active = TRUE AND a.is_excluded = FALSE
              AND a.subtype NOT IN ('savings', 'cd', 'money market', 'checking')
            GROUP BY 1
            ORDER BY 1
        """),
        {"start": start, "category": category},
    )
    return [
        {
            "month": row.month,
            "total": round(float(row.total or 0), 2),
            "count": row.count,
        }
        for row in result.fetchall()
    ]


@router.get("/spending-by-card")
async def spending_by_card(
    start_date: str | None = None,
    end_date: str | None = None,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Total spending per credit card (account) for a date range.
    Returns accounts ordered by total spend descending, with top-3 categories per card.
    Only includes credit/debit spending accounts (not savings).
    """
    end = date.fromisoformat(end_date) if end_date else date.today()
    start = date.fromisoformat(start_date) if start_date else end.replace(day=1)

    result = await session.execute(
        text("""
            SELECT
                a.id                                        AS account_id,
                a.name                                      AS account_name,
                COALESCE(a.card_slug, a.subtype, a.type)    AS card_slug,
                a.type                                      AS account_type,
                a.subtype                                   AS account_subtype,
                SUM(t.amount)                               AS total_spend,
                COUNT(*)                                    AS transaction_count,
                AVG(t.amount)                               AS avg_transaction,
                COUNT(DISTINCT t.category)                  AS category_count
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date BETWEEN :start AND :end
              AND t.amount > 0
              AND NOT t.is_excluded
              AND NOT t.is_transfer
              AND NOT t.pending
              AND a.is_active = TRUE
              AND a.is_excluded = FALSE
              AND a.subtype NOT IN ('savings', 'cd', 'money market', 'checking')
            GROUP BY a.id, a.name, a.card_slug, a.type, a.subtype
            ORDER BY total_spend DESC
        """),
        {"start": start, "end": end},
    )
    card_rows = result.fetchall()

    # Fetch top categories per account
    cat_result = await session.execute(
        text("""
            SELECT
                t.account_id::text  AS account_id,
                t.category          AS category,
                SUM(t.amount)       AS total
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date BETWEEN :start AND :end
              AND t.amount > 0
              AND NOT t.is_excluded
              AND NOT t.is_transfer
              AND NOT t.pending
              AND t.category IS NOT NULL
              AND a.is_active = TRUE
              AND a.is_excluded = FALSE
              AND a.subtype NOT IN ('savings', 'cd', 'money market', 'checking')
            GROUP BY t.account_id, t.category
            ORDER BY t.account_id, total DESC
        """),
        {"start": start, "end": end},
    )
    cat_rows = cat_result.fetchall()

    # Build top-3 category list per account
    from collections import defaultdict
    cats_by_account: dict[str, list[dict]] = defaultdict(list)
    for row in cat_rows:
        acct = str(row.account_id)
        if len(cats_by_account[acct]) < 3:
            cats_by_account[acct].append({
                "category": row.category,
                "total": round(float(row.total or 0), 2),
            })

    return [
        {
            "account_id":       str(row.account_id),
            "account_name":     row.account_name,
            "card_slug":        row.card_slug,
            "account_type":     row.account_type,
            "account_subtype":  row.account_subtype,
            "total_spend":      round(float(row.total_spend or 0), 2),
            "transaction_count": int(row.transaction_count or 0),
            "avg_transaction":  round(float(row.avg_transaction or 0), 2),
            "top_categories":   cats_by_account.get(str(row.account_id), []),
        }
        for row in card_rows
    ]


@router.get("/top-merchants")
async def top_merchants(
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = Query(default=20, ge=1, le=500),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Top merchants by total spend for a date range."""
    end = date.fromisoformat(end_date) if end_date else date.today()
    start = date.fromisoformat(start_date) if start_date else date(end.year, 1, 1)

    result = await session.execute(
        text("""
            SELECT
                COALESCE(t.merchant, t.raw_description, 'Unknown') AS merchant,
                MODE() WITHIN GROUP (ORDER BY t.category)          AS category,
                MODE() WITHIN GROUP (ORDER BY t.subcategory)       AS subcategory,
                COUNT(*)            AS transaction_count,
                SUM(t.amount)       AS total_spend,
                AVG(t.amount)       AS avg_transaction,
                MAX(t.date)         AS last_seen
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.date BETWEEN :start AND :end
              AND t.amount > 0
              AND NOT t.is_excluded
              AND NOT t.is_transfer
              AND NOT t.pending
              AND a.is_active = TRUE
              AND a.is_excluded = FALSE
              AND a.subtype NOT IN ('savings', 'cd', 'money market', 'checking')
            GROUP BY COALESCE(t.merchant, t.raw_description, 'Unknown')
            ORDER BY total_spend DESC
            LIMIT :limit
        """),
        {"start": start, "end": end, "limit": limit},
    )
    rows = result.fetchall()
    total = sum(float(r.total_spend or 0) for r in rows)
    return [
        {
            "merchant": row.merchant,
            "category": row.category or "Uncategorized",
            "subcategory": row.subcategory,
            "transaction_count": int(row.transaction_count or 0),
            "total_spend": round(float(row.total_spend or 0), 2),
            "avg_transaction": round(float(row.avg_transaction or 0), 2),
            "pct_of_total": round((float(row.total_spend or 0) / total * 100) if total > 0 else 0, 1),
            "last_seen": row.last_seen.isoformat() if row.last_seen else None,
        }
        for row in rows
    ]
