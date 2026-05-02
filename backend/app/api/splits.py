"""Transaction Splits API — split a single transaction across multiple categories."""
import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.transaction import Transaction
from app.models.transaction_split import TransactionSplit

router = APIRouter(prefix="/api/transactions", tags=["splits"])


class SplitIn(BaseModel):
    amount: float
    category: Optional[str] = None
    subcategory: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def amount_positive(self) -> "SplitIn":
        if self.amount <= 0:
            raise ValueError("split amount must be positive")
        return self


class SplitOut(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    amount: float
    category: Optional[str]
    subcategory: Optional[str]
    notes: Optional[str]
    sort_order: int

    model_config = {"from_attributes": True}


class SetSplitsRequest(BaseModel):
    splits: list[SplitIn]

    @model_validator(mode="after")
    def at_least_two(self) -> "SetSplitsRequest":
        if len(self.splits) < 2:
            raise ValueError("provide at least 2 splits")
        return self


@router.get("/{transaction_id}/splits", response_model=list[SplitOut])
async def get_splits(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[SplitOut]:
    result = await db.execute(
        select(TransactionSplit)
        .where(TransactionSplit.transaction_id == transaction_id)
        .order_by(TransactionSplit.sort_order, TransactionSplit.created_at)
    )
    splits = result.scalars().all()
    return [SplitOut.model_validate(s) for s in splits]


@router.put("/{transaction_id}/splits", response_model=list[SplitOut])
async def set_splits(
    transaction_id: uuid.UUID,
    body: SetSplitsRequest,
    db: AsyncSession = Depends(get_db),
) -> list[SplitOut]:
    """Replace all splits for a transaction. Validates that amounts sum to transaction total."""
    tx_result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    tx = tx_result.scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    total_splits = sum(s.amount for s in body.splits)
    tx_amount = float(tx.amount)
    if abs(total_splits - tx_amount) > 0.02:
        raise HTTPException(
            status_code=422,
            detail=f"Split amounts ({total_splits:.2f}) must sum to transaction amount ({tx_amount:.2f})",
        )

    # Delete existing splits
    existing = await db.execute(
        select(TransactionSplit).where(TransactionSplit.transaction_id == transaction_id)
    )
    for s in existing.scalars().all():
        await db.delete(s)

    # Insert new splits
    new_splits = []
    for i, s in enumerate(body.splits):
        split = TransactionSplit(
            transaction_id=transaction_id,
            amount=Decimal(str(round(s.amount, 2))),
            category=s.category,
            subcategory=s.subcategory,
            notes=s.notes,
            sort_order=i,
        )
        db.add(split)
        new_splits.append(split)

    await db.commit()
    for s in new_splits:
        await db.refresh(s)

    return [SplitOut.model_validate(s) for s in new_splits]


@router.delete("/{transaction_id}/splits", status_code=204)
async def delete_splits(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove all splits for a transaction (revert to unsplit)."""
    existing = await db.execute(
        select(TransactionSplit).where(TransactionSplit.transaction_id == transaction_id)
    )
    for s in existing.scalars().all():
        await db.delete(s)
    await db.commit()
