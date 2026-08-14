"""MBA Budget — a curated view over Budgets/Transactions/Loans for the categories
that matter during the program: tuition, living costs, and loan balance. Plan
(budgeted) vs actual (netted spend) per month, blended with real loan entries."""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.spend import net_spend_expr
from app.db import get_db
from app.gates import get_current_user
from app.models.budget import Budget
from app.models.loan import Loan
from app.models.loan_entry import LoanEntry
from app.models.transaction import Transaction
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mba", tags=["mba"])

# HIVE's existing taxonomy categories mapped to the sheet's MBA budget lines.
_CATEGORY_LABELS: dict[str, str] = {
    "Education": "Tuition",
    "Home": "Living",
    "Groceries": "Groceries",
    "Food & Drink": "Eating Out",
    "Entertainment": "Entertainment",
    "Travel": "Travel",
}


class MonthLine(BaseModel):
    category: str
    label: str
    planned: float
    actual: Optional[float]  # None for future months with no transactions yet


class MonthSummary(BaseModel):
    month: str  # YYYY-MM
    is_past: bool
    lines: list[MonthLine]
    total_planned: float
    total_actual: Optional[float]


class LoanSummary(BaseModel):
    id: str
    name: str
    balance: float
    total_disbursed: float
    total_paid: float


class MbaSummary(BaseModel):
    months: list[MonthSummary]
    loans: list[LoanSummary]


def _month_str(d: date) -> str:
    return f"{d.year}-{d.month:02d}"


def _add_month(d: date) -> date:
    return date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1)


@router.get("/summary", response_model=MbaSummary)
async def mba_summary(
    start_month: str = Query(..., description="YYYY-MM, first month of the program"),
    end_month: str = Query(..., description="YYYY-MM, last month to include (inclusive)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MbaSummary:
    try:
        start = date(int(start_month[:4]), int(start_month[5:7]), 1)
        end = date(int(end_month[:4]), int(end_month[5:7]), 1)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="start_month/end_month must be YYYY-MM")  # noqa: F821

    categories = list(_CATEGORY_LABELS.keys())
    today_month_start = date.today().replace(day=1)

    # Planned: every Budget row in range for the mapped categories.
    budget_result = await db.execute(
        select(Budget.category, Budget.month, Budget.budget_amount)
        .where(
            and_(
                Budget.category.in_(categories),
                Budget.month >= start,
                Budget.month <= end,
            )
        )
    )
    planned: dict[tuple[str, str], float] = {
        (row.category, _month_str(row.month)): float(row.budget_amount) for row in budget_result.all()
    }

    # Actual: netted spend per category per month over the same range.
    range_end_exclusive = _add_month(end)
    actual_result = await db.execute(
        select(
            Transaction.category,
            func.date_trunc("month", Transaction.date).label("month"),
            func.sum(net_spend_expr()).label("total"),
        )
        .where(
            and_(
                Transaction.category.in_(categories),
                Transaction.date >= start,
                Transaction.date < range_end_exclusive,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.is_transfer == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.amount > 0,
            )
        )
        .group_by(Transaction.category, func.date_trunc("month", Transaction.date))
    )
    actual: dict[tuple[str, str], float] = {
        (row.category, _month_str(row.month.date())): float(row.total) for row in actual_result.all()
    }

    months: list[MonthSummary] = []
    cursor = start
    while cursor <= end:
        m = _month_str(cursor)
        is_past = cursor < today_month_start
        lines = []
        total_planned = 0.0
        total_actual = 0.0
        any_actual = False
        for cat, label in _CATEGORY_LABELS.items():
            p = planned.get((cat, m), 0.0)
            a = actual.get((cat, m))
            total_planned += p
            if a is not None:
                total_actual += a
                any_actual = True
            lines.append(MonthLine(category=cat, label=label, planned=round(p, 2), actual=round(a, 2) if a is not None else None))
        months.append(MonthSummary(
            month=m,
            is_past=is_past,
            lines=lines,
            total_planned=round(total_planned, 2),
            total_actual=round(total_actual, 2) if (any_actual or is_past) else None,
        ))
        cursor = _add_month(cursor)

    loans_result = await db.execute(select(Loan).where(Loan.user_id == user.id).order_by(Loan.created_at))
    loans = loans_result.scalars().all()
    loan_summaries = []
    for loan in loans:
        entries_result = await db.execute(select(LoanEntry).where(LoanEntry.loan_id == loan.id))
        entries = entries_result.scalars().all()
        balance = sum(float(e.amount) for e in entries)
        disbursed = sum(float(e.amount) for e in entries if e.entry_type in ("disbursement", "interest"))
        paid = sum(-float(e.amount) for e in entries if e.entry_type == "payment")
        loan_summaries.append(LoanSummary(
            id=str(loan.id), name=loan.name,
            balance=round(balance, 2), total_disbursed=round(disbursed, 2), total_paid=round(paid, 2),
        ))

    return MbaSummary(months=months, loans=loan_summaries)
