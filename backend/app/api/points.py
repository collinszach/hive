"""Points API — summary, optimizer, balance upsert, and ledger endpoints."""
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.points_balance import PointsBalance
from app.models.points_ledger import PointsLedger
from app.models.points_redemption import PointsRedemption
from app.points.redemption_detector import explain as explain_reason
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
    manual_balance: Optional[int]     # the raw snapshot, exactly as entered
    estimated_value_dollars: float
    redemption_threshold: Optional[int]
    above_threshold: bool
    # --- rolled-forward balance -------------------------------------------
    # A manual balance is a snapshot that goes stale the moment it's entered, so
    # showing it raw understates the balance by everything earned since. These
    # carry the snapshot forward by ledger activity after `balance_as_of`.
    balance_as_of: Optional[str] = None       # ISO date of the snapshot
    points_since_balance: float = 0.0         # earned strictly after that date
    points_redeemed_since: float = 0.0        # confirmed redemptions after that date
    current_balance: Optional[int] = None     # manual_balance + points_since_balance
    # True when current_balance is a roll-forward rather than a fresh snapshot.
    # The ledger only ever adds, so an estimate can overstate if points were
    # redeemed or transferred out since — clients should label it as approximate.
    is_estimated: bool = False


class PointsSummaryResponse(BaseModel):
    programs: list[ProgramSummary]
    total_estimated_value_dollars: float
    # Award-fee candidates awaiting review. While this is non-zero the balances are
    # known to be overstated by however much those redemptions cost.
    unreviewed_redemptions: int = 0


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


class RedemptionOut(BaseModel):
    id: uuid.UUID
    transaction_id: Optional[uuid.UUID]
    program: Optional[str]
    points_spent: Optional[float]
    cash_value_avoided: Optional[float]
    fees_paid: float
    redeemed_on: str
    merchant: Optional[str]
    status: str
    detection_reason: Optional[str]
    note: Optional[str]
    # Value actually extracted, in cents per point. None unless both sides are known.
    cents_per_point: Optional[float] = None
    # Plain-language reason this was flagged, for the review queue.
    explanation: str = ""


class RedemptionConfirmRequest(BaseModel):
    program: str
    points_spent: float
    cash_value_avoided: Optional[float] = None
    note: Optional[str] = None

    @field_validator("points_spent")
    @classmethod
    def _positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("points_spent must be positive")
        return v


