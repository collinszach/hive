"""Accounts API — list linked accounts with current balances."""
import logging
import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.account import Account

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


class AccountOut(BaseModel):
    id: uuid.UUID
    plaid_account_id: Optional[str]
    name: str
    official_name: Optional[str]
    institution: str
    type: str
    subtype: Optional[str]
    card_slug: Optional[str]
    current_balance: Optional[float]
    available_balance: Optional[float]
    credit_limit: Optional[float]
    currency: str
    mask: Optional[str]
    is_active: bool
    is_excluded: bool

    model_config = {"from_attributes": True}


@router.get("", response_model=list[AccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db)) -> list[AccountOut]:
    """Return all active accounts with current balances."""
    result = await db.execute(
        select(Account)
        .where(Account.is_active == True)  # noqa: E712
        .order_by(Account.institution, Account.name)
    )
    accounts = result.scalars().all()
    return [AccountOut.model_validate(a) for a in accounts]
