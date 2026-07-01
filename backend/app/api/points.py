"""Points API — summary, optimizer, balance upsert, and ledger endpoints."""
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.points_balance import PointsBalance
from app.models.points_ledger import PointsLedger
from app.points.tracker import (
    EARN_RULES,
    POINT_VALUES_CPP,
    REDEMPTION_THRESHOLDS,
    CardOption,
    get_best_card_for_purchase,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/points", tags=["points"])

# ---------------------------------------------------------------------------
# Program → card_slug mapping (derived from earn rules — single source of truth)
# ---------------------------------------------------------------------------

_PROGRAM_TO_CARD_SLUG: dict[str, str] = {}
for _rule in EARN_RULES:
    if _rule.program not in _PROGRAM_TO_CARD_SLUG:
        _PROGRAM_TO_CARD_SLUG[_rule.program] = _rule.card_slug


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class ProgramSummary(BaseModel):
    program: str
    points_earned_90d: float          # field name kept for backward compat; reflects actual window
    manual_balance: Optional[int]
    estimated_value_dollars: float
    redemption_threshold: Optional[int]
    above_threshold: bool


class PointsSummaryResponse(BaseModel):
    programs: list[ProgramSummary]
    total_estimated_value_dollars: float


class CardOptionOut(BaseModel):
    card_slug: str
    account_name: Optional[str] = None
    program: str
    earn_rate: float
    points_earned: float
    dollar_value: float
    is_best: bool


class OptimizerResponse(BaseModel):
    category: Optional[str]
    subcategory: Optional[str]
    amount: float
    cards: list[CardOptionOut]


class LedgerEntryOut(BaseModel):
    transaction_id: uuid.UUID
    account_id: uuid.UUID
    card_slug: str
    program: str
    points_earned: float
    earn_rate: float
    category: Optional[str]
    subcategory: Optional[str]
    merchant: Optional[str]
    amount: float
    date: str   # ISO date string YYYY-MM-DD


class BalanceUpsertRequest(BaseModel):
    program: str
    balance: int


class BalanceUpsertResponse(BaseModel):
    program: str
    balance: int
    updated_at: str


class BalanceDeleteResponse(BaseModel):
    program: str
    deleted: int  # number of snapshot rows removed


class LeakageEntry(BaseModel):
    transaction_id: uuid.UUID
    merchant: Optional[str]
    date: str
    amount: float
    category: Optional[str]
    subcategory: Optional[str]
    actual_card_slug: str
    actual_earn_rate: float
    actual_points: float
    actual_value_dollars: float
    best_card_slug: str
    best_program: str
    best_earn_rate: float
    best_points: float
    best_value_dollars: float
    leakage_dollars: float


class LeakageResponse(BaseModel):
    entries: list[LeakageEntry]
    total_leakage_dollars: float
    transaction_count: int
    days: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=PointsSummaryResponse)