class RedemptionCreateRequest(BaseModel):
    """Record a redemption by hand — including one with no out-of-pocket cost, which
    leaves no trace in the transaction feed at all."""
    program: str
    points_spent: float
    redeemed_on: date
    merchant: Optional[str] = None
    cash_value_avoided: Optional[float] = None
    fees_paid: float = 0.0
    note: Optional[str] = None

    @field_validator("points_spent")
    @classmethod
    def _positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("points_spent must be positive")
        return v


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
    """Per-program points position: earned in the window, current balance, value, nudge.

    Balances come from manual snapshots (no card issuer offers a consumer API for
    reward balances, and Plaid does not carry them). A snapshot is therefore stale
    from the moment it lands, so `current_balance` rolls it forward by ledger points
    earned after `balance_as_of`, and dollar value plus the redemption nudge are both
    computed from that rolled-forward figure rather than the raw snapshot.

    The roll-forward only adds, since the ledger has no visibility into redemptions or
    transfers out — `is_estimated` marks a figure that has been carried forward so
    clients can present it as approximate. Entering a fresh snapshot resets the drift.
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

    # Latest manual balance per program, with the date it was taken.
    from sqlalchemy import text as sa_text
    latest_balances = await db.execute(
        sa_text(
            "SELECT DISTINCT ON (program) program, balance, as_of "
            "FROM points_balances "
            "ORDER BY program, as_of DESC"
        )
    )
    manual_by_program: dict[str, int] = {}
    as_of_by_program: dict[str, date] = {}
    for row in latest_balances.all():
        manual_by_program[row[0]] = int(row[1])
        as_of_by_program[row[0]] = row[2]

    # Points earned since each program's snapshot, so a months-old manual balance
    # isn't shown as if nothing had been earned since. One query with an OR per
    # program rather than a query each — there are only a handful of programs.
    since_by_program: dict[str, float] = {}
    if as_of_by_program:
        since_rows = await db.execute(
            select(PointsLedger.program, func.sum(PointsLedger.points_earned))
            .join(Transaction, PointsLedger.transaction_id == Transaction.id)
            .where(
                or_(*[
                    and_(PointsLedger.program == prog, Transaction.date > snapshot_date)
                    for prog, snapshot_date in as_of_by_program.items()
                ])
            )
            .group_by(PointsLedger.program)
        )
        since_by_program = {row[0]: float(row[1] or 0) for row in since_rows.all()}

    # Points spent since each snapshot. Without this the roll-forward only ever adds
    # and the balance drifts upward forever — the ledger records earning only.
    redeemed_by_program: dict[str, float] = {}
    if as_of_by_program:
        redeemed_rows = await db.execute(
            select(PointsRedemption.program, func.sum(PointsRedemption.points_spent))
            .where(
                PointsRedemption.status == "confirmed",
                PointsRedemption.points_spent.isnot(None),
                or_(*[
                    and_(PointsRedemption.program == prog,
                         PointsRedemption.redeemed_on > snapshot_date)
                    for prog, snapshot_date in as_of_by_program.items()
                ]),
            )
            .group_by(PointsRedemption.program)
        )
        redeemed_by_program = {row[0]: float(row[1] or 0) for row in redeemed_rows.all()}

    # Candidates awaiting review, so the UI can say how much the estimate might move.
    pending_review = await db.execute(
        select(func.count()).select_from(PointsRedemption)
        .where(PointsRedemption.status == "candidate")
    )
    unreviewed_count = int(pending_review.scalar_one() or 0)

    all_programs = set(earned_by_program) | set(manual_by_program) | set(POINT_VALUES_CPP)
    programs = []
    total_value = 0.0

    for program in sorted(all_programs):
        earned = earned_by_program.get(program, 0.0)
        manual = manual_by_program.get(program)
        snapshot_date = as_of_by_program.get(program)
        since = since_by_program.get(program, 0.0)
        redeemed = redeemed_by_program.get(program, 0.0)
        cpp = POINT_VALUES_CPP.get(program, 1.0)

        # Roll the snapshot forward: plus what was earned after it was taken, minus
        # what was confirmed spent. Clamped at 0 — an over-recorded redemption
        # shouldn't render as a negative balance. With no snapshot there's nothing to
        # roll forward from, so fall back to ledger-earned (the previous behaviour).
        if manual is not None:
            current = max(0, int(round(manual + since - redeemed)))
            is_estimated = since > 0 or redeemed > 0
        else:
            current = None
            is_estimated = False

        balance_for_value = float(current) if current is not None else earned
        est_value = round(balance_for_value * cpp / 100.0, 2)
        total_value += est_value

        threshold = REDEMPTION_THRESHOLDS.get(program)

        programs.append(ProgramSummary(
            program=program,
            points_earned_90d=round(earned, 2),
            manual_balance=manual,
            estimated_value_dollars=est_value,
            redemption_threshold=threshold,
            # Nudge off the rolled-forward balance — the stale snapshot is exactly
            # what kept big balances from ever crossing their threshold.
            above_threshold=threshold is not None and balance_for_value >= threshold,
            balance_as_of=snapshot_date.isoformat() if snapshot_date else None,
            points_since_balance=round(since, 2),
            points_redeemed_since=round(redeemed, 2),
            current_balance=current,
            is_estimated=is_estimated,
        ))

    return PointsSummaryResponse(
        programs=programs,
        total_estimated_value_dollars=round(total_value, 2),
        unreviewed_redemptions=unreviewed_count,
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


def _redemption_out(r: PointsRedemption) -> RedemptionOut:
    return RedemptionOut(
        id=r.id,
        transaction_id=r.transaction_id,
        program=r.program,
        points_spent=float(r.points_spent) if r.points_spent is not None else None,
        cash_value_avoided=float(r.cash_value_avoided) if r.cash_value_avoided is not None else None,
        fees_paid=float(r.fees_paid or 0),
        redeemed_on=r.redeemed_on.isoformat(),
        merchant=r.merchant,
        status=r.status,
        detection_reason=r.detection_reason,
        note=r.note,
        cents_per_point=r.cents_per_point,
        explanation=explain_reason(r.detection_reason, float(r.fees_paid or 0)),
    )


@router.get("/redemptions", response_model=list[RedemptionOut])
async def list_redemptions(
    status: str = Query("candidate", pattern="^(candidate|confirmed|dismissed|all)$"),
    db: AsyncSession = Depends(get_db),
) -> list[RedemptionOut]:
    """Award redemptions: pending review by default.

    Candidates are raised by the award-fee detector — an award booking pays the fare
    in points, so only taxes reach the card, and that small charge is the only trace.
    """
    q = select(PointsRedemption).order_by(PointsRedemption.redeemed_on.desc())
    if status != "all":
        q = q.where(PointsRedemption.status == status)
    return [_redemption_out(r) for r in (await db.execute(q)).scalars().all()]


@router.post("/redemptions/{redemption_id}/confirm", response_model=RedemptionOut)
async def confirm_redemption(
    redemption_id: uuid.UUID,
    body: RedemptionConfirmRequest,
    db: AsyncSession = Depends(get_db),
) -> RedemptionOut:
    """Confirm a redemption and how much it cost — the one thing detection can't know.

    Once confirmed the points come off the displayed balance, so the roll-forward
    stops being one-way.
    """
    r = (await db.execute(
        select(PointsRedemption).where(PointsRedemption.id == redemption_id)
    )).scalar_one_or_none()
    if r is None:
        raise HTTPException(status_code=404, detail="Redemption not found")

    r.program = body.program
    r.points_spent = body.points_spent
    if body.cash_value_avoided is not None:
        r.cash_value_avoided = body.cash_value_avoided
    if body.note is not None:
        r.note = body.note
    r.status = "confirmed"
    r.confirmed_at = datetime.now(timezone.utc)
    db.add(r)
    await db.commit()
    await db.refresh(r)
    logger.info("Confirmed redemption %s: %s pts of %s", r.id, r.points_spent, r.program)
    return _redemption_out(r)


@router.post("/redemptions/{redemption_id}/dismiss", response_model=RedemptionOut)
async def dismiss_redemption(
    redemption_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> RedemptionOut:
    """Not a redemption. Kept (rather than deleted) so the scan can't resurrect it."""
    r = (await db.execute(
        select(PointsRedemption).where(PointsRedemption.id == redemption_id)
    )).scalar_one_or_none()
    if r is None:
        raise HTTPException(status_code=404, detail="Redemption not found")
    r.status = "dismissed"
    r.confirmed_at = None
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _redemption_out(r)


