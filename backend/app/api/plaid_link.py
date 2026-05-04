"""Plaid Link API endpoints — link token creation and public token exchange."""
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.gates import check_plaid_limit, require_plaid
from app.models.account import Account
from app.models.plaid_link import PlaidLink
from app.models.user import User
from app.plaid.connector import plaid_connector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plaid", tags=["plaid"])


class LinkTokenResponse(BaseModel):
    link_token: str


class ExchangeTokenRequest(BaseModel):
    public_token: str
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None


class ExchangeTokenResponse(BaseModel):
    item_id: str
    accounts_created: int


@router.post("/link-token", response_model=LinkTokenResponse)
async def create_link_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_plaid),
) -> LinkTokenResponse:
    """Create a Plaid Link token to initialize the Link flow in the frontend."""
    try:
        # Use a fixed user_id for single-user self-hosted setup
        link_token = plaid_connector.get_link_token(user_id="local-user")
        return LinkTokenResponse(link_token=link_token)
    except Exception as exc:
        logger.error("Failed to create link token: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to create link token. Please try again.") from exc


class ReauthRequest(BaseModel):
    item_id: str


@router.post("/reauth-link-token", response_model=LinkTokenResponse)
async def create_reauth_link_token(
    body: ReauthRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_plaid),
) -> LinkTokenResponse:
    """Create a Plaid Link token in update mode to re-authorize an existing connection."""
    result = await db.execute(
        select(PlaidLink).where(PlaidLink.item_id == body.item_id, PlaidLink.is_active == True)  # noqa: E712
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Linked account not found")
    try:
        link_token = plaid_connector.get_update_link_token(
            user_id="local-user",
            access_token=link.access_token,
        )
        return LinkTokenResponse(link_token=link_token)
    except Exception as exc:
        logger.error("Failed to create reauth link token for item %s: %s", body.item_id, exc)
        raise HTTPException(status_code=502, detail="Failed to start re-authorization. Please try again.") from exc


class ClearErrorRequest(BaseModel):
    item_id: str


@router.post("/clear-error")
async def clear_sync_error(
    body: ClearErrorRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_plaid),
) -> dict:
    """Clear the sync error on a PlaidLink after successful re-authorization."""
    result = await db.execute(
        select(PlaidLink).where(PlaidLink.item_id == body.item_id, PlaidLink.is_active == True)  # noqa: E712
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Linked account not found")
    link.last_sync_error = None
    await db.commit()
    logger.info("Cleared sync error for item %s (%s)", body.item_id, link.institution_name)
    return {"status": "ok"}


@router.post("/investments-link-token", response_model=LinkTokenResponse)
async def create_investments_link_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_plaid),
) -> LinkTokenResponse:
    """Create a Plaid Link token scoped to investment accounts (Vanguard, Fidelity, Schwab, etc.)."""
    try:
        link_token = plaid_connector.get_investments_link_token(user_id="local-user")
        return LinkTokenResponse(link_token=link_token)
    except Exception as exc:
        logger.error("Failed to create investments link token: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to create link token. Please try again.") from exc


@router.post("/sync-now", status_code=202)
async def trigger_sync_now(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_plaid),
) -> dict:
    """Manually trigger an immediate sync of all active Plaid links."""
    from app.tasks.ingestion import sync_all_accounts
    sync_all_accounts.delay()
    return {"status": "queued", "message": "Sync started — transactions will update in ~30 seconds"}


@router.post("/recategorize", status_code=202)
async def trigger_recategorize(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_plaid),
) -> dict:
    """Re-run categorization on all Uncategorized transactions."""
    from app.tasks.ingestion import recategorize_uncategorized
    recategorize_uncategorized.delay()
    return {"status": "queued", "message": "Recategorization started — check back in ~60 seconds"}


@router.post("/apply-rules", status_code=202)
async def trigger_apply_rules(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_plaid),
) -> dict:
    """Apply all active custom categorization rules to all existing transactions."""
    from app.tasks.ingestion import apply_custom_rules_to_all
    apply_custom_rules_to_all.delay()
    return {"status": "queued", "message": "Applying custom rules — transactions will update in ~30 seconds"}


