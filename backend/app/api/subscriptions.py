"""Subscription tracker API."""
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.subscription import Subscription

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


class SubscriptionUpdate(BaseModel):
    merchant_name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
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
