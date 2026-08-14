"""Monthly financial review API."""
from __future__ import annotations
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.spend import net_spend_expr
from app.db import get_db
from app.models.budget import Budget
from app.models.net_worth import NetWorthSnapshot
from app.models.points_balance import PointsBalance
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/review", tags=["review"])

# cents-per-point → dollar value per point
_CPP: dict[str, float] = {
    "Amex MR": 2.0 / 100,
    "Chase UR": 2.05 / 100,
    "SW RR": 1.4 / 100,
    "Bilt Points": 2.1 / 100,
    "Capital One Miles": 1.85 / 100,
}


class SpendDelta(BaseModel):
    category: str
    this_month: float
    last_month: float
    delta: float
    delta_pct: float


class ProgramPoints(BaseModel):
    program: str
    points_earned: float
    estimated_value: float


class MonthlyReview(BaseModel):
    month: str
    net_worth_end: Optional[float]
    net_worth_start: Optional[float]
    net_worth_delta: Optional[float]
    total_income: float
    total_spend: float
    budget_categories_over: int
    budget_categories_under: int
    top_spend_changes: list[SpendDelta]
    points_earned: list[ProgramPoints]
    uncategorized_count: int
    transaction_count: int


@router.get("/monthly", response_model=MonthlyReview)
async def get_monthly_review(
    month: str = Query(..., description="YYYY-MM, e.g. 2026-04"),
    db: AsyncSession = Depends(get_db),
) -> MonthlyReview:
    # Parse month boundaries
    try:
        year, mon = int(month[:4]), int(month[5:7])
    except (ValueError, IndexError):
        raise HTTPException(400, "month must be YYYY-MM format")

    month_start = date(year, mon, 1)
    next_month_start = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)

    prev_year, prev_mon = (year - 1, 12) if mon == 1 else (year, mon - 1)
    prev_month_start = date(prev_year, prev_mon, 1)

    # ── Spend this month by category ──
    spend_q = await db.execute(
        select(Transaction.category, func.sum(net_spend_expr()).label("total"))
        .where(
            Transaction.date >= month_start,
            Transaction.date < next_month_start,
            Transaction.is_excluded.is_(False),
            Transaction.is_transfer.is_(False),
            Transaction.pending.is_(False),
            Transaction.amount > 0,
        )
        .group_by(Transaction.category)
    )
    spend_this: dict[str, float] = {r.category or "Uncategorized": float(r.total) for r in spend_q}

    # ── Spend last month by category ──
    spend_prev_q = await db.execute(
        select(Transaction.category, func.sum(net_spend_expr()).label("total"))
        .where(
            Transaction.date >= prev_month_start,
            Transaction.date < month_start,
            Transaction.is_excluded.is_(False),
            Transaction.is_transfer.is_(False),
            Transaction.pending.is_(False),
            Transaction.amount > 0,
        )
        .group_by(Transaction.category)
    )
    spend_prev: dict[str, float] = {r.category or "Uncategorized": float(r.total) for r in spend_prev_q}

    # ── Income this month — only transactions categorized as Income ──
    income_q = await db.execute(
        select(func.sum(Transaction.amount))
        .where(
            Transaction.date >= month_start,
            Transaction.date < next_month_start,
            Transaction.category == "Income",
            Transaction.amount < 0,
        )
    )
    total_income = abs(float(income_q.scalar_one_or_none() or 0.0))
    total_spend = sum(spend_this.values())

    # ── Budget performance ──
    budget_q = await db.execute(
        select(Budget).where(Budget.month == month_start)
    )
    budgets = budget_q.scalars().all()
    categories_over  = sum(1 for b in budgets if spend_this.get(b.category, 0) > float(b.budget_amount))
    categories_under = sum(1 for b in budgets if spend_this.get(b.category, 0) <= float(b.budget_amount))

    # ── Top spend changes ──
    all_cats = set(spend_this) | set(spend_prev)
    deltas: list[SpendDelta] = []
    for cat in all_cats:
        this = spend_this.get(cat, 0.0)
        prev = spend_prev.get(cat, 0.0)
        delta = this - prev
        delta_pct = ((this - prev) / prev * 100) if prev > 0 else 100.0
        deltas.append(SpendDelta(
            category=cat, this_month=round(this, 2), last_month=round(prev, 2),
            delta=round(delta, 2), delta_pct=round(delta_pct, 1),
        ))
    deltas.sort(key=lambda d: abs(d.delta), reverse=True)

    # ── Net worth delta ──
    nw_q = await db.execute(
        select(NetWorthSnapshot.net_worth, NetWorthSnapshot.snapshot_date)
        .where(NetWorthSnapshot.snapshot_date >= prev_month_start)
        .where(NetWorthSnapshot.snapshot_date < next_month_start)
        .order_by(NetWorthSnapshot.snapshot_date)
    )
    snapshots = nw_q.all()
    nw_start = float(snapshots[0].net_worth) if snapshots else None
    nw_end   = float(snapshots[-1].net_worth) if snapshots else None
    nw_delta = round(nw_end - nw_start, 2) if (nw_start is not None and nw_end is not None) else None

    # ── Points balances (most recent per program) ──
    points_q = await db.execute(
        select(PointsBalance.program, func.sum(PointsBalance.balance).label("total_balance"))
        .group_by(PointsBalance.program)
        .order_by(func.sum(PointsBalance.balance).desc())
    )
    points_list = [
        ProgramPoints(
            program=r.program,
            points_earned=float(r.total_balance),
            estimated_value=round(float(r.total_balance) * _CPP.get(r.program, 0.01), 2),
        )
        for r in points_q
    ]

    # ── Uncategorized count ──
    uncat_q = await db.execute(
        select(func.count()).select_from(Transaction).where(
            Transaction.date >= month_start,
            Transaction.date < next_month_start,
            Transaction.category == "Uncategorized",
        )
    )
    uncat_count = int(uncat_q.scalar_one_or_none() or 0)

    # ── Total transaction count ──
    txn_count_q = await db.execute(
        select(func.count()).select_from(Transaction).where(
            Transaction.date >= month_start,
            Transaction.date < next_month_start,
            Transaction.is_excluded.is_(False),
        )
    )
    txn_count = int(txn_count_q.scalar_one_or_none() or 0)

    return MonthlyReview(
        month=month,
        net_worth_end=nw_end,
        net_worth_start=nw_start,
        net_worth_delta=nw_delta,
        total_income=round(total_income, 2),
        total_spend=round(total_spend, 2),
        budget_categories_over=categories_over,
        budget_categories_under=categories_under,
        top_spend_changes=deltas[:5],
        points_earned=points_list,
        uncategorized_count=uncat_count,
        transaction_count=txn_count,
    )
