"""Push-notification device registration API.

The iOS app POSTs its APNs device token here after the user grants permission, and
DELETEs it on sign-out / permission revocation. Tokens are unique; re-registration
upserts in place and reactivates a previously-deactivated token.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import _get_bearer_token, decode_token
from app.db import get_db
from app.models.device_token import DeviceToken
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


async def _get_user(request: Request, db: AsyncSession) -> User:
    token = _get_bearer_token(request)
    payload = decode_token(token)
    result = await db.execute(select(User).where(User.username == payload.get("sub")))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


class DeviceTokenRequest(BaseModel):
    token: str = Field(min_length=8, max_length=512)
    is_sandbox: bool = True
    platform: str = "ios"


@router.post("/device-token", status_code=204)
async def register_device_token(
    body: DeviceTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _get_user(request, db)
    result = await db.execute(
        select(DeviceToken).where(DeviceToken.token == body.token)
    )
    existing = result.scalar_one_or_none()
    if existing:
        # Token may have moved to a different user (device handoff) or come back to life.
        existing.user_id = user.id
        existing.is_sandbox = body.is_sandbox
        existing.platform = body.platform
        existing.is_active = True
        existing.last_seen_at = datetime.now(timezone.utc)
    else:
        db.add(
            DeviceToken(
                user_id=user.id,
                token=body.token,
                is_sandbox=body.is_sandbox,
                platform=body.platform,
            )
        )
    await db.commit()
    logger.info("Registered device token %s… for user %s", body.token[:8], user.username)


@router.delete("/device-token", status_code=204)
async def unregister_device_token(
    body: DeviceTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _get_user(request, db)
    result = await db.execute(
        select(DeviceToken).where(
            DeviceToken.token == body.token, DeviceToken.user_id == user.id
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.is_active = False
        await db.commit()
        logger.info("Unregistered device token %s… for user %s", body.token[:8], user.username)
