"""Internal auth endpoint — called by the Next.js credentials provider."""
import logging
from datetime import datetime, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

# No verify_auth dependency here — this endpoint IS the auth gate.
# It is protected by INTERNAL_API_TOKEN at the nginx/proxy level instead:
# the Next.js proxy forwards requests with the internal token, so only
# the Next.js server (not the public internet) can call this endpoint.
router = APIRouter(prefix="/api/auth-internal", tags=["auth"])


class VerifyRequest(BaseModel):
    username: str
    password: str


class VerifyResponse(BaseModel):
    id: str
    username: str


@router.post("/verify", response_model=VerifyResponse)
async def verify_credentials(
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> VerifyResponse:
    """Verify username + password. Returns user info on success, 401 on failure.

    Called exclusively by the Next.js credentials provider via the internal proxy.
    Timing-safe: always runs bcrypt.checkpw even on unknown usernames to prevent
    user enumeration via response time differences.
    """
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()

    # Always check against a real hash — prevents timing-based user enumeration
    hash_to_check = user.password_hash if user else bcrypt.hashpw(b"dummy", bcrypt.gensalt()).decode()
    password_ok = bcrypt.checkpw(body.password.encode(), hash_to_check.encode())

    if not user or not user.is_active or not password_ok:
        logger.warning("Failed login attempt for username='%s'", body.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Update last_login_at
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    await db.commit()

    logger.info("Successful login for user '%s'", user.username)
    return VerifyResponse(id=str(user.id), username=user.username)
