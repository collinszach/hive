"""Accounts API — list linked accounts with current balances."""
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.gates import get_current_user
from app.models.account import Account
from app.models.plaid_link import PlaidLink
from app.models.transaction import Transaction
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


class AccountOut(BaseModel):
    id: uuid.UUID
    plaid_account_id: Optional[str]
    snaptrade_account_id: Optional[str]
    name: str
    official_name: Optional[str]
    institution: str
    type: str
    subtype: Optional[str]
    card_slug: Optional[str]
    current_balance: Optional[float]
    available_balance: Optional[float]
    credit_limit: Optional[float]
    statement_balance: Optional[float]
    statement_close_day: Optional[int]
    payment_due_day: Optional[int]
    autopay: bool
    currency: str
    mask: Optional[str]
    is_active: bool
    is_excluded: bool
    is_manual: bool

    model_config = {"from_attributes": True}


class LinkedInstitutionOut(BaseModel):
    item_id: str
    institution_name: str
    institution_id: Optional[str]
    last_sync_at: Optional[str]
    last_sync_error: Optional[str]
    accounts: list[AccountOut]


class UnlinkResponse(BaseModel):
    item_id: str
    accounts_removed: int
    transactions_deleted: int


@router.get("", response_model=list[AccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> list[AccountOut]:
    """Return all active accounts for the current user."""
    result = await db.execute(
        select(Account)
        .where(Account.is_active == True, Account.user_id == user.id)  # noqa: E712
        .order_by(Account.institution, Account.name)
    )
    accounts = result.scalars().all()
    return [AccountOut.model_validate(a) for a in accounts]


@router.get("/linked", response_model=list[LinkedInstitutionOut])
async def list_linked_institutions(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> list[LinkedInstitutionOut]:
    """Return active Plaid links grouped with their accounts for the current user."""
    links_result = await db.execute(
        select(PlaidLink)
        .where(PlaidLink.is_active == True, PlaidLink.user_id == user.id)  # noqa: E712
        .order_by(PlaidLink.institution_name)
    )
    links = links_result.scalars().all()

    out = []
    for link in links:
        accts_result = await db.execute(
            select(Account)
            .where(Account.plaid_item_id == link.item_id, Account.is_active == True)  # noqa: E712
            .order_by(Account.name)
        )
        accts = accts_result.scalars().all()
        out.append(LinkedInstitutionOut(
            item_id=link.item_id,
            institution_name=link.institution_name or "Unknown",
            institution_id=link.institution_id,
            last_sync_at=link.last_sync_at.isoformat() if link.last_sync_at else None,
            last_sync_error=link.last_sync_error,
            accounts=[AccountOut.model_validate(a) for a in accts],
        ))

    # Include SnapTrade-connected accounts (not linked via Plaid)
    snap_result = await db.execute(
        select(Account)
        .where(Account.snaptrade_account_id.isnot(None), Account.is_active == True, Account.user_id == user.id)  # noqa: E712
        .order_by(Account.institution, Account.name)
    )
    snap_accts = snap_result.scalars().all()
    if snap_accts:
        # Group by institution
        by_inst: dict[str, list] = {}
        for a in snap_accts:
            by_inst.setdefault(a.institution or "SnapTrade", []).append(a)
        for inst_name, accts_list in by_inst.items():
            out.append(LinkedInstitutionOut(
                item_id=f"snaptrade-{inst_name.lower().replace(' ', '-')}",
                institution_name=inst_name,
                institution_id=None,
                last_sync_at=accts_list[0].last_synced.isoformat() if accts_list[0].last_synced else None,
                last_sync_error=None,
                accounts=[AccountOut.model_validate(a) for a in accts_list],
            ))

    return out


@router.delete("/linked/{item_id}", response_model=UnlinkResponse)
async def unlink_institution(
    item_id: str,
    delete_transactions: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> UnlinkResponse:
    """Deactivate a Plaid link and optionally delete its transactions."""
    link_result = await db.execute(
        select(PlaidLink).where(PlaidLink.item_id == item_id)
    )
    link = link_result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Plaid link not found")

    # Mark link inactive
    link.is_active = False
    db.add(link)

    # Mark all accounts on this item inactive
    accts_result = await db.execute(
        select(Account).where(Account.plaid_item_id == item_id)
    )
    accts = accts_result.scalars().all()
    account_ids = [a.id for a in accts]
    for acct in accts:
        acct.is_active = False
        db.add(acct)

    accounts_removed = len(accts)
    transactions_deleted = 0

    if delete_transactions and account_ids:
        del_result = await db.execute(
            delete(Transaction).where(Transaction.account_id.in_(account_ids))
        )
        transactions_deleted = del_result.rowcount

    await db.commit()
    logger.info(
        "Unlinked item %s: deactivated %d accounts, deleted %d transactions",
        item_id, accounts_removed, transactions_deleted,
    )

    from app.tasks.maintenance import snapshot_net_worth
    snapshot_net_worth.delay()

    return UnlinkResponse(
        item_id=item_id,
        accounts_removed=accounts_removed,
        transactions_deleted=transactions_deleted,
    )


# ---------------------------------------------------------------------------
# Manual accounts
# ---------------------------------------------------------------------------

class ManualAccountCreate(BaseModel):
    name: str
    institution: str
    type: str = "depository"
    subtype: Optional[str] = None
    current_balance: float = 0.0
    currency: str = "USD"


@router.post("/manual", response_model=AccountOut, status_code=201)
async def create_manual_account(
    body: ManualAccountCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    """Create a manually-managed account (no Plaid connection)."""
    acct = Account(
        name=body.name,
        institution=body.institution,
        type=body.type,
        subtype=body.subtype,
        current_balance=body.current_balance,
        currency=body.currency,
        is_manual=True,
        user_id=user.id,
    )
    db.add(acct)
    await db.commit()
    await db.refresh(acct)

    from app.tasks.maintenance import snapshot_net_worth
    snapshot_net_worth.delay()

    return AccountOut.model_validate(acct)


@router.patch("/manual/{account_id}", response_model=AccountOut)
async def update_manual_account(
    account_id: uuid.UUID,
    body: ManualAccountCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    """Update a manually-managed account's details or balance."""
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.is_manual == True, Account.user_id == user.id)  # noqa: E712
    )
    acct = result.scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=404, detail="Manual account not found")

    acct.name = body.name
    acct.institution = body.institution
    acct.type = body.type
    acct.subtype = body.subtype
    acct.current_balance = body.current_balance
    acct.currency = body.currency
    db.add(acct)
    await db.commit()
    await db.refresh(acct)

    from app.tasks.maintenance import snapshot_net_worth
    snapshot_net_worth.delay()
    return AccountOut.model_validate(acct)


@router.delete("/manual/{account_id}", status_code=204)
async def delete_manual_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Permanently delete a manually-managed account."""
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.is_manual == True)  # noqa: E712
    )
    acct = result.scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=404, detail="Manual account not found")

    await db.delete(acct)
    await db.commit()

    from app.tasks.maintenance import snapshot_net_worth
    snapshot_net_worth.delay()


# ---------------------------------------------------------------------------
# Billing dates (credit cards)
# ---------------------------------------------------------------------------

class BillingUpdate(BaseModel):
    statement_close_day: Optional[int] = None
    payment_due_day: Optional[int] = None
    credit_limit: Optional[float] = None
    autopay: Optional[bool] = None

    @field_validator("statement_close_day", "payment_due_day")
    @classmethod
    def valid_day(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 31):
            raise ValueError("day must be between 1 and 31")
        return v


@router.patch("/{account_id}/billing", response_model=AccountOut)
async def update_billing(
    account_id: uuid.UUID,
    body: BillingUpdate,
    db: AsyncSession = Depends(get_db),
) -> AccountOut:
    """Set statement close day and payment due day for a credit card account."""
    result = await db.execute(select(Account).where(Account.id == account_id, Account.is_active == True))  # noqa: E712
    acct = result.scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")
    if body.statement_close_day is not None:
        acct.statement_close_day = body.statement_close_day
    if body.payment_due_day is not None:
        acct.payment_due_day = body.payment_due_day
    if body.credit_limit is not None:
        acct.credit_limit = body.credit_limit
    if body.autopay is not None:
        acct.autopay = body.autopay
    db.add(acct)
    await db.commit()
    await db.refresh(acct)
    return AccountOut.model_validate(acct)
