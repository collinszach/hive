"""SnapTrade API — connect flow and callback handling."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.gates import require_snaptrade
from app.models.account import Account
from app.models.user import User
from app.snaptrade.connector import get_connector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/snaptrade", tags=["snaptrade"])


class ConnectResponse(BaseModel):
    redirect_url: str


class CallbackResponse(BaseModel):
    accounts_added: int


@router.post("/connect", response_model=ConnectResponse)
async def snaptrade_connect(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> ConnectResponse:
    """
    Register this user with SnapTrade (if needed) and return an OAuth redirect URL.
    The frontend redirects the browser to this URL so the user can connect their brokerage.
    """
    connector = get_connector()
    if connector is None:
        raise HTTPException(status_code=503, detail="SnapTrade not configured")

    from app.config import settings

    # Register with SnapTrade if first time
    # Use a stable fixed ID (not DB UUID) so it survives user table changes
    stable_id = f"hive-{settings.snaptrade_client_id[:8]}"
    if not user.snaptrade_user_id:
        snap_uid, snap_secret = connector.register_user(stable_id)
        user.snaptrade_user_id = snap_uid
        user.snaptrade_user_secret = snap_secret  # EncryptedString handles encryption
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("Registered SnapTrade user: %s", snap_uid)

    redirect_uri = f"{settings.app_base_url}/connect"
    url = connector.get_connect_url(
        snaptrade_user_id=user.snaptrade_user_id,
        user_secret=user.snaptrade_user_secret,
        redirect_uri=redirect_uri,
    )
    return ConnectResponse(redirect_url=url)


@router.get("/callback", response_model=CallbackResponse)
async def snaptrade_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> CallbackResponse:
    """
    Called by the frontend after SnapTrade redirects back with ?snaptrade_connected=1.
    Fetches all accounts from SnapTrade and upserts them into the accounts table.
    """
    connector = get_connector()
    if connector is None:
        raise HTTPException(status_code=503, detail="SnapTrade not configured")
    if not user.snaptrade_user_id:
        raise HTTPException(status_code=400, detail="SnapTrade not connected for this user")

    snaptrade_accounts = connector.get_accounts(
        snaptrade_user_id=user.snaptrade_user_id,
        user_secret=user.snaptrade_user_secret,
    )

    added = 0
    for acct in snaptrade_accounts:
        # Upsert: find existing or create new
        result = await db.execute(
            select(Account).where(Account.snaptrade_account_id == acct["id"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.current_balance = acct["balance"]
            existing.last_synced = datetime.now(timezone.utc)
            db.add(existing)
        else:
            new_acct = Account(
                snaptrade_account_id=acct["id"],
                name=acct["name"],
                official_name=acct["name"],
                institution=acct["institution"],
                type="investment",
                subtype="brokerage",
                current_balance=acct["balance"],
                available_balance=acct["balance"],
                currency="USD",
                user_id=user.id,
                is_manual=False,
                is_active=True,
                last_synced=datetime.now(timezone.utc),
            )
            db.add(new_acct)
            added += 1

    await db.commit()
    logger.info("snaptrade_callback: added=%d total=%d", added, len(snaptrade_accounts))

    # Update net worth snapshot with new account balances
    from app.tasks.maintenance import snapshot_net_worth
    snapshot_net_worth.delay()

    return CallbackResponse(accounts_added=added)
