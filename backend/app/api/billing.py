"""Stripe billing API — checkout, portal, webhook, status."""
import datetime
import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import _get_bearer_token, decode_token
from app.config import settings
from app.db import get_db
from app.models.plaid_link import PlaidLink
from app.models.user import PlanTier, User, UserRole

logger = logging.getLogger(__name__)
router = APIRouter(tags=["billing"])

PLAID_LIMITS = {PlanTier.free: 0, PlanTier.starter: 3, PlanTier.pro: 10}


async def _get_user(request: Request, db: AsyncSession) -> User:
    token = _get_bearer_token(request)
    payload = decode_token(token)
    result = await db.execute(select(User).where(User.username == payload.get("sub")))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _price_to_plan() -> dict[str, PlanTier]:
    return {
        settings.stripe_starter_price_id: PlanTier.starter,
        settings.stripe_pro_price_id: PlanTier.pro,
    }


class CheckoutRequest(BaseModel):
    plan: str  # "starter" | "pro"
    return_url: str = ""


class PortalRequest(BaseModel):
    return_url: str = ""


@router.get("/api/billing/status")
async def billing_status(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(request, db)
    result = await db.execute(
        select(func.count())
        .select_from(PlaidLink)
        .where(PlaidLink.is_active.is_(True))
    )
    plaid_used = result.scalar() or 0
    plaid_limit = 999 if user.role == UserRole.admin else PLAID_LIMITS.get(user.plan, 0)
    return {
        "plan": user.plan,
        "stripe_status": user.stripe_status,
        "period_end": user.plan_period_end.isoformat() if user.plan_period_end else None,
        "plaid_used": plaid_used,
        "plaid_limit": plaid_limit,
        "claude_enabled": user.role == UserRole.admin or user.plan == PlanTier.pro,
        "snaptrade_enabled": user.role == UserRole.admin or user.plan == PlanTier.pro,
    }


@router.post("/api/billing/checkout")
async def create_checkout(
    body: CheckoutRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    stripe.api_key = settings.stripe_secret_key
    user = await _get_user(request, db)
    if body.plan == "starter":
        price_id = settings.stripe_starter_price_id
    elif body.plan == "pro":
        price_id = settings.stripe_pro_price_id
    else:
        raise HTTPException(400, "Invalid plan. Must be 'starter' or 'pro'.")

    if not price_id:
        raise HTTPException(503, "Stripe price IDs not configured. Contact support.")

    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            metadata={"username": user.username}
        )
        user.stripe_customer_id = customer.id
        await db.commit()

    return_url = body.return_url or f"{settings.app_base_url}/billing"
    session = stripe.checkout.Session.create(
        customer=user.stripe_customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.app_base_url}/billing?success=true",
        cancel_url=return_url,
    )
    return {"url": session.url}


@router.post("/api/billing/portal")
async def billing_portal(
    body: PortalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    stripe.api_key = settings.stripe_secret_key
    user = await _get_user(request, db)
    if not user.stripe_customer_id:
        raise HTTPException(400, "No billing account found. Subscribe first.")
    return_url = body.return_url or f"{settings.app_base_url}/billing"
    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=return_url,
    )
    return {"url": session.url}


@router.post("/api/billing/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (stripe.error.SignatureVerificationError, ValueError) as e:
        logger.warning("Stripe webhook signature invalid: %s", e)
        raise HTTPException(400, "Invalid signature")

    price_map = _price_to_plan()

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        customer_id = session_obj.get("customer")
        sub_id = session_obj.get("subscription")
        result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        user = result.scalar_one_or_none()
        if user and sub_id:
            sub = stripe.Subscription.retrieve(sub_id)
            price_id = sub["items"]["data"][0]["price"]["id"]
            user.stripe_subscription_id = sub_id
            user.stripe_status = sub["status"]
            user.plan = price_map.get(price_id, PlanTier.free)
            if sub.get("current_period_end"):
                user.plan_period_end = datetime.datetime.fromtimestamp(
                    sub["current_period_end"], tz=datetime.timezone.utc
                )
            await db.commit()
            logger.info("Activated plan %s for customer %s", user.plan, customer_id)

    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        result = await db.execute(select(User).where(User.stripe_subscription_id == sub["id"]))
        user = result.scalar_one_or_none()
        if user:
            price_id = sub["items"]["data"][0]["price"]["id"]
            user.stripe_status = sub["status"]
            user.plan = price_map.get(price_id, PlanTier.free)
            if sub.get("current_period_end"):
                user.plan_period_end = datetime.datetime.fromtimestamp(
                    sub["current_period_end"], tz=datetime.timezone.utc
                )
            await db.commit()

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        result = await db.execute(select(User).where(User.stripe_subscription_id == sub["id"]))
        user = result.scalar_one_or_none()
        if user:
            user.plan = PlanTier.free
            user.stripe_status = "canceled"
            await db.commit()

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        user = result.scalar_one_or_none()
        if user:
            user.stripe_status = "past_due"
            await db.commit()

    return {"received": True}
