"""Subscription tracker API."""
import uuid
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.subscription import Subscription

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


class SubscriptionCreate(BaseModel):
    merchant_name: str
    amount: float
    frequency: str = "monthly"  # weekly | monthly | quarterly | annual
    category: Optional[str] = None
    subcategory: Optional[str] = None


class SubscriptionUpdate(BaseModel):
    merchant_name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    is_cancelled: Optional[bool] = None


def _sub_out(s: Subscription) -> dict:
    return {
        "id": str(s.id),
        "merchant_name": s.merchant_name,
        "normalized_name": s.normalized_name,
        "amount": float(s.amount),
        "currency": s.currency,
        "frequency": s.frequency,
        "category": s.category,
        "subcategory": s.subcategory,
        "last_charged": s.last_charged.isoformat() if s.last_charged else None,
        "next_expected": s.next_expected.isoformat() if s.next_expected else None,
        "is_active": s.is_active,
        "is_cancelled": s.is_cancelled,
        "auto_detected": s.auto_detected,
        "previous_amount": float(s.previous_amount) if s.previous_amount is not None else None,
        "price_changed_at": s.price_changed_at.isoformat() if s.price_changed_at else None,
        "annual_cost": float(s.annual_cost) if s.annual_cost is not None else None,
        "charge_count": s.charge_count,
    }


@router.post("")
async def create_subscription(
    body: SubscriptionCreate,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Create a manual subscription entry."""
    freq_to_annual = {
        "weekly": body.amount * 52,
        "monthly": body.amount * 12,
        "quarterly": body.amount * 4,
        "annual": body.amount,
    }
    sub = Subscription(
        merchant_name=body.merchant_name,
        normalized_name=body.merchant_name.lower().strip(),
        amount=body.amount,
        currency="USD",
        frequency=body.frequency,
        category=body.category,
        subcategory=body.subcategory,
        is_active=True,
        is_cancelled=False,
        auto_detected=False,
        annual_cost=freq_to_annual.get(body.frequency, body.amount * 12),
        charge_count=0,
    )
    session.add(sub)
    await session.commit()
    await session.refresh(sub)
    logger.info("Manual subscription created: %s", sub.merchant_name)
    return _sub_out(sub)


@router.get("")
async def list_subscriptions(
    active_only: bool = True,
    session: AsyncSession = Depends(get_db),
) -> dict:
    q = select(Subscription).order_by(Subscription.annual_cost.desc().nullslast())
    if active_only:
        q = q.where(Subscription.is_active.is_(True), Subscription.is_cancelled.is_(False))
    result = await session.execute(q)
    subs = [_sub_out(s) for s in result.scalars()]

    total_monthly = sum(
        s["amount"] if s["frequency"] == "monthly" else
        s["amount"] / 12 if s["frequency"] == "annual" else
        s["amount"] / 3 if s["frequency"] == "quarterly" else
        s["amount"] * 4.33 if s["frequency"] == "weekly" else 0
        for s in subs
    )

    return {
        "subscriptions": subs,
        "total_monthly_cost": round(total_monthly, 2),
        "total_annual_cost": round(total_monthly * 12, 2),
        "count": len(subs),
    }


@router.put("/{sub_id}")
async def update_subscription(
    sub_id: str,
    body: SubscriptionUpdate,
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await session.execute(
        select(Subscription).where(Subscription.id == uuid.UUID(sub_id))
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "Subscription not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(sub, field, value)

    await session.commit()
    await session.refresh(sub)
    return _sub_out(sub)


@router.delete("/{sub_id}")
async def delete_subscription(
    sub_id: str,
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await session.execute(
        select(Subscription).where(Subscription.id == uuid.UUID(sub_id))
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "Subscription not found")

    await session.delete(sub)
    await session.commit()
    return {"deleted": sub_id}


@router.get("/upcoming")
async def upcoming_bills(
    days: int = Query(30, ge=1, le=90),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Return active subscriptions with a next_expected date within the next `days` days,
    ordered by next_expected ascending. Used by the Bills calendar page.
    """
    today = date.today()
    cutoff = today + timedelta(days=days)

    result = await session.execute(
        select(Subscription)
        .where(
            and_(
                Subscription.is_active == True,       # noqa: E712
                Subscription.is_cancelled == False,   # noqa: E712
                Subscription.next_expected.isnot(None),
                Subscription.next_expected >= today,
                Subscription.next_expected <= cutoff,
            )
        )
        .order_by(Subscription.next_expected.asc())
    )
    subs = result.scalars().all()

    today_str = today.isoformat()
    bills = []
    for s in subs:
        days_away = (s.next_expected - today).days
        status = "today" if days_away == 0 else ("soon" if days_away <= 7 else "upcoming")
        bills.append({
            **_sub_out(s),
            "days_away": days_away,
            "status": status,
            "is_today": days_away == 0,
            "is_this_week": days_away <= 7,
        })
    return bills


@router.post("/scan")
async def scan_subscriptions() -> dict:
    """
    Trigger an on-demand subscription detection scan via Celery.
    Returns the Celery task_id so the client can poll for completion.
    """
    from app.tasks.intelligence import detect_subscriptions
    task = detect_subscriptions.delay()
    logger.info("On-demand subscription scan triggered: task_id=%s", task.id)
    return {"task_id": task.id, "status": "queued"}
