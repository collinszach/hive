"""Admin API — data deletion, retention management, compliance, and user management."""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import _get_bearer_token, decode_token, _write_audit
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


class DataDeletionRequest(BaseModel):
    confirm: str  # must be "DELETE ALL MY DATA"
    purge_audit_logs: bool = False


@router.post("/purge-data")
async def purge_all_data(
    body: DataDeletionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Permanently delete all financial data (transactions, accounts, budgets, plaid links).
    Implements the data deletion right under the privacy policy.
    User model and audit logs are preserved unless explicitly requested.
    """
    token = _get_bearer_token(request)
    payload = decode_token(token)
    if payload.get("role") != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin required")

    if body.confirm != "DELETE ALL MY DATA":
        raise HTTPException(
            status_code=400,
            detail='Confirm by setting confirm="DELETE ALL MY DATA"',
        )

    # Delete in dependency order
    tables = [
        "points_ledger",
        "points_balances",
        "anomalies",
        "net_worth_snapshots",
        "transactions",
        "accounts",
        "budgets",
        "earn_rules",
        "plaid_links",
    ]
    for table in tables:
        try:
            await db.execute(text(f"DELETE FROM {table}"))  # noqa: S608
        except Exception:
            pass  # table may not exist yet

    if body.purge_audit_logs:
        await db.execute(delete(AuditLog))

    await db.commit()
    await _write_audit(db, "data_purge", payload["sub"], request, "All financial data deleted")
    logger.warning("All financial data purged by %s", payload["sub"])
    return {"status": "ok", "message": "All financial data deleted. Plaid links must be re-connected."}


@router.delete("/transactions/old")
async def delete_old_transactions(
    months: int = 24,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Delete transactions older than N months (default 24).
    Implements the data retention policy — data is not kept indefinitely.
    """
    token = _get_bearer_token(request)
    payload = decode_token(token)
    if payload.get("role") != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin required")

    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 30)
    result = await db.execute(
        text("DELETE FROM transactions WHERE date < :cutoff RETURNING id"),  # noqa: S608
        {"cutoff": cutoff.date()},
    )
    deleted = len(result.fetchall())
    await db.commit()
    await _write_audit(
        db, "data_retention_purge", payload["sub"], request,
        f"Deleted {deleted} transactions older than {months} months"
    )
    return {"status": "ok", "deleted_count": deleted, "cutoff_date": cutoff.date().isoformat()}


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

class UserSummary(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    plan: str
    stripe_status: Optional[str]
    is_active: bool
    last_login_at: Optional[datetime]
    created_at: datetime
    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    plan: Optional[str] = None     # "free", "starter", "pro"
    role: Optional[str] = None     # "admin", "viewer"
    is_active: Optional[bool] = None


@router.get("/users", response_model=list[UserSummary])
async def list_users(
    request: Request, db: AsyncSession = Depends(get_db)
) -> list[UserSummary]:
    """List all users (admin only)."""
    token = _get_bearer_token(request)
    payload = decode_token(token)
    if payload.get("role") != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin required")
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return [UserSummary.model_validate(u) for u in users]


@router.patch("/users/{user_id}", response_model=UserSummary)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserSummary:
    """Update a user's plan, role, or active status (admin only)."""
    token = _get_bearer_token(request)
    payload = decode_token(token)
    if payload.get("role") != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin required")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if body.plan is not None:
        if body.plan not in ("free", "starter", "pro"):
            raise HTTPException(400, "Invalid plan")
        user.plan = body.plan
    if body.role is not None:
        if body.role not in ("admin", "viewer"):
            raise HTTPException(400, "Invalid role")
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    await db.commit()
    await db.refresh(user)
    return UserSummary.model_validate(user)
