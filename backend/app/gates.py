"""Feature gates — plan-based access control for Plaid, Claude, and SnapTrade."""
import logging

from fastapi import Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import _get_bearer_token, decode_token
from app.db import get_db
from app.models.user import PlanTier, User, UserRole

logger = logging.getLogger(__name__)

async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    """FastAPI dependency: extract authenticated user from JWT. Use in any endpoint that needs user scoping."""
    return await _get_request_user(request, db)


PLAID_LIMITS: dict[str, int] = {
    PlanTier.free: 0,
    PlanTier.starter: 3,
    PlanTier.pro: 10,
}


async def _get_request_user(request: Request, db: AsyncSession) -> User:
    """Extract and validate user from JWT cookie or Bearer header, return User ORM object."""
    token = _get_bearer_token(request)
    payload = decode_token(token)
    username = payload.get("sub")
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_plaid(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    """Require starter/pro plan or admin role to use Plaid bank connections."""
    user = await _get_request_user(request, db)
    if user.role == UserRole.admin:
        return user
    if user.plan not in (PlanTier.starter, PlanTier.pro):
        raise HTTPException(
            status_code=402,
            detail={"message": "Plaid bank sync requires Starter or Pro plan.", "gate": "plaid"},
        )
    return user


async def require_claude(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    """Require pro plan or admin role to use Claude AI."""
    user = await _get_request_user(request, db)
    if user.role == UserRole.admin:
        return user
    if user.plan != PlanTier.pro:
        raise HTTPException(
            status_code=402,
            detail={"message": "Claude AI chat requires Pro plan.", "gate": "claude"},
        )
    return user


async def require_snaptrade(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    """Require pro plan or admin role to use SnapTrade investment tracking."""
    user = await _get_request_user(request, db)
    if user.role == UserRole.admin:
        return user
    if user.plan != PlanTier.pro:
        raise HTTPException(
            status_code=402,
            detail={"message": "Investment account tracking requires Pro plan.", "gate": "snaptrade"},
        )
    return user


async def check_plaid_limit(user: User, db: AsyncSession) -> None:
    """Enforce per-plan Plaid connection count. Call after require_plaid."""
    if user.role == UserRole.admin:
        return
    limit = PLAID_LIMITS.get(user.plan, 0)
    from app.models.plaid_link import PlaidLink

    count = await db.scalar(
        select(func.count()).select_from(PlaidLink).where(PlaidLink.is_active == True)  # noqa: E712
    ) or 0
    if count >= limit:
        raise HTTPException(
            status_code=402,
            detail={
                "message": f"You've reached your limit of {limit} Plaid connections on the {user.plan} plan.",
                "gate": "plaid_limit",
                "limit": limit,
                "used": count,
            },
        )
