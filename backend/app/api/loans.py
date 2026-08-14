"""Loan tracking — manually-kept ledger for loans no data provider syncs
(private/federal student loans). Balance = running sum of signed entries."""
import logging
import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.gates import get_current_user
from app.models.loan import Loan
from app.models.loan_entry import LoanEntry
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/loans", tags=["loans"])


class LoanCreate(BaseModel):
    name: str
    interest_rate: Optional[Decimal] = None  # APR, e.g. 0.055 for 5.5%
    origination_date: Optional[date] = None
    notes: Optional[str] = None


class LoanEntryCreate(BaseModel):
    entry_type: str  # disbursement | payment | interest
    amount: Decimal
    entry_date: date
    note: Optional[str] = None


class LoanEntryOut(BaseModel):
    id: uuid.UUID
    loan_id: uuid.UUID
    entry_type: str
    amount: float
    entry_date: str
    note: Optional[str]

    model_config = {"from_attributes": True}


class LoanOut(BaseModel):
    id: uuid.UUID
    name: str
    interest_rate: Optional[float]
    origination_date: Optional[str]
    notes: Optional[str]
    balance: float
    total_disbursed: float
    total_paid: float

    model_config = {"from_attributes": True}


async def _owned_loan(loan_id: uuid.UUID, user: User, db: AsyncSession) -> Loan:
    result = await db.execute(select(Loan).where(Loan.id == loan_id, Loan.user_id == user.id))
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


def _to_out(loan: Loan, entries: list[LoanEntry]) -> LoanOut:
    disbursed = sum(float(e.amount) for e in entries if e.entry_type in ("disbursement", "interest") and e.amount > 0)
    paid = sum(-float(e.amount) for e in entries if e.entry_type == "payment")
    balance = sum(float(e.amount) for e in entries)
    return LoanOut(
        id=loan.id,
        name=loan.name,
        interest_rate=float(loan.interest_rate) if loan.interest_rate is not None else None,
        origination_date=loan.origination_date.isoformat() if loan.origination_date else None,
        notes=loan.notes,
        balance=round(balance, 2),
        total_disbursed=round(disbursed, 2),
        total_paid=round(paid, 2),
    )


@router.get("", response_model=list[LoanOut])
async def list_loans(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[LoanOut]:
    loans_result = await db.execute(select(Loan).where(Loan.user_id == user.id).order_by(Loan.created_at))
    loans = loans_result.scalars().all()

    out = []
    for loan in loans:
        entries_result = await db.execute(select(LoanEntry).where(LoanEntry.loan_id == loan.id))
        out.append(_to_out(loan, entries_result.scalars().all()))
    return out


@router.post("", response_model=LoanOut, status_code=201)
async def create_loan(
    body: LoanCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LoanOut:
    loan = Loan(
        user_id=user.id,
        name=body.name,
        interest_rate=body.interest_rate,
        origination_date=body.origination_date,
        notes=body.notes,
    )
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return _to_out(loan, [])


@router.delete("/{loan_id}", status_code=204)
async def delete_loan(
    loan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    loan = await _owned_loan(loan_id, user, db)
    await db.delete(loan)
    await db.commit()


@router.get("/{loan_id}/entries", response_model=list[LoanEntryOut])
async def list_loan_entries(
    loan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[LoanEntryOut]:
    await _owned_loan(loan_id, user, db)
    result = await db.execute(
        select(LoanEntry).where(LoanEntry.loan_id == loan_id).order_by(LoanEntry.entry_date.desc())
    )
    entries = result.scalars().all()
    return [
        LoanEntryOut(
            id=e.id, loan_id=e.loan_id, entry_type=e.entry_type,
            amount=float(e.amount), entry_date=e.entry_date.isoformat(), note=e.note,
        )
        for e in entries
    ]


@router.post("/{loan_id}/entries", response_model=LoanEntryOut, status_code=201)
async def create_loan_entry(
    loan_id: uuid.UUID,
    body: LoanEntryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LoanEntryOut:
    await _owned_loan(loan_id, user, db)
    if body.entry_type not in ("disbursement", "payment", "interest"):
        raise HTTPException(status_code=422, detail="entry_type must be disbursement, payment, or interest")

    # Store payments as negative (they reduce the balance) regardless of the sign
    # the caller sent, since the UI collects a positive "payment amount".
    amount = body.amount
    if body.entry_type == "payment" and amount > 0:
        amount = -amount
    elif body.entry_type in ("disbursement", "interest") and amount < 0:
        amount = -amount

    entry = LoanEntry(
        loan_id=loan_id,
        user_id=user.id,
        entry_type=body.entry_type,
        amount=amount,
        entry_date=body.entry_date,
        note=body.note,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return LoanEntryOut(
        id=entry.id, loan_id=entry.loan_id, entry_type=entry.entry_type,
        amount=float(entry.amount), entry_date=entry.entry_date.isoformat(), note=entry.note,
    )


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_loan_entry(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(select(LoanEntry).where(LoanEntry.id == entry_id, LoanEntry.user_id == user.id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
