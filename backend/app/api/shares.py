"""Expense shares API — person-based expense splitting (distinct from category-split transaction_splits)."""
import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
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


class SettleBatch(BaseModel):
    """Settle several shares with one repayment — the common case when someone
    clears a month of shares in a single transfer."""
    share_ids: list[uuid.UUID]
    settlement_transaction_id: Optional[uuid.UUID] = None


class SettlementCandidate(BaseModel):
    transaction_id: str
    date: str
    description: str
    amount: float          # positive: money that came in
    # Why this is being offered, best first:
    #   "exact"    — equals this share's amount
    #   "batch"    — equals the total of this contact's pending shares
    #   "name"     — the description mentions the contact
    #   "recent"   — an inflow in the window, nothing more
    match: str


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


# Ranking tiers for settlement candidates, best first.
MATCH_RANK = {"exact": 0, "batch": 1, "name": 2, "recent": 3}


def classify_candidate(
    *,
    inflow: float,
    description: str,
    share_amount: float,
    pending_total: float,
    contact_name: Optional[str],
) -> str:
    """Why (and how strongly) an inflow looks like the repayment for a share.

    Amounts win over names: a cent-exact match is far stronger evidence than a
    description mentioning someone, since bank descriptors are inconsistent and a
    name can appear on unrelated transfers. A lump sum clearing everything the
    contact owes is ranked just under an exact single-share match — that pattern is
    how people actually settle up.
    """
    if abs(inflow - share_amount) < 0.01:
        return "exact"
    if pending_total > 0 and abs(inflow - pending_total) < 0.01:
        return "batch"
    # split() on an all-whitespace or empty name yields [], so guard before indexing.
    name_parts = (contact_name or "").split()
    first_name = name_parts[0].lower() if name_parts else ""
    if first_name and first_name in description.lower():
        return "name"
    return "recent"


@router.get("/shares/{share_id}/settlement-candidates", response_model=list[SettlementCandidate])
async def settlement_candidates(
    share_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[SettlementCandidate]:
    """Inflows that could be the repayment for this share, best guess first.

    Repayments are ordinary money-in transactions, so there's nothing marking one as
    "Anthony paying me back" — this ranks the plausible ones instead of making the
    user hunt. A lump sum covering a month of shares is the common case, so a
    transaction matching the contact's *pending total* ranks alongside an exact match
    on this single share.
    """
    row = (await db.execute(
        select(ExpenseShare, Contact, Transaction)
        .join(Contact, ExpenseShare.contact_id == Contact.id)
        .join(Transaction, ExpenseShare.transaction_id == Transaction.id)
        .where(ExpenseShare.id == share_id)
    )).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Share not found")
    share, contact, charge = row

    # Total this contact currently owes — what a lump-sum repayment would equal.
    pending_total = float((await db.execute(
        select(func.coalesce(func.sum(ExpenseShare.amount), 0)).where(
            ExpenseShare.contact_id == contact.id,
            ExpenseShare.status == "pending",
        )
    )).scalar_one() or 0)

    # Money-in from the charge date onward (nobody pays you back before you pay).
    # A generous tail: people settle up months late, as the ledger shows.
    inflows = (await db.execute(
        select(Transaction)
        .where(
            Transaction.amount < 0,
            Transaction.date >= charge.date,
            Transaction.date <= date.today(),
        )
        .order_by(Transaction.date.desc())
        .limit(300)
    )).scalars().all()

    share_amount = float(share.amount)

    out: list[SettlementCandidate] = []
    for tx in inflows:
        inflow = abs(float(tx.amount))
        out.append(SettlementCandidate(
            transaction_id=str(tx.id),
            date=tx.date.isoformat(),
            description=tx.merchant or tx.raw_description,
            amount=round(inflow, 2),
            match=classify_candidate(
                inflow=inflow,
                description=f"{tx.merchant or ''} {tx.raw_description or ''}",
                share_amount=share_amount,
                pending_total=pending_total,
                contact_name=contact.name,
            ),
        ))

    # Ranked matches first, newest within each tier. Two passes rather than one
    # composite key: Python's sort is stable, so the date order survives.
    out.sort(key=lambda c: c.date, reverse=True)
    out.sort(key=lambda c: MATCH_RANK[c.match])
    return out[:40]


@router.patch("/shares/settle-batch", response_model=list[ShareOut])
async def settle_batch(
    body: SettleBatch,
    db: AsyncSession = Depends(get_db),
) -> list[ShareOut]:
    """Settle several shares against one repayment transaction.

    All-or-nothing: if any id is unknown or already settled the whole call fails, so
    a partly-applied lump sum can't leave the ledger half-reconciled.
    """
    if not body.share_ids:
        raise HTTPException(status_code=422, detail="No shares given")

    rows = (await db.execute(
        select(ExpenseShare, Contact)
        .join(Contact, ExpenseShare.contact_id == Contact.id)
        .where(ExpenseShare.id.in_(body.share_ids))
    )).all()
    found = {share.id for share, _ in rows}
    missing = [str(sid) for sid in body.share_ids if sid not in found]
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown share(s): {', '.join(missing)}")

    already = [str(share.id) for share, _ in rows if share.status == "settled"]
    if already:
        raise HTTPException(
            status_code=409, detail=f"Already settled: {', '.join(already)}"
        )

    now = datetime.now(timezone.utc)
    for share, _ in rows:
        share.status = "settled"
        share.settled_at = now
        share.settlement_transaction_id = body.settlement_transaction_id
        db.add(share)
    await db.commit()

    out = []
    for share, contact in rows:
        await db.refresh(share)
        out.append(_to_out(share, contact))
    return out


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
