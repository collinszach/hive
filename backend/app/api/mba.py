"""MBA Budget — a curated view over Budgets/Transactions/Loans for the categories
that matter during the program: tuition, living costs, and loan balance. Plan
(budgeted) vs actual (netted spend) per month, blended with real loan entries."""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.spend import net_spend_expr
from app.db import get_db
from app.gates import get_current_user
from app.models.budget import Budget
from app.models.loan import Loan
from app.models.loan_entry import LoanEntry
from app.models.net_worth import NetWorthSnapshot
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
    income: float             # actual Income-category inflow this month (0 for future months)
    loan_disbursed: float     # loan entries dated this month that add cash
    loan_paid: float          # loan payments dated this month that draw down cash
    net_change: Optional[float]   # income + loan_disbursed - expense - loan_paid; None before the projection anchor
    running_balance: Optional[float]  # projected cash remaining at the end of this month; None for past months


class LoanSummary(BaseModel):
    id: str
    name: str
    balance: float
    total_disbursed: float
    total_paid: float


class MbaSummary(BaseModel):
    months: list[MonthSummary]
    loans: list[LoanSummary]
    starting_balance: float       # current checking + savings balance, as of now
    starting_balance_month: str   # YYYY-MM the projection is anchored at


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
    # `text("'month'")` (not a plain Python string) so SQLAlchemy emits the same
    # literal in both SELECT and GROUP BY — a bound string param gets a fresh
    # placeholder each time it's compiled, which Postgres then treats as two
    # different expressions and rejects with a GROUP BY error.
    range_end_exclusive = _add_month(end)
    month_trunc = func.date_trunc(text("'month'"), Transaction.date)
    actual_result = await db.execute(
        select(
            Transaction.category,
            month_trunc.label("month"),
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
        .group_by(Transaction.category, month_trunc)
    )
    actual: dict[tuple[str, str], float] = {
        (row.category, _month_str(row.month.date())): float(row.total) for row in actual_result.all()
    }

    # Actual monthly income (Income-category inflows) — only meaningful for past/current
    # months; there's no structural "planned income" for future months.
    income_result = await db.execute(
        select(
            month_trunc.label("month"),
            func.sum(-Transaction.amount).label("total"),
        )
        .where(
            and_(
                Transaction.category == "Income",
                Transaction.date >= start,
                Transaction.date < range_end_exclusive,
                Transaction.amount < 0,
            )
        )
        .group_by(month_trunc)
    )
    income_by_month: dict[str, float] = {
        _month_str(row.month.date()): float(row.total) for row in income_result.all()
    }

    # Loan cash flow per month — disbursements/interest add cash, payments draw it down.
    # Only reflects entries the user has actually logged (past disbursements, or future
    # ones they've pre-entered); nothing is assumed.
    loan_entries_result = await db.execute(
        select(LoanEntry).where(
            and_(
                LoanEntry.user_id == user.id,
                LoanEntry.entry_date >= start,
                LoanEntry.entry_date < range_end_exclusive,
            )
        )
    )
    loan_disbursed_by_month: dict[str, float] = {}
    loan_paid_by_month: dict[str, float] = {}
    for e in loan_entries_result.scalars().all():
        m = _month_str(e.entry_date)
        if e.entry_type in ("disbursement", "interest"):
            loan_disbursed_by_month[m] = loan_disbursed_by_month.get(m, 0.0) + float(e.amount)
        elif e.entry_type == "payment":
            loan_paid_by_month[m] = loan_paid_by_month.get(m, 0.0) + (-float(e.amount))

    # Starting balance: total net worth (all assets minus liabilities) from the most
    # recent daily snapshot — every dollar you have access to, not just checking/savings.
    # NetWorthSnapshot is refreshed daily by the existing "daily-net-worth" beat task
    # (after the daily Plaid sync), so this projection's anchor moves every day without
    # any extra scheduling here.
    net_worth_result = await db.execute(
        select(NetWorthSnapshot.net_worth, NetWorthSnapshot.snapshot_date)
        .order_by(NetWorthSnapshot.snapshot_date.desc())
        .limit(1)
    )
    net_worth_row = net_worth_result.first()
    starting_balance = round(float(net_worth_row[0]), 2) if net_worth_row else 0.0
    # Anchor at the snapshot's own month (in case it lags a day or two behind "today")
    # rather than assuming today's snapshot has already run.
    balance_anchor_month = net_worth_row[1].replace(day=1) if net_worth_row else today_month_start

    months: list[MonthSummary] = []
    running: Optional[float] = None
    cursor = start
    while cursor <= end:
        m = _month_str(cursor)
        is_past = cursor < today_month_start
        is_anchor = cursor == balance_anchor_month
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

        income = round(income_by_month.get(m, 0.0), 2)
        loan_disbursed = round(loan_disbursed_by_month.get(m, 0.0), 2)
        loan_paid = round(loan_paid_by_month.get(m, 0.0), 2)

        net_change: Optional[float] = None
        if is_anchor:
            running = starting_balance
        elif not is_past:
            expense = total_planned
            net_change = round(income + loan_disbursed - expense - loan_paid, 2)
            if running is not None:
                running = round(running + net_change, 2)

        months.append(MonthSummary(
            month=m,
            is_past=is_past,
            lines=lines,
            total_planned=round(total_planned, 2),
            total_actual=round(total_actual, 2) if (any_actual or is_past) else None,
            income=income,
            loan_disbursed=loan_disbursed,
            loan_paid=loan_paid,
            net_change=net_change,
            running_balance=running if not is_past else None,
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

    return MbaSummary(
        months=months,
        loans=loan_summaries,
        starting_balance=starting_balance,
        starting_balance_month=_month_str(balance_anchor_month),
    )
