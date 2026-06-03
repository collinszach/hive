"""SnapTrade API — connect flow and callback handling."""
import logging
from datetime import datetime, timezone
from typing import Optional

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


class PositionOut(BaseModel):
    symbol: Optional[str]
    description: Optional[str]
    units: Optional[float]
    price: Optional[float]
    market_value: Optional[float]
    open_pnl: Optional[float]
    avg_price: Optional[float]
    currency: Optional[str]
    type: Optional[str]


class OrderOut(BaseModel):
    action: Optional[str]
    status: Optional[str]
    symbol: Optional[str]
    description: Optional[str]
    quantity: Optional[float]
    filled_quantity: Optional[float]
    price: Optional[float]
    order_type: Optional[str]
    placed_at: Optional[str]
    executed_at: Optional[str]
    currency: Optional[str]


class HoldingsOut(BaseModel):
    total_value: Optional[float]
    currency: Optional[str]
    positions: list[PositionOut]
    orders: list[OrderOut]


class PortfolioPositionOut(PositionOut):
    """A position merged across all accounts, with its portfolio weight."""
    weight_pct: float


class PortfolioOut(BaseModel):
    """Aggregated view across every connected investment account."""
    total_value: float
    total_cost_basis: float
    total_unrealized_pnl: float
    total_return_pct: Optional[float]
    currency: str
    account_count: int
    positions: list[PortfolioPositionOut]
    recent_orders: list[OrderOut]


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


@router.get("/accounts/{snaptrade_account_id}/holdings", response_model=HoldingsOut)
async def snaptrade_holdings(
    snaptrade_account_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> HoldingsOut:
    """Return positions and recent orders for one connected SnapTrade account.

    Ownership is enforced: the account must belong to the current user.
    """
    connector = get_connector()
    if connector is None:
        raise HTTPException(status_code=503, detail="SnapTrade not configured")
    if not user.snaptrade_user_id:
        raise HTTPException(status_code=400, detail="SnapTrade not connected for this user")

    # Verify the account exists and is owned by this user before hitting SnapTrade.
    result = await db.execute(
        select(Account).where(
            Account.snaptrade_account_id == snaptrade_account_id,
            Account.user_id == user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        holdings = connector.get_holdings(
            snaptrade_user_id=user.snaptrade_user_id,
            user_secret=user.snaptrade_user_secret,
            account_id=snaptrade_account_id,
        )
    except Exception as exc:
        logger.warning("SnapTrade get_holdings failed for %s: %s", snaptrade_account_id, exc)
        raise HTTPException(status_code=502, detail="Could not load holdings from SnapTrade")

    return HoldingsOut(
        total_value=holdings["total_value"],
        currency=holdings["currency"],
        positions=[PositionOut(**p) for p in holdings["positions"] if p],
        orders=[OrderOut(**o) for o in holdings["orders"] if o],
    )


@router.get("/portfolio", response_model=PortfolioOut)
async def snaptrade_portfolio(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_snaptrade),
) -> PortfolioOut:
    """Aggregate holdings across ALL of the user's connected investment accounts.

    Positions are merged by symbol (units, market value, and unrealized P&L summed); cost
    basis is derived as market value − unrealized P&L. One call backs the Investments screen
    and the Home pulse, so the client doesn't fan out per account.
    """
    connector = get_connector()
    if connector is None:
        raise HTTPException(status_code=503, detail="SnapTrade not configured")
    if not user.snaptrade_user_id:
        raise HTTPException(status_code=400, detail="SnapTrade not connected for this user")

    accounts = (await db.execute(
        select(Account).where(
            Account.user_id == user.id,
            Account.snaptrade_account_id.isnot(None),
            Account.is_active == True,  # noqa: E712
        )
    )).scalars().all()

    merged: dict[str, dict] = {}
    orders_all: list[dict] = []
    currency = "USD"

    for acct in accounts:
        try:
            h = connector.get_holdings(
                snaptrade_user_id=user.snaptrade_user_id,
                user_secret=user.snaptrade_user_secret,
                account_id=acct.snaptrade_account_id,
            )
        except Exception as exc:
            logger.warning("Portfolio: holdings failed for %s: %s", acct.snaptrade_account_id, exc)
            continue
        currency = h.get("currency") or currency
        for p in h.get("positions") or []:
            if not p:
                continue
            key = p.get("symbol") or p.get("description") or "—"
            m = merged.get(key)
            if m is None:
                m = {
                    "symbol": p.get("symbol"), "description": p.get("description"),
                    "units": 0.0, "price": p.get("price"), "market_value": 0.0,
                    "open_pnl": 0.0, "avg_price": p.get("avg_price"),
                    "currency": p.get("currency"), "type": p.get("type"),
                }
                merged[key] = m
            m["units"] = (m["units"] or 0) + (p.get("units") or 0)
            m["market_value"] = (m["market_value"] or 0) + (p.get("market_value") or 0)
            m["open_pnl"] = (m["open_pnl"] or 0) + (p.get("open_pnl") or 0)
        for o in h.get("orders") or []:
            if o:
                orders_all.append(o)

    total_value = round(sum(m["market_value"] for m in merged.values()), 2)
    total_pnl = round(sum(m["open_pnl"] for m in merged.values()), 2)
    total_cost = round(total_value - total_pnl, 2)
    total_return_pct = round(total_pnl / total_cost * 100, 2) if total_cost > 0 else None

    positions = [
        PortfolioPositionOut(
            **m,
            weight_pct=round(m["market_value"] / total_value * 100, 2) if total_value > 0 else 0.0,
        )
        for m in merged.values()
    ]
    positions.sort(key=lambda p: p.market_value or 0, reverse=True)

    orders_all.sort(key=lambda o: o.get("placed_at") or "", reverse=True)
    recent_orders = [OrderOut(**o) for o in orders_all[:10]]

    return PortfolioOut(
        total_value=total_value,
        total_cost_basis=total_cost,
        total_unrealized_pnl=total_pnl,
        total_return_pct=total_return_pct,
        currency=currency,
        account_count=len(accounts),
        positions=positions,
        recent_orders=recent_orders,
    )
