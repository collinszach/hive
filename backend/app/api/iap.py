"""Apple StoreKit 2 in-app purchase API.

Two endpoints, parallel to the Stripe paths in `billing.py`:

* ``POST /api/iap/apple/verify`` — the iOS app calls this after a purchase or on
  launch with a StoreKit 2 signed transaction JWS. We verify the signature with
  Apple's root certs, map the product to a plan tier, and update the user's
  entitlement. Authenticated.

* ``POST /api/iap/apple/notifications`` — Apple's App Store Server Notifications V2
  webhook. Unauthenticated (Apple signs the payload); we look the user up by the
  original transaction id and apply renew / expire / refund / revoke events.

Entitlement writes set ``plan_source="apple"`` so a later Stripe webhook for the same
user (or vice-versa) is an explicit, visible source switch rather than a silent
clobber.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import _get_bearer_token, decode_token
from app.db import get_db
from app.iap.apple import apple_verifier, ms_to_datetime, product_to_tier
from app.models.user import PlanTier, User, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/iap", tags=["iap"])

# Notification types that END an entitlement → drop to free.
_DOWNGRADE_TYPES = {"EXPIRED", "GRACE_PERIOD_EXPIRED", "REFUND", "REVOKE"}
# Notification types that (re)grant or extend an entitlement.
_UPGRADE_TYPES = {
    "SUBSCRIBED",
    "DID_RENEW",
    "OFFER_REDEEMED",
    "RESUBSCRIBE",
    "DID_CHANGE_RENEWAL_PREF",
}


class AppleVerifyRequest(BaseModel):
    # StoreKit 2 Transaction.jwsRepresentation
    jws: str


class AppleNotificationRequest(BaseModel):
    # App Store Server Notifications V2 body: {"signedPayload": "<JWS>"}
    signedPayload: str


async def _get_user(request: Request, db: AsyncSession) -> User:
    token = _get_bearer_token(request)
    payload = decode_token(token)
    result = await db.execute(select(User).where(User.username == payload.get("sub")))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _is_active(expires: datetime | None, revoked: datetime | None) -> bool:
    """A transaction grants access only if it isn't revoked and not yet expired."""
    if revoked is not None:
        return False
    if expires is None:
        return True  # non-consumable / lifetime
    return expires > datetime.now(timezone.utc)


def _apply_transaction(user: User, txn) -> None:
    """Write a verified transaction's entitlement onto the user."""
    expires = ms_to_datetime(getattr(txn, "expires_date", None))
    revoked = ms_to_datetime(getattr(txn, "revocation_date", None))
    original_id = getattr(txn, "original_transaction_id", None)
    product_id = getattr(txn, "product_id", None)

    user.apple_original_transaction_id = original_id
    user.plan_source = "apple"
    user.plan_period_end = expires
    if _is_active(expires, revoked):
        user.plan = product_to_tier(product_id)
        user.stripe_status = "active"
    else:
        user.plan = PlanTier.free
        user.stripe_status = "expired"


def _status_payload(user: User) -> dict:
    return {
        "plan": user.plan,
        "plan_source": user.plan_source,
        "status": user.stripe_status,
        "period_end": user.plan_period_end.isoformat() if user.plan_period_end else None,
        "claude_enabled": user.role == UserRole.admin or user.plan == PlanTier.pro,
        "snaptrade_enabled": user.role == UserRole.admin or user.plan == PlanTier.pro,
    }


@router.post("/apple/verify")
async def apple_verify(
    body: AppleVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(request, db)
    if not apple_verifier.configured:
        raise HTTPException(503, "Apple IAP is not configured on the server.")
    try:
        txn = apple_verifier.verify_transaction(body.jws)
    except Exception as exc:  # VerificationException or malformed input
        logger.warning("Apple transaction verification failed: %s", exc)
        raise HTTPException(400, "Could not verify the App Store transaction.")

    _apply_transaction(user, txn)
    await db.commit()
    logger.info(
        "Apple IAP: user %s → plan %s (orig txn %s)",
        user.username,
        user.plan,
        user.apple_original_transaction_id,
    )
    return _status_payload(user)


@router.post("/apple/notifications")
async def apple_notifications(
    body: AppleNotificationRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not apple_verifier.configured:
        # Acknowledge so Apple doesn't hammer retries while we're misconfigured.
        logger.error("Apple IAP notification received but verifier not configured")
        return {"received": True}
    try:
        notification = apple_verifier.verify_notification(body.signedPayload)
    except Exception as exc:
        logger.warning("Apple notification verification failed: %s", exc)
        raise HTTPException(400, "Invalid signed payload")

    notif_type = str(getattr(notification, "notification_type", "") or "")
    data = getattr(notification, "data", None)
    signed_txn_info = getattr(data, "signed_transaction_info", None) if data else None
    if not signed_txn_info:
        logger.info("Apple notification %s without transaction info; ignoring", notif_type)
        return {"received": True}

    try:
        txn = apple_verifier.verify_transaction(signed_txn_info)
    except Exception as exc:
        logger.warning("Apple notification txn verification failed: %s", exc)
        raise HTTPException(400, "Invalid transaction info")

    original_id = getattr(txn, "original_transaction_id", None)
    if not original_id:
        return {"received": True}

    result = await db.execute(
        select(User).where(User.apple_original_transaction_id == original_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        logger.info("Apple notification for unknown original txn %s", original_id)
        return {"received": True}

    if notif_type in _DOWNGRADE_TYPES:
        user.plan = PlanTier.free
        user.stripe_status = notif_type.lower()
        user.plan_period_end = ms_to_datetime(getattr(txn, "revocation_date", None)) or user.plan_period_end
    elif notif_type in _UPGRADE_TYPES:
        _apply_transaction(user, txn)
    else:
        # DID_CHANGE_RENEWAL_STATUS, TEST, etc. — no entitlement change.
        logger.info("Apple notification %s: no entitlement change", notif_type)
        return {"received": True}

    await db.commit()
    logger.info("Apple notification %s applied → user %s plan %s", notif_type, user.username, user.plan)
    return {"received": True}
