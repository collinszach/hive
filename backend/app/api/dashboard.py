"""Dashboard summary API — combined data for the main dashboard."""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.account import Account
from app.models.anomaly import Anomaly
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class AccountSummary(BaseModel):
    id: str
    name: str
    type: str
    current_balance: Optional[float]
    card_slug: Optional[str]


class CategorySpend(BaseModel):
    category: str
    total: float


class AnomalySummary(BaseModel):
    count: int
    latest_reason: Optional[str]


class DashboardSummary(BaseModel):
    month: str
    total_spend: float
    top_categories: list[CategorySpend]
    accounts: list[AccountSummary]
    unreviewed_anomalies: AnomalySummary


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    month: Optional[str] = Query(None, description="YYYY-MM, defaults to current month"),
    db: AsyncSession = Depends(get_db),
) -> DashboardSummary:
    """
    Combined dashboard data: spend totals, account balances, anomaly count.
    """
    if month is None:
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

    year, mo = int(month[:4]), int(month[5:7])
    start = date(year, mo, 1)
    end = date(year + 1, 1, 1) if mo == 12 else date(year, mo + 1, 1)

    # Spending by category
    spend_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount))
        .where(
            and_(
                Transaction.date >= start,
                Transaction.date < end,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.amount > 0,
            )
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    )
    spend_rows = spend_result.all()
    total_spend = sum(float(r[1]) for r in spend_rows if r[0] is not None)
    top_categories = [
        CategorySpend(category=r[0], total=round(float(r[1]), 2))
        for r in spend_rows
        if r[0] is not None
    ][:8]

    # Accounts
    acct_result = await db.execute(
        select(Account).where(Account.is_active == True)  # noqa: E712
    )
    accounts = [
        AccountSummary(
            id=str(a.id),
            name=a.name,
            type=a.type,
            current_balance=float(a.current_balance) if a.current_balance is not None else None,
            card_slug=a.card_slug,
        )
        for a in acct_result.scalars().all()
    ]

    # Unreviewed anomalies
    anomaly_result = await db.execute(
        select(Anomaly).where(Anomaly.status == "unreviewed").order_by(Anomaly.flagged_at.desc()).limit(1)
    )
    count_result = await db.execute(
        select(func.count()).select_from(Anomaly).where(Anomaly.status == "unreviewed")
    )
    anomaly_count = count_result.scalar_one()
    latest_anomaly = anomaly_result.scalar_one_or_none()

    return DashboardSummary(
        month=month,
        total_spend=round(total_spend, 2),
        top_categories=top_categories,
        accounts=accounts,
        unreviewed_anomalies=AnomalySummary(
            count=anomaly_count,
            latest_reason=latest_anomaly.reason if latest_anomaly else None,
        ),
    )
