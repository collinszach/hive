"""Transactions API — list, filter, and manual category override."""
import csv
import io
import logging
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.gates import _get_request_user
from app.models.account import Account
from app.models.points_ledger import PointsLedger
from app.models.tag import TransactionTag
from app.models.transaction import Transaction
from app.models.user import User
from app.points.tracker import compute_points_for_transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

# Plaid returns generic names like "CREDIT CARD" for Chase accounts.
# Use official_name as fallback when the stored name is a known placeholder.
_GENERIC_ACCOUNT_NAMES = {"credit card", "plaid credit card", "checking", "savings", "unknown account"}


def _account_display_name(name_col, official_name_col):
    """SQLAlchemy expression: official_name when name is a generic Plaid placeholder."""
    return case(
        (func.lower(name_col).in_(_GENERIC_ACCOUNT_NAMES),
         func.coalesce(official_name_col, name_col)),
        else_=name_col,
    )


class TransactionOut(BaseModel):
    id: uuid.UUID
    plaid_transaction_id: Optional[str]
    account_id: uuid.UUID
    account_name: Optional[str] = None
    card_slug: Optional[str] = None
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
    notes: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_row(cls, tx, acct_name: Optional[str], acct_slug: Optional[str]) -> "TransactionOut":
        return cls(
            id=tx.id,
            plaid_transaction_id=tx.plaid_transaction_id,
            account_id=tx.account_id,
            account_name=acct_name,
            card_slug=acct_slug,
            date=tx.date,
            amount=float(tx.amount),
            currency=tx.currency,
            merchant=tx.merchant,
            raw_description=tx.raw_description,
            category=tx.category,
            subcategory=tx.subcategory,
            category_source=tx.category_source,
            is_transfer=tx.is_transfer,
            is_excluded=tx.is_excluded,
            pending=tx.pending,
            payment_channel=tx.payment_channel,
            location_city=tx.location_city,
            location_state=tx.location_state,
            logo_url=tx.logo_url,
            notes=tx.reimbursement_note,
        )


class TransactionListResponse(BaseModel):
    items: list[TransactionOut]
    total: int
    total_amount: float
    page: int
    page_size: int
    pages: int


class CategoryUpdateRequest(BaseModel):
    category: str
    subcategory: str


