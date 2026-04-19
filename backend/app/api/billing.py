"""Billing API — Stripe checkout, portal, webhook, and plan status."""
import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.gates import PLAID_LIMITS, _get_request_user
from app.models.plaid_link import PlaidLink
from app.models.user import PlanTier, User, UserRole

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    plan: str  # "starter" or "pro"
    return_url: str


class PortalRequest(BaseModel):
    return_url: str


@router.get("/status")
async def billing_status(
    request: Request, db: AsyncSession = Depends(get_db)
) -> dict:
    """Return current plan, Stripe status, and Plaid connection usage."""
    user = await _get_request_user(request, db)
    plaid_limit = None if user.role == UserRole.admin else PLAID_LIMITS.get(user.plan, 0)
    plaid_used = await db.scalar(
        select(func.count()).select_from(PlaidLink).where(PlaidLink.is_active == True)  # noqa: E712
    )
    return {
        "plan": user.plan,
        "role": user.role,
        "stripe_status": user.stripe_status,
        "period_end": user.plan_period_end.isoformat() if user.plan_period_end else None,
        "plaid_used": plaid_used,
        "plaid_limit": plaid_limit,
    }


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> dict:
    """Create a Stripe Checkout session for the given plan."""
    user = await _get_request_user(request, db)
    if user.role == UserRole.admin:
        raise HTTPException(400, "Admin accounts do not need a subscription")

    price_map = {
        "starter": settings.stripe_starter_price_id,
        "pro": settings.stripe_pro_price_id,
    }
    price_id = price_map.get(body.plan)
    if not price_id:
        raise HTTPException(400, "Invalid plan")

    stripe.api_key = settings.stripe_secret_key

    # Create or reuse Stripe customer
    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            metadata={"user_id": str(user.id), "username": user.username}
        )
        user.stripe_customer_id = customer.id
        await db.commit()

    session = stripe.checkout.Session.create(
        customer=user.stripe_customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=body.return_url + "?billing=success",
        cancel_url=body.return_url + "?billing=canceled",
    )
    return {"url": session.url}


@router.post("/portal")
async def billing_portal(
    body: PortalRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> dict:
    """Create a Stripe Billing Portal session for the current user."""
    user = await _get_request_user(request, db)
    if not user.stripe_customer_id:
        raise HTTPException(400, "No billing account found. Subscribe first.")
    stripe.api_key = settings.stripe_secret_key
    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=body.return_url,
    )
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request, db: AsyncSession = Depends(get_db)
) -> dict:
    """Handle Stripe webhook events to keep plan state in sync."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    stripe.api_key = settings.stripe_secret_key
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        logger.warning("Invalid Stripe webhook signature")
        raise HTTPException(400, "Invalid signature")

    et = event["type"]

    if et == "checkout.session.completed":
        session = event["data"]["object"]
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        if customer_id and subscription_id:
            sub = stripe.Subscription.retrieve(subscription_id)
            price_id = sub["items"]["data"][0]["price"]["id"]
            plan = "starter" if price_id == settings.stripe_starter_price_id else "pro"
            result = await db.execute(
                select(User).where(User.stripe_customer_id == customer_id)
            )
            user = result.scalar_one_or_none()
            if user:
                user.plan = plan
                user.stripe_subscription_id = subscription_id
                user.stripe_status = sub["status"]
                user.plan_period_end = datetime.fromtimestamp(
                    sub["current_period_end"], tz=timezone.utc
                )
                await db.commit()
                logger.info("Activated %s plan for customer %s", plan, customer_id)

    elif et == "customer.subscription.updated":
        sub = event["data"]["object"]
        customer_id = sub["customer"]
        price_id = sub["items"]["data"][0]["price"]["id"]
        plan = "starter" if price_id == settings.stripe_starter_price_id else "pro"
        result = await db.execute(
            select(User).where(User.stripe_customer_id == customer_id)
        )
        user = result.scalar_one_or_none()
        if user:
            user.plan = plan
            user.stripe_status = sub["status"]
            user.plan_period_end = datetime.fromtimestamp(
                sub["current_period_end"], tz=timezone.utc
            )
            await db.commit()
            logger.info("Updated plan to %s for customer %s", plan, customer_id)

    elif et == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = sub["customer"]
        result = await db.execute(
            select(User).where(User.stripe_customer_id == customer_id)
        )
        user = result.scalar_one_or_none()
        if user:
            user.plan = PlanTier.free
            user.stripe_status = "canceled"
            user.stripe_subscription_id = None
            await db.commit()
            logger.info("Canceled plan for customer %s — downgraded to free", customer_id)

    elif et == "invoice.payment_failed":
        invoice = event["data"]["object"]
        customer_id = invoice["customer"]
        result = await db.execute(
            select(User).where(User.stripe_customer_id == customer_id)
        )
        user = result.scalar_one_or_none()
        if user:
            user.stripe_status = "past_due"
            await db.commit()
            logger.warning("Payment failed for customer %s — marked past_due", customer_id)

    return {"received": True}
