"""Expense shares API — person-based expense splitting (distinct from category-split transaction_splits)."""
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.contact import Contact
from app.models.expense_share import ExpenseShare
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["shares"])


class ShareOut(BaseModel):
    id: str
    transaction_id: str
    contact_id: str
    contact_name: str
    amount: float
    note: Optional[str]
    status: str
    settled_at: Optional[str]
    settlement_transaction_id: Optional[str]
    created_at: str
    transaction_date: Optional[str] = None
    transaction_merchant: Optional[str] = None
    transaction_amount: Optional[float] = None


class ShareCreate(BaseModel):
    contact_id: uuid.UUID
    amount: float
    note: Optional[str] = None


class ShareSettle(BaseModel):
    settlement_transaction_id: Optional[uuid.UUID] = None


def _to_out(
    share: ExpenseShare,
    contact: Contact,
    tx: Optional[Transaction] = None,
) -> ShareOut:
    return ShareOut(
        id=str(share.id),
        transaction_id=str(share.transaction_id),
        contact_id=str(share.contact_id),
        contact_name=contact.name,
        amount=float(share.amount),
        note=share.note,
        status=share.status,
        settled_at=share.settled_at.isoformat() if share.settled_at else None,
        settlement_transaction_id=str(share.settlement_transaction_id) if share.settlement_transaction_id else None,
        created_at=share.created_at.isoformat(),
        transaction_date=tx.date.isoformat() if tx else None,
        transaction_merchant=tx.merchant if tx else None,
        transaction_amount=float(tx.amount) if tx else None,
    )


@router.get("/transactions/{transaction_id}/shares", response_model=list[ShareOut])
async def list_shares(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[ShareOut]:
    result = await db.execute(
        select(ExpenseShare, Contact)
        .join(Contact, ExpenseShare.contact_id == Contact.id)
        .where(ExpenseShare.transaction_id == transaction_id)
        .order_by(ExpenseShare.created_at)
    )
    return [_to_out(share, contact) for share, contact in result.all()]


@router.post("/transactions/{transaction_id}/shares", response_model=ShareOut, status_code=201)
async def create_share(
    transaction_id: uuid.UUID,
    body: ShareCreate,
    db: AsyncSession = Depends(get_db),
) -> ShareOut:
    tx_result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    tx = tx_result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    contact_result = await db.execute(select(Contact).where(Contact.id == body.contact_id))
    contact = contact_result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if body.amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be positive")

    share = ExpenseShare(
        transaction_id=transaction_id,
        contact_id=body.contact_id,
        amount=Decimal(str(round(body.amount, 2))),
        note=body.note,
        status="pending",
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return _to_out(share, contact, tx)


@router.patch("/shares/{share_id}/settle", response_model=ShareOut)
async def settle_share(
    share_id: uuid.UUID,
    body: ShareSettle,
    db: AsyncSession = Depends(get_db),
) -> ShareOut:
    result = await db.execute(
        select(ExpenseShare, Contact)
        .join(Contact, ExpenseShare.contact_id == Contact.id)
        .where(ExpenseShare.id == share_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Share not found")
    share, contact = row

    if share.status == "settled":
        raise HTTPException(status_code=409, detail="Share is already settled")

    share.status = "settled"
    share.settled_at = datetime.now(timezone.utc)
    share.settlement_transaction_id = body.settlement_transaction_id
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return _to_out(share, contact)


@router.patch("/shares/{share_id}/unsettle", response_model=ShareOut)
async def unsettle_share(
    share_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ShareOut:
    result = await db.execute(
        select(ExpenseShare, Contact)
        .join(Contact, ExpenseShare.contact_id == Contact.id)
        .where(ExpenseShare.id == share_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Share not found")
    share, contact = row

    if share.status == "pending":
        raise HTTPException(status_code=409, detail="Share is already pending")

    share.status = "pending"
    share.settled_at = None
    share.settlement_transaction_id = None
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return _to_out(share, contact)


@router.delete("/shares/{share_id}", status_code=204)
async def delete_share(share_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    result = await db.execute(select(ExpenseShare).where(ExpenseShare.id == share_id))
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    await db.delete(share)
    await db.commit()


@router.get("/shares/pending", response_model=list[ShareOut])
async def list_pending_shares(db: AsyncSession = Depends(get_db)) -> list[ShareOut]:
    result = await db.execute(
        select(ExpenseShare, Contact, Transaction)
        .join(Contact, ExpenseShare.contact_id == Contact.id)
        .join(Transaction, ExpenseShare.transaction_id == Transaction.id)
        .where(ExpenseShare.status == "pending")
        .order_by(Transaction.date.desc())
    )
    return [_to_out(share, contact, tx) for share, contact, tx in result.all()]


@router.get("/shares/settled", response_model=list[ShareOut])
async def list_settled_shares(
    limit: int = Query(default=20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[ShareOut]:
    result = await db.execute(
        select(ExpenseShare, Contact, Transaction)
        .join(Contact, ExpenseShare.contact_id == Contact.id)
        .join(Transaction, ExpenseShare.transaction_id == Transaction.id)
        .where(ExpenseShare.status == "settled")
        .order_by(ExpenseShare.settled_at.desc())
        .limit(limit)
    )
    return [_to_out(share, contact, tx) for share, contact, tx in result.all()]