class TransactionPatchRequest(BaseModel):
    merchant: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    month: Optional[str] = Query(None, description="YYYY-MM format, e.g. 2024-01"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive start date"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive end date"),
    category: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    account_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None, description="Search merchant or description"),
    search_all: bool = Query(False, description="If true, ignore month filter — search across all time"),
    tag_id: Optional[uuid.UUID] = Query(None, description="Filter by tag ID"),
    include_pending: bool = Query(False),
    include_excluded: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    """List transactions with optional filters."""
    filters = [
        # Only surface transactions from active account links — deduplicates
        # transactions that appear on stale Plaid items (re-linked accounts).
        Transaction.account_id.in_(
            select(Account.id).where(Account.is_active == True)  # noqa: E712
        )
    ]

    if not search_all:
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
        else:
            if start_date:
                try:
                    filters.append(Transaction.date >= date.fromisoformat(start_date))
                except ValueError:
                    raise HTTPException(status_code=400, detail="start_date must be YYYY-MM-DD")
            if end_date:
                try:
                    filters.append(Transaction.date <= date.fromisoformat(end_date))
                except ValueError:
                    raise HTTPException(status_code=400, detail="end_date must be YYYY-MM-DD")

    if category:
        cats = [c.strip() for c in category.split(",") if c.strip()]
        if len(cats) == 1:
            filters.append(Transaction.category == cats[0])
        elif cats:
            filters.append(Transaction.category.in_(cats))

    if subcategory:
        filters.append(Transaction.subcategory == subcategory)

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

    if tag_id:
        filters.append(
            Transaction.id.in_(
                select(TransactionTag.transaction_id).where(TransactionTag.tag_id == tag_id)
            )
        )

    if not include_pending:
        filters.append(Transaction.pending == False)  # noqa: E712

    if not include_excluded:
        filters.append(Transaction.is_excluded == False)  # noqa: E712

    where_clause = and_(*filters) if filters else True

    from sqlalchemy import case as sa_case
    count_result = await db.execute(
        select(
            func.count(),
            func.coalesce(
                func.sum(
                    sa_case((Transaction.amount > 0, Transaction.amount), else_=0)
                ),
                0,
            ),
        )
        .select_from(Transaction)
        .where(where_clause)
    )
    count_row = count_result.one()
    total = count_row[0]
    total_amount = float(count_row[1])

    offset = (page - 1) * page_size
    result = await db.execute(
        select(Transaction,
               _account_display_name(Account.name, Account.official_name).label("account_name"),
               Account.card_slug.label("account_card_slug"))
        .join(Account, Account.id == Transaction.account_id, isouter=True)
        .where(where_clause)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = result.all()

    pages = max(1, (total + page_size - 1) // page_size)

    items = []
    for row in rows:
        tx, acct_name, acct_slug = row[0], row[1], row[2]
        out = TransactionOut.model_validate(tx)
        out.account_name = acct_name
        out.card_slug = acct_slug
        out.notes = tx.reimbursement_note
        items.append(out)

    return TransactionListResponse(
        items=items,
        total=total,
        total_amount=round(total_amount, 2),
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/export")
async def export_transactions(
    month: Optional[str] = Query(None, description="YYYY-MM format"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    account_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    include_pending: bool = Query(False),
    include_excluded: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Export transactions as CSV (no pagination limit)."""
    filters = [
        Transaction.account_id.in_(
            select(Account.id).where(Account.is_active == True)  # noqa: E712
        )
    ]

    if month:
        try:
            year, mo = int(month[:4]), int(month[5:7])
            start = date(year, mo, 1)
            end = date(year + 1, 1, 1) if mo == 12 else date(year, mo + 1, 1)
            filters.append(Transaction.date >= start)
            filters.append(Transaction.date < end)
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM format")
    else:
        if start_date:
            filters.append(Transaction.date >= date.fromisoformat(start_date))
        if end_date:
            filters.append(Transaction.date <= date.fromisoformat(end_date))

    if category:
        cats = [c.strip() for c in category.split(",") if c.strip()]
        if len(cats) == 1:
            filters.append(Transaction.category == cats[0])
        elif cats:
            filters.append(Transaction.category.in_(cats))
    if account_id:
        filters.append(Transaction.account_id == account_id)
    if search:
        term = f"%{search}%"
        filters.append(or_(Transaction.merchant.ilike(term), Transaction.raw_description.ilike(term)))
    if not include_pending:
        filters.append(Transaction.pending == False)  # noqa: E712
    if not include_excluded:
        filters.append(Transaction.is_excluded == False)  # noqa: E712

    where_clause = and_(*filters) if filters else True

    result = await db.execute(
        select(Transaction,
               _account_display_name(Account.name, Account.official_name).label("account_name"))
        .join(Account, Account.id == Transaction.account_id, isouter=True)
        .where(where_clause)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .limit(10_000)
    )
    rows = result.all()

    # Build CSV in-memory
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Date", "Merchant", "Description", "Amount", "Category", "Subcategory",
        "Account", "Payment Channel", "City", "State", "Pending", "Excluded", "Notes",
    ])
    for row in rows:
        tx, acct_name = row[0], row[1]
        writer.writerow([
            tx.date.isoformat(),
            tx.merchant or "",
            tx.raw_description,
            f"{float(tx.amount):.2f}",
            tx.category or "",
            tx.subcategory or "",
            acct_name or "",
            tx.payment_channel or "",
            tx.location_city or "",
            tx.location_state or "",
            "yes" if tx.pending else "no",
            "yes" if tx.is_excluded else "no",
            tx.reimbursement_note or "",
        ])

    buf.seek(0)
    filename = f"hive-transactions-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/spend-by-category")
async def spend_by_category(
    month: Optional[str] = Query(None, description="YYYY-MM format, defaults to current month"),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return spend totals by category for a given month, ordered by spend descending."""
    if month:
        try:
            year, mo = int(month[:4]), int(month[5:7])
            start = date(year, mo, 1)
            end = date(year + 1, 1, 1) if mo == 12 else date(year, mo + 1, 1)
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM format")
    else:
        from datetime import date as _date
        today = _date.today()
        start = _date(today.year, today.month, 1)
        end = _date(today.year + 1, 1, 1) if today.month == 12 else _date(today.year, today.month + 1, 1)

    result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .where(
            and_(
                Transaction.date >= start,
                Transaction.date < end,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.amount > 0,
                Transaction.category.isnot(None),
            )
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    )
    return [{"category": row[0], "spend": float(row[1])} for row in result.all()]


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


@router.post("/recategorize")
async def trigger_recategorize(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Trigger background recategorization of all uncategorized transactions.
    Also re-runs categorization on transactions where category_source is not 'manual'.
    Returns immediately; categorization runs in background via Celery.
    """
    await _get_request_user(request, db)
    from app.tasks.ingestion import recategorize_uncategorized
    task = recategorize_uncategorized.delay()
    return {"status": "queued", "task_id": str(task.id)}


@router.post("/sync-now")
async def trigger_sync(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Trigger an immediate Plaid sync for all accounts."""
    await _get_request_user(request, db)
    from app.tasks.ingestion import sync_all_accounts
    task = sync_all_accounts.delay()
    return {"status": "queued", "task_id": str(task.id)}


@router.get("/{transaction_id}", response_model=TransactionOut)
async def get_transaction(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> TransactionOut:
    """Fetch a single transaction by ID."""
    result = await db.execute(
        select(Transaction,
               _account_display_name(Account.name, Account.official_name),
               Account.card_slug)
        .join(Account, Account.id == Transaction.account_id, isouter=True)
        .where(Transaction.id == transaction_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx, acct_name, acct_slug = row
    return TransactionOut.from_row(tx, acct_name, acct_slug)


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
    if body.notes is not None:
        tx.reimbursement_note = body.notes.strip() or None

    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    out = TransactionOut.model_validate(tx)
    out.notes = tx.reimbursement_note
    return out


class ManualTransactionRequest(BaseModel):
    date: date
    amount: float
    merchant: str = Field(..., max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)
    account_id: Optional[uuid.UUID] = None


@router.post("", response_model=TransactionOut, status_code=201)
async def create_manual_transaction(
    body: ManualTransactionRequest,
    db: AsyncSession = Depends(get_db),
) -> TransactionOut:
    """Create a manual transaction (cash, reimbursement, etc.)."""
    from app.models.account import Account as AcctModel

    # Resolve or create a "Manual" account
    if body.account_id:
        acct_result = await db.execute(select(AcctModel).where(AcctModel.id == body.account_id))
        account = acct_result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found")
    else:
        # Find or create the default manual account
        acct_result = await db.execute(
            select(AcctModel).where(AcctModel.is_manual == True).limit(1)  # noqa: E712
        )
        account = acct_result.scalar_one_or_none()
        if account is None:
            account = AcctModel(
                name="Manual Transactions",
                institution="Manual",
                type="depository",
                subtype="checking",
                is_manual=True,
            )
            db.add(account)
            await db.flush()

    from decimal import Decimal as D
    tx = Transaction(
        account_id=account.id,
        date=body.date,
        amount=D(str(round(body.amount, 2))),
        merchant=body.merchant.strip() or None,
        raw_description=body.merchant.strip() or "Manual transaction",
        category=body.category,
        subcategory=body.subcategory,
        category_source="manual",
        reimbursement_note=body.notes.strip() if body.notes else None,
        pending=False,
        is_transfer=False,
        is_excluded=False,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    logger.info("Created manual transaction id=%s merchant=%s amount=%s", tx.id, tx.merchant, tx.amount)
    out = TransactionOut.model_validate(tx)
    out.account_name = account.name
    out.notes = tx.reimbursement_note
    return out


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a manual transaction. Only manual transactions (no plaid_transaction_id) can be deleted."""
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    tx = result.scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.plaid_transaction_id is not None:
        raise HTTPException(status_code=400, detail="Cannot delete Plaid-synced transactions")
    await db.delete(tx)
    await db.commit()


class BulkUpdateBody(BaseModel):
    ids: list[str]
    category: Optional[str] = None
    subcategory: Optional[str] = None
    is_excluded: Optional[bool] = None


@router.post("/bulk-update")
async def bulk_update(
    body: BulkUpdateBody,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Bulk update category, subcategory, or exclusion status for a list of transaction IDs.
    Only provided fields are applied. Returns count of updated rows.
    """
    if not body.ids:
        return {"updated": 0}

    try:
        parsed_ids = [uuid.UUID(i) for i in body.ids]
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid transaction ID format")

    result = await db.execute(
        select(Transaction).where(Transaction.id.in_(parsed_ids))
    )
    txns = result.scalars().all()

    for tx in txns:
        if body.category is not None:
            tx.category = body.category
            tx.subcategory = body.subcategory  # None clears subcategory
            tx.category_source = "manual"
        if body.is_excluded is not None:
            tx.is_excluded = body.is_excluded

    await db.commit()
    logger.info("Bulk updated %d transactions: %s", len(txns), body.model_dump(exclude={"ids"}))
    return {"updated": len(txns)}