@router.post("/redemptions/{redemption_id}/reopen", response_model=RedemptionOut)
async def reopen_redemption(
    redemption_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> RedemptionOut:
    """Undo a confirm or dismiss, back to candidate.

    A mistaken confirm moves a balance, so this has to be reversible.
    """
    r = (await db.execute(
        select(PointsRedemption).where(PointsRedemption.id == redemption_id)
    )).scalar_one_or_none()
    if r is None:
        raise HTTPException(status_code=404, detail="Redemption not found")
    r.status = "candidate"
    r.confirmed_at = None
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _redemption_out(r)


@router.post("/redemptions", response_model=RedemptionOut, status_code=201)
async def create_redemption(
    body: RedemptionCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> RedemptionOut:
    """Record a redemption by hand — confirmed immediately.

    Not every redemption leaves a fee charge (plenty cost nothing out of pocket), so
    detection alone can never be complete.
    """
    r = PointsRedemption(
        transaction_id=None,
        program=body.program,
        points_spent=body.points_spent,
        cash_value_avoided=body.cash_value_avoided,
        fees_paid=body.fees_paid,
        redeemed_on=body.redeemed_on,
        merchant=body.merchant,
        status="confirmed",
        detection_reason=None,
        note=body.note,
        confirmed_at=datetime.now(timezone.utc),
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _redemption_out(r)


@router.get("/thresholds")
async def points_thresholds() -> dict:
    """Return redemption thresholds and point valuations for all programs."""
    return {
        "thresholds": REDEMPTION_THRESHOLDS,
        "valuations_cpp": POINT_VALUES_CPP,
    }
