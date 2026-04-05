"""Transactions API — list, filter, and manual category override."""
import logging
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.account import Account
from app.models.points_ledger import PointsLedger
from app.models.transaction import Transaction
from app.points.tracker import compute_points_for_transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


class TransactionOut(BaseModel):
    id: uuid.UUID
    plaid_transaction_id: Optional[str]
    account_id: uuid.UUID
    date: date
    amount: float
    currency: str
    merchant: Optional[str]
    raw_description: str
    category: Optional[str]
    subcategory: Optional[str]
    category_source: str
    is_transfer: bool
    is_excluded: bool
    pending: bool
    payment_channel: Optional[str]
    location_city: Optional[str]
    location_state: Optional[str]
    logo_url: Optional[str]

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int
    pages: int


class CategoryUpdateRequest(BaseModel):
    category: str
    subcategory: str


class TransactionPatchRequest(BaseModel):
    merchant: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    month: Optional[str] = Query(None, description="YYYY-MM format, e.g. 2024-01"),
    category: Optional[str] = Query(None),
    account_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None, description="Search merchant or description"),
    include_pending: bool = Query(False),
    include_excluded: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    """List transactions with optional filters."""
    filters = []

    if month:
        try:
            year, mo = int(month[:4]), int(month[5:7])
            start = date(year, mo, 1)
            if mo == 12:
                end = date(year + 1, 1, 1)
            else:
                end = date(year, mo + 1, 1)
            filters.append(Transaction.date >= start)
            filters.append(Transaction.date < end)
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM format")

    if category:
        filters.append(Transaction.category == category)

    if account_id:
        filters.append(Transaction.account_id == account_id)

    if search:
        term = f"%{search}%"
        filters.append(
            or_(
                Transaction.merchant.ilike(term),
                Transaction.raw_description.ilike(term),
            )
        )

    if not include_pending:
        filters.append(Transaction.pending == False)  # noqa: E712

    if not include_excluded:
        filters.append(Transaction.is_excluded == False)  # noqa: E712

    where_clause = and_(*filters) if filters else True

    count_result = await db.execute(
        select(func.count()).select_from(Transaction).where(where_clause)
    )
    total = count_result.scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        select(Transaction)
        .where(where_clause)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    transactions = result.scalars().all()

    pages = max(1, (total + page_size - 1) // page_size)

    return TransactionListResponse(
        items=[TransactionOut.model_validate(t) for t in transactions],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.put("/{transaction_id}/category")
async def update_category(
    transaction_id: uuid.UUID,
    body: CategoryUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Manually override a transaction's category and sync-recompute points."""
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    tx = result.scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    tx.category = body.category
    tx.subcategory = body.subcategory
    tx.category_source = "manual"
    db.add(tx)
    await db.commit()

    # Sync points recalc — fetch card_slug from account
    acct_result = await db.execute(
        select(Account.card_slug).where(Account.id == tx.account_id)
    )
    card_slug = acct_result.scalar_one_or_none()

    if card_slug and not tx.is_excluded and not tx.pending:
        pts = compute_points_for_transaction(
            card_slug=card_slug,
            category=tx.category,
            subcategory=tx.subcategory,
            amount=float(tx.amount),
        )
        if pts:
            stmt = pg_insert(PointsLedger).values(
                transaction_id=tx.id,
                account_id=tx.account_id,
                card_slug=pts.card_slug,
                program=pts.program,
                points_earned=pts.points_earned,
                earn_rate=pts.earn_rate,
                category=tx.category,
                subcategory=tx.subcategory,
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_points_ledger_transaction",
                set_={
                    "card_slug": stmt.excluded.card_slug,
                    "program": stmt.excluded.program,
                    "points_earned": stmt.excluded.points_earned,
                    "earn_rate": stmt.excluded.earn_rate,
                    "category": stmt.excluded.category,
                    "subcategory": stmt.excluded.subcategory,
                },
            )
            await db.execute(stmt)
            await db.commit()

    logger.info(
        "Manual category override tx=%s → %s / %s",
        transaction_id, body.category, body.subcategory,
    )
    return {"id": str(transaction_id), "category": body.category, "subcategory": body.subcategory}


@router.patch("/{transaction_id}")
async def patch_transaction(
    transaction_id: uuid.UUID,
    body: TransactionPatchRequest,
    db: AsyncSession = Depends(get_db),
) -> TransactionOut:
    """Update merchant name and/or category/subcategory on a transaction."""
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    tx = result.scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if body.merchant is not None:
        tx.merchant = body.merchant.strip() or None
    if body.category is not None:
        tx.category = body.category.strip() or None
        tx.category_source = "manual"
    if body.subcategory is not None:
        tx.subcategory = body.subcategory.strip() or None

    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return TransactionOut.model_validate(tx)


@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return distinct categories present in actual transactions, ordered by spend."""
    result = await db.execute(
        select(Transaction.category, func.count().label("count"))
        .where(
            and_(
                Transaction.category.isnot(None),
                Transaction.category != "Uncategorized",
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.amount > 0,
            )
        )
        .group_by(Transaction.category)
        .order_by(func.count().desc())
    )
    return [{"category": row[0], "count": row[1]} for row in result.all()]