async def points_summary(
    days: int = Query(90, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
) -> PointsSummaryResponse:
    """
    Total points earned (within `days` window) per program, plus manual balance if entered,
    estimated dollar value, and redemption nudge.
    """
    from app.models.transaction import Transaction

    cutoff = date.today() - timedelta(days=days)

    # Aggregate earned points from ledger joined to transactions for date filter
    earned_rows = await db.execute(
        select(PointsLedger.program, func.sum(PointsLedger.points_earned))
        .join(Transaction, PointsLedger.transaction_id == Transaction.id)
        .where(Transaction.date >= cutoff)
        .group_by(PointsLedger.program)
    )
    earned_by_program: dict[str, float] = {
        row[0]: float(row[1]) for row in earned_rows.all()
    }

    # Latest manual balance per program (most recent as_of date only)
    from sqlalchemy import text as sa_text
    latest_balances = await db.execute(
        sa_text(
            "SELECT DISTINCT ON (program) program, balance "
            "FROM points_balances "
            "ORDER BY program, as_of DESC"
        )
    )
    manual_by_program: dict[str, int] = {
        row[0]: int(row[1]) for row in latest_balances.all()
    }

    all_programs = set(earned_by_program) | set(manual_by_program) | set(POINT_VALUES_CPP)
    programs = []
    total_value = 0.0

    for program in sorted(all_programs):
        earned = earned_by_program.get(program, 0.0)
        manual = manual_by_program.get(program)
        cpp = POINT_VALUES_CPP.get(program, 1.0)

        balance_for_value = float(manual) if manual is not None else earned
        est_value = round(balance_for_value * cpp / 100.0, 2)
        total_value += est_value

        programs.append(ProgramSummary(
            program=program,
            points_earned_90d=round(earned, 2),
            manual_balance=manual,
            estimated_value_dollars=est_value,
            redemption_threshold=None,
            above_threshold=False,
        ))

    return PointsSummaryResponse(
        programs=programs,
        total_estimated_value_dollars=round(total_value, 2),
    )


@router.put("/balance", response_model=BalanceUpsertResponse)
async def upsert_balance(
    body: BalanceUpsertRequest,
    db: AsyncSession = Depends(get_db),
) -> BalanceUpsertResponse:
    """
    Upsert a manual points balance for a program.
    Uses today's date as the as_of date; updates if a row already exists for today.
    """
    card_slug = _PROGRAM_TO_CARD_SLUG.get(body.program)
    if card_slug is None:
        raise HTTPException(status_code=422, detail=f"Unknown program: {body.program}")

    today = date.today()

    stmt = (
        pg_insert(PointsBalance)
        .values(
            card_slug=card_slug,
            program=body.program,
            balance=body.balance,
            as_of=today,
            source="manual",
        )
        .on_conflict_do_update(
            constraint="uq_points_balance_card_date",
            set_={"balance": body.balance},
        )
    )
    await db.execute(stmt)
    await db.commit()

    return BalanceUpsertResponse(
        program=body.program,
        balance=body.balance,
        updated_at=datetime.now(tz=timezone.utc).isoformat(),
    )


@router.delete("/balance/{program}", response_model=BalanceDeleteResponse)
async def delete_balance(
    program: str,
    db: AsyncSession = Depends(get_db),
) -> BalanceDeleteResponse:
    """
    Remove the manual balance for a program entirely.

    Deletes every points_balances snapshot for the program's card so the
    summary falls back to actual earned points. Setting the balance to 0 would
    NOT do this — a 0 is still a manual override that hides earned points.
    """
    card_slug = _PROGRAM_TO_CARD_SLUG.get(program)
    if card_slug is None:
        raise HTTPException(status_code=422, detail=f"Unknown program: {program}")

    result = await db.execute(
        delete(PointsBalance).where(PointsBalance.card_slug == card_slug)
    )
    await db.commit()

    return BalanceDeleteResponse(program=program, deleted=result.rowcount or 0)


@router.get("/optimize", response_model=OptimizerResponse)
async def optimize_card(
    category: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    amount: float = Query(100.0, gt=0),
    db: AsyncSession = Depends(get_db),
) -> OptimizerResponse:
    """Return ranked card list for a given purchase category and amount."""
    from app.models.account import Account

    options: list[CardOption] = get_best_card_for_purchase(category, subcategory, amount)

    slug_name_rows = await db.execute(
        select(Account.card_slug, Account.name)
        .where(Account.card_slug.isnot(None), Account.is_active == True)  # noqa: E712
    )
    slug_to_name: dict[str, str] = {row.card_slug: row.name for row in slug_name_rows.all()}

    cards_out = []
    for i, opt in enumerate(options):
        cards_out.append(CardOptionOut(
            card_slug=opt.card_slug,
            account_name=slug_to_name.get(opt.card_slug),
            program=opt.program,
            earn_rate=opt.earn_rate,
            points_earned=opt.points_earned,
            dollar_value=opt.dollar_value,
            is_best=(i == 0),
        ))

    return OptimizerResponse(
        category=category,
        subcategory=subcategory,
        amount=amount,
        cards=cards_out,
    )


@router.get("/ledger", response_model=list[LedgerEntryOut])
async def points_ledger(
    days: int = Query(90, ge=7, le=365),
    account_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[LedgerEntryOut]:
    """
    Transaction-level points ledger.
    `days` controls the lookback window (default 90).
    `account_id` optionally narrows to a specific account.
    """
    from sqlalchemy import and_
    from app.models.transaction import Transaction

    cutoff = date.today() - timedelta(days=days)

    filters = [Transaction.date >= cutoff]
    if account_id:
        filters.append(PointsLedger.account_id == account_id)

    result = await db.execute(
        select(
            PointsLedger,
            Transaction.merchant,
            Transaction.amount,
            Transaction.date,
        )
        .join(Transaction, PointsLedger.transaction_id == Transaction.id)
        .where(and_(*filters))
        .order_by(Transaction.date.desc())
        .limit(500)
    )

    entries = []
    for row in result.all():
        ledger, merchant, amount, txn_date = row
        entries.append(LedgerEntryOut(
            transaction_id=ledger.transaction_id,
            account_id=ledger.account_id,
            card_slug=ledger.card_slug,
            program=ledger.program,
            points_earned=float(ledger.points_earned),
            earn_rate=float(ledger.earn_rate),
            category=ledger.category,
            subcategory=ledger.subcategory,
            merchant=merchant,
            amount=float(amount),
            date=txn_date.isoformat(),
        ))

    return entries


@router.get("/leakage", response_model=LeakageResponse)
async def points_leakage(
    days: int = Query(90, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
) -> LeakageResponse:
    """
    Identify transactions where a better card was available but not used.
    Only reports leakage where the optimal card's value exceeds the actual by >10%
    AND leakage >= $0.25. Filtered to cards the user actually has.
    """
    from app.models.account import Account
    from app.models.transaction import Transaction

    cutoff = date.today() - timedelta(days=days)

    # Load user's active card slugs (only flag leakage for cards they own)
    acct_result = await db.execute(
        select(Account.card_slug)
        .where(Account.card_slug.isnot(None), Account.is_active == True)  # noqa: E712
    )
    owned_slugs: set[str] = {row[0] for row in acct_result.all()}

    if not owned_slugs:
        return LeakageResponse(entries=[], total_leakage_dollars=0.0, transaction_count=0, days=days)

    # Fetch ledger entries with transaction data
    result = await db.execute(
        select(
            PointsLedger,
            Transaction.merchant,
            Transaction.amount,
            Transaction.date,
        )
        .join(Transaction, PointsLedger.transaction_id == Transaction.id)
        .where(
            Transaction.date >= cutoff,
            Transaction.is_excluded == False,  # noqa: E712
            Transaction.pending == False,  # noqa: E712
            Transaction.amount > 0,
        )
        .order_by(Transaction.date.desc())
        .limit(2000)
    )

    entries: list[LeakageEntry] = []
    total_leakage = 0.0

    for row in result.all():
        ledger, merchant, amount, txn_date = row
        amount_f = float(amount)

        # Actual value
        cpp = POINT_VALUES_CPP.get(ledger.program, 1.0)
        actual_points = float(ledger.points_earned)
        actual_value = round(actual_points * cpp / 100.0, 4)

        # Best available card (filtered to cards user owns)
        options = get_best_card_for_purchase(ledger.category, ledger.subcategory, amount_f)
        owned_options = [o for o in options if o.card_slug in owned_slugs]
        if not owned_options:
            continue

        best = owned_options[0]

        # Skip if best card IS the actual card
        if best.card_slug == ledger.card_slug:
            continue

        best_value = round(best.dollar_value, 4)
        leakage = round(best_value - actual_value, 4)

        # Only report meaningful leakage (>10% better AND >=$0.25)
        if leakage < 0.25 or best_value <= actual_value * 1.10:
            continue

        entries.append(LeakageEntry(
            transaction_id=ledger.transaction_id,
            merchant=merchant,
            date=txn_date.isoformat(),
            amount=amount_f,
            category=ledger.category,
            subcategory=ledger.subcategory,
            actual_card_slug=ledger.card_slug,
            actual_earn_rate=float(ledger.earn_rate),
            actual_points=actual_points,
            actual_value_dollars=actual_value,
            best_card_slug=best.card_slug,
            best_program=best.program,
            best_earn_rate=best.earn_rate,
            best_points=round(best.points_earned, 2),
            best_value_dollars=best_value,
            leakage_dollars=leakage,
        ))
        total_leakage += leakage

    # Sort by leakage descending, cap at 50
    entries.sort(key=lambda e: e.leakage_dollars, reverse=True)
    entries = entries[:50]

    return LeakageResponse(
        entries=entries,
        total_leakage_dollars=round(total_leakage, 2),
        transaction_count=len(entries),
        days=days,
    )


@router.get("/monthly-trend")
async def points_monthly_trend(
    months: int = Query(12, ge=3, le=24),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Monthly points earned by program over the last N months."""
    from sqlalchemy import text

    result = await db.execute(
        text("""
            SELECT
                TO_CHAR(t.date, 'YYYY-MM') AS month,
                pl.program,
                SUM(pl.points_earned)::int AS points
            FROM points_ledger pl
            JOIN transactions t ON pl.transaction_id = t.id
            WHERE t.date >= (CURRENT_DATE - INTERVAL '1 month' * :months)
              AND NOT t.pending
            GROUP BY 1, 2
            ORDER BY 1, 2
        """),
        {"months": months},
    )
    return [{"month": r.month, "program": r.program, "points": r.points} for r in result.fetchall()]


@router.get("/thresholds")
async def points_thresholds() -> dict:
    """Return redemption thresholds and point valuations for all programs."""
    return {
        "thresholds": REDEMPTION_THRESHOLDS,
        "valuations_cpp": POINT_VALUES_CPP,
    }