@router.post("/exchange-token", response_model=ExchangeTokenResponse)
async def exchange_token(
    body: ExchangeTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_plaid),
) -> ExchangeTokenResponse:
    """
    Exchange a public token from Plaid Link for an access token.
    Creates PlaidLink record and Account records for all linked accounts.
    """
    await check_plaid_limit(user, db)

    try:
        access_token, item_id = plaid_connector.exchange_public_token(body.public_token)
    except Exception as exc:
        logger.error("Failed to exchange public token: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to exchange token. Please try again.") from exc

    # If frontend didn't send institution info, look it up from Plaid
    if not body.institution_name or not body.institution_id:
        try:
            item_info = plaid_connector.get_item(access_token)
            if not body.institution_id:
                body.institution_id = item_info.get("institution_id")
            if not body.institution_name and item_info.get("institution_id"):
                body.institution_name = plaid_connector.get_institution_name(item_info["institution_id"])
        except Exception as exc:
            logger.warning("Failed to look up institution for item %s: %s", item_id, exc)

    # Check if this item_id already exists (re-link / update scenario)
    existing = await db.execute(
        select(PlaidLink).where(PlaidLink.item_id == item_id)
    )
    existing_link = existing.scalar_one_or_none()

    if existing_link:
        existing_link.access_token = access_token
        existing_link.institution_id = body.institution_id
        existing_link.institution_name = body.institution_name
        existing_link.is_active = True
        db.add(existing_link)
    else:
        # Deactivate any existing link for the same institution to prevent duplicate data.
        # This handles the case where the user goes through Plaid Link a second time for
        # an already-connected institution (new item_id each time in Plaid).
        if body.institution_id:
            dup_result = await db.execute(
                select(PlaidLink).where(
                    PlaidLink.institution_id == body.institution_id,
                    PlaidLink.is_active == True,  # noqa: E712
                    PlaidLink.item_id != item_id,
                )
            )
            for old_link in dup_result.scalars().all():
                old_link.is_active = False
                db.add(old_link)
                # Mark its accounts inactive so they disappear from the UI
                old_accts_result = await db.execute(
                    select(Account).where(Account.plaid_item_id == old_link.item_id)
                )
                for old_acct in old_accts_result.scalars().all():
                    old_acct.is_active = False
                    db.add(old_acct)
                logger.warning(
                    "Deactivated duplicate link %s for institution %s",
                    old_link.item_id,
                    body.institution_id,
                )

        link = PlaidLink(
            item_id=item_id,
            access_token=access_token,
            institution_id=body.institution_id,
            institution_name=body.institution_name or "Unknown",
            user_id=user.id,
        )
        db.add(link)

    # Fetch accounts for this item and upsert them
    try:
        plaid_accounts = plaid_connector.get_accounts(access_token)
    except Exception as exc:
        logger.error("Failed to fetch accounts for item %s: %s", item_id, exc)
        raise HTTPException(status_code=502, detail="Failed to fetch accounts. Please try again.") from exc

    accounts_created = 0
    for acct in plaid_accounts:
        plaid_account_id = acct["account_id"]

        result = await db.execute(
            select(Account).where(Account.plaid_account_id == plaid_account_id)
        )
        existing_acct = result.scalar_one_or_none()

        balances = acct.get("balances") or {}
        acct_type = str(acct.get("type", "depository"))
        acct_subtype = str(acct.get("subtype", "")) if acct.get("subtype") else None

        if existing_acct:
            existing_acct.current_balance = balances.get("current")
            existing_acct.available_balance = balances.get("available")
            existing_acct.credit_limit = balances.get("limit")
            db.add(existing_acct)
        else:
            _GENERIC = {"credit card", "plaid credit card", "checking", "savings", "unknown account"}
            raw_name = acct.get("name", "Unknown Account")
            official = acct.get("official_name")
            stored_name = official if (official and raw_name.lower() in _GENERIC) else raw_name
            new_acct = Account(
                plaid_account_id=plaid_account_id,
                plaid_item_id=item_id,
                name=stored_name,
                official_name=official,
                institution=body.institution_name or "Unknown",
                type=acct_type,
                subtype=acct_subtype,
                current_balance=balances.get("current"),
                available_balance=balances.get("available"),
                credit_limit=balances.get("limit"),
                mask=acct.get("mask"),
                user_id=user.id,
            )
            db.add(new_acct)
            accounts_created += 1

    await db.commit()
    logger.info("Exchanged token for item %s, created %d accounts", item_id, accounts_created)

    # Trigger an immediate sync — no need to wait for the nightly cron
    from app.tasks.ingestion import sync_single_link
    from app.tasks.maintenance import snapshot_net_worth
    sync_single_link.delay(item_id)
    snapshot_net_worth.delay()
    logger.info("Queued immediate sync + net worth snapshot for item %s", item_id)

    return ExchangeTokenResponse(item_id=item_id, accounts_created=accounts_created)
