"""Dashboard summary API — combined data for the main dashboard."""
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.account import Account
from app.models.anomaly import Anomaly
from app.models.budget import Budget
from app.models.goal import Goal
from app.models.net_worth import NetWorthSnapshot
from app.models.subscription import Subscription
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class AccountSummary(BaseModel):
    id: str
    name: str
    type: str
    current_balance: Optional[float]
    card_slug: Optional[str]


class CategorySpend(BaseModel):
    category: str
    total: float


class AnomalySummary(BaseModel):
    count: int
    latest_reason: Optional[str]


class DashboardSummary(BaseModel):
    month: str
    total_spend: float
    top_categories: list[CategorySpend]
    accounts: list[AccountSummary]
    unreviewed_anomalies: AnomalySummary


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    month: Optional[str] = Query(None, description="YYYY-MM, defaults to current month"),
    db: AsyncSession = Depends(get_db),
) -> DashboardSummary:
    """
    Combined dashboard data: spend totals, account balances, anomaly count.
    """
    if month is None:
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

    year, mo = int(month[:4]), int(month[5:7])
    start = date(year, mo, 1)
    end = date(year + 1, 1, 1) if mo == 12 else date(year, mo + 1, 1)

    # Spending by category
    spend_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount))
        .join(Account, Transaction.account_id == Account.id)
        .where(
            and_(
                Transaction.date >= start,
                Transaction.date < end,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.is_transfer == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.amount > 0,
                Transaction.category != "Transfers",
                Account.subtype.notin_(["savings", "cd", "money market", "checking"]),
            )
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    )
    spend_rows = spend_result.all()
    total_spend = sum(float(r[1]) for r in spend_rows if r[0] is not None)
    top_categories = [
        CategorySpend(category=r[0], total=round(float(r[1]), 2))
        for r in spend_rows
        if r[0] is not None
    ][:8]

    # Accounts
    acct_result = await db.execute(
        select(Account).where(Account.is_active == True)  # noqa: E712
    )
    accounts = [
        AccountSummary(
            id=str(a.id),
            name=a.name,
            type=a.type,
            current_balance=float(a.current_balance) if a.current_balance is not None else None,
            card_slug=a.card_slug,
        )
        for a in acct_result.scalars().all()
    ]

    # Unreviewed anomalies
    anomaly_result = await db.execute(
        select(Anomaly).where(Anomaly.status == "unreviewed").order_by(Anomaly.flagged_at.desc()).limit(1)
    )
    count_result = await db.execute(
        select(func.count()).select_from(Anomaly).where(Anomaly.status == "unreviewed")
    )
    anomaly_count = count_result.scalar_one()
    latest_anomaly = anomaly_result.scalar_one_or_none()

    return DashboardSummary(
        month=month,
        total_spend=round(total_spend, 2),
        top_categories=top_categories,
        accounts=accounts,
        unreviewed_anomalies=AnomalySummary(
            count=anomaly_count,
            latest_reason=latest_anomaly.reason if latest_anomaly else None,
        ),
    )


class SafeToSpendBreakdown(BaseModel):
    monthly_income: float
    spent_this_month: float
    upcoming_bills: float
    goal_savings: float


class SafeToSpend(BaseModel):
    safe_to_spend: float
    color: str  # "green" | "amber" | "red"
    breakdown: SafeToSpendBreakdown
    days_remaining: int


@router.get("/safe-to-spend", response_model=SafeToSpend)
async def safe_to_spend(db: AsyncSession = Depends(get_db)) -> SafeToSpend:
    """
    Safe to Spend: how much you can comfortably spend for the rest of the month.

    Formula:
        safe = monthly_income_est - spent_this_month - upcoming_bills - goal_savings

    Income is derived from trailing 3-month average of deposit transactions
    (amount < 0, not excluded, not transfer).
    """
    today = date.today()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = date(today.year + 1, 1, 1)
    else:
        month_end = date(today.year, today.month + 1, 1)
    days_remaining = (month_end - today).days - 1  # days *after* today

    # 1. Trailing 3-month income estimate — only transactions categorised as
    #    "Income" (salary, payroll, etc). Refunds and credits on expense
    #    categories (gas, medical, rent) are excluded intentionally.
    #    Use exact month arithmetic (not timedelta) so the window is always
    #    exactly 3 calendar months and the /3 divisor is correct.
    cutoff_month = month_start.month - 3
    cutoff_year = month_start.year
    if cutoff_month <= 0:
        cutoff_month += 12
        cutoff_year -= 1
    three_months_ago = date(cutoff_year, cutoff_month, 1)
    income_row = await db.execute(
        text("""
            SELECT COALESCE(SUM(ABS(amount)) / 3.0, 0) AS monthly_income
            FROM transactions
            WHERE date >= :cutoff
              AND date < :month_start
              AND amount < 0
              AND category = 'Income'
              AND is_excluded = FALSE
              AND pending = FALSE
              AND account_id IN (SELECT id FROM accounts WHERE is_active = TRUE)
        """),
        {"cutoff": three_months_ago, "month_start": month_start},
    )
    monthly_income = float(income_row.scalar_one() or 0)

    # 2. Spent this month (expenses only, non-excluded, non-pending, credit cards only)
    spent_row = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .join(Account, Transaction.account_id == Account.id)
        .where(
            and_(
                Transaction.date >= month_start,
                Transaction.date < month_end,
                Transaction.amount > 0,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.is_transfer == False,   # noqa: E712
                Transaction.pending == False,        # noqa: E712
                Account.subtype.notin_(["savings", "cd", "money market", "checking"]),
            )
        )
    )
    spent_this_month = float(spent_row.scalar_one() or 0)

    # 3. Upcoming subscriptions/bills due before month end (after today)
    bills_row = await db.execute(
        select(func.coalesce(func.sum(Subscription.amount), 0)).where(
            and_(
                Subscription.next_expected > today,
                Subscription.next_expected < month_end,
                Subscription.is_active == True,      # noqa: E712
                Subscription.is_cancelled == False,  # noqa: E712
            )
        )
    )
    upcoming_bills = float(bills_row.scalar_one() or 0)

    # 4. Monthly savings target from active goals (remaining / months_to_deadline, floored at 0)
    goals_result = await db.execute(
        select(Goal).where(
            and_(
                Goal.archived == False,  # noqa: E712
                Goal.target_amount > Goal.current_amount,
            )
        )
    )
    goal_savings = 0.0
    for g in goals_result.scalars():
        remaining = float(g.target_amount) - float(g.current_amount)
        if g.deadline:
            months_left = max(1, (g.deadline.year - today.year) * 12 + (g.deadline.month - today.month))
            goal_savings += remaining / months_left
        else:
            # No deadline: assume 12-month horizon
            goal_savings += remaining / 12.0

    # 5. Compute safe-to-spend + color
    safe = monthly_income - spent_this_month - upcoming_bills - goal_savings
    if monthly_income > 0:
        pct = safe / monthly_income
    else:
        pct = 1.0 if safe > 0 else -1.0

    color = "green" if pct > 0.20 else ("amber" if pct >= 0 else "red")

    return SafeToSpend(
        safe_to_spend=round(safe, 2),
        color=color,
        breakdown=SafeToSpendBreakdown(
            monthly_income=round(monthly_income, 2),
            spent_this_month=round(spent_this_month, 2),
            upcoming_bills=round(upcoming_bills, 2),
            goal_savings=round(goal_savings, 2),
        ),
        days_remaining=days_remaining,
    )


class PaceAlert(BaseModel):
    category: str
    budget_amount: float
    actual_spend: float
    projected_spend: float
    days_elapsed: int
    days_in_month: int
    over_by: float          # projected - budget (positive = overspend)
    pct_projected: float    # projected / budget * 100
    severity: str           # "warning" | "danger"


@router.get("/pace-alerts", response_model=list[PaceAlert])
async def pace_alerts(
    month: Optional[str] = Query(None, description="YYYY-MM, defaults to current month"),
    db: AsyncSession = Depends(get_db),
) -> list[PaceAlert]:
    """Return categories that are pacing to overspend their budget this month."""
    today = date.today()
    if month:
        try:
            y, m = int(month[:4]), int(month[5:7])
            month_start = date(y, m, 1)
            import calendar
            days_in_month = calendar.monthrange(y, m)[1]
            month_end = date(y, m, days_in_month)
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
        days_elapsed = min(days_in_month, (today - month_start).days + 1) if today >= month_start else 0
    else:
        import calendar
        month_start = today.replace(day=1)
        days_in_month = calendar.monthrange(today.year, today.month)[1]
        month_end = date(today.year, today.month, days_in_month)
        days_elapsed = today.day
        month = today.strftime("%Y-%m")

    if days_elapsed == 0:
        return []

    # Load all budgets for this month
    from app.models.budget import Budget as BudgetModel
    budgets_result = await db.execute(
        select(BudgetModel).where(
            BudgetModel.month >= month_start,
            BudgetModel.month <= month_end,
        )
    )
    budgets = {b.category: b for b in budgets_result.scalars().all()}
    if not budgets:
        return []

    # Get actual spend per category this month (credit cards only)
    spend_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .join(Account, Transaction.account_id == Account.id)
        .where(
            and_(
                Transaction.date >= month_start,
                Transaction.date <= month_end,
                Transaction.amount > 0,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.is_transfer == False,   # noqa: E712
                Transaction.pending == False,        # noqa: E712
                Transaction.category.in_(list(budgets.keys())),
                Account.subtype.notin_(["savings", "cd", "money market", "checking"]),
            )
        )
        .group_by(Transaction.category)
    )
    actuals = {row.category: float(row.total or 0) for row in spend_result.all()}

    alerts = []
    for category, budget in budgets.items():
        actual = actuals.get(category, 0)
        budget_amt = float(budget.budget_amount)
        if budget_amt <= 0:
            continue
        # Daily run rate → projected end-of-month spend
        daily_rate = actual / days_elapsed
        projected = daily_rate * days_in_month
        pct_projected = (projected / budget_amt) * 100
        over_by = projected - budget_amt

        if pct_projected >= 110:
            severity = "danger"
        elif pct_projected >= 90:
            severity = "warning"
        else:
            continue  # not alarming

        alerts.append(PaceAlert(
            category=category,
            budget_amount=round(budget_amt, 2),
            actual_spend=round(actual, 2),
            projected_spend=round(projected, 2),
            days_elapsed=days_elapsed,
            days_in_month=days_in_month,
            over_by=round(over_by, 2),
            pct_projected=round(pct_projected, 1),
            severity=severity,
        ))

    alerts.sort(key=lambda a: a.pct_projected, reverse=True)
    return alerts


# ── Health Score ──────────────────────────────────────────────────────────────

class HealthFactor(BaseModel):
    name: str
    score: int          # 0–100
    description: str
    color: str          # "green" | "amber" | "red"


class HealthScore(BaseModel):
    score: int          # 0–100 composite
    grade: str          # A / B / C / D / F
    factors: list[HealthFactor]
    has_data: bool      # False when insufficient data to compute


def _grade(score: int) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 65: return "C"
    if score >= 50: return "D"
    return "F"


def _color(score: int) -> str:
    if score >= 70: return "green"
    if score >= 45: return "amber"
    return "red"


@router.get("/health-score", response_model=HealthScore)
async def health_score(db: AsyncSession = Depends(get_db)) -> HealthScore:
    """
    Composite financial health score (0-100) across five dimensions:
      - Budget adherence (25 pts): fraction of budgeted categories on track
      - Savings rate (25 pts): (income - expenses) / income
      - Credit utilization (20 pts): average utilization across credit cards
      - Net worth trend (15 pts): month-over-month net worth direction
      - Emergency fund (15 pts): months of expenses covered by cash
    """
    today = date.today()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = date(today.year + 1, 1, 1)
    else:
        month_end = date(today.year, today.month + 1, 1)
    three_months_ago = (month_start - timedelta(days=90)).replace(day=1)

    factors: list[HealthFactor] = []
    has_data = False

    # ── 1. Budget adherence (25 pts) ─────────────────────────────────────────
    budgets_res = await db.execute(
        select(Budget).where(Budget.month == month_start)
    )
    budgets = budgets_res.scalars().all()

    if budgets:
        spend_res = await db.execute(
            select(Transaction.category, func.sum(Transaction.amount).label("total"))
            .join(Account, Transaction.account_id == Account.id)
            .where(
                Transaction.date >= month_start,
                Transaction.date < month_end,
                Transaction.amount > 0,
                Transaction.is_excluded.is_(False),
                Transaction.is_transfer.is_(False),
                Transaction.pending.is_(False),
                Transaction.category.in_([b.category for b in budgets]),
                Account.subtype.notin_(["savings", "cd", "money market", "checking"]),
            )
            .group_by(Transaction.category)
        )
        actuals = {r.category: float(r.total or 0) for r in spend_res.all()}
        on_track = sum(1 for b in budgets if actuals.get(b.category, 0) <= float(b.budget_amount))
        pct_ok = on_track / len(budgets)
        budget_score = round(pct_ok * 100)
        factors.append(HealthFactor(
            name="Budget adherence",
            score=budget_score,
            description=f"{on_track}/{len(budgets)} categories on track",
            color=_color(budget_score),
        ))
        has_data = True
    else:
        factors.append(HealthFactor(
            name="Budget adherence",
            score=50,
            description="No budgets set for this month",
            color="amber",
        ))

    # ── 2. Savings rate (25 pts) ──────────────────────────────────────────────
    income_res = await db.execute(
        text("""
            SELECT COALESCE(SUM(ABS(amount)) / 3.0, 0)
            FROM transactions
            WHERE date >= :cutoff AND date < :ms
              AND amount < 0 AND is_excluded = FALSE
              AND is_transfer = FALSE AND pending = FALSE
        """),
        {"cutoff": three_months_ago, "ms": month_start},
    )
    monthly_income = float(income_res.scalar_one() or 0)

    expense_res = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Transaction.date >= month_start,
            Transaction.date < month_end,
            Transaction.amount > 0,
            Transaction.is_excluded.is_(False),
            Transaction.is_transfer.is_(False),
            Transaction.pending.is_(False),
            Account.subtype.notin_(["savings", "cd", "money market", "checking"]),
        )
    )
    expenses = float(expense_res.scalar_one() or 0)

    if monthly_income > 0:
        savings_rate = max(0.0, (monthly_income - expenses) / monthly_income)
        # 20%+ savings → 100pts, 10% → 60pts, 0% → 0pts
        savings_score = min(100, round(savings_rate * 5 * 100))
        factors.append(HealthFactor(
            name="Savings rate",
            score=savings_score,
            description=f"{savings_rate * 100:.0f}% of income saved",
            color=_color(savings_score),
        ))
        has_data = True
    else:
        factors.append(HealthFactor(
            name="Savings rate",
            score=50,
            description="Insufficient income data",
            color="amber",
        ))

    # ── 3. Credit utilization (20 pts) ───────────────────────────────────────
    credit_res = await db.execute(
        select(Account).where(
            Account.type == "credit",
            Account.credit_limit.isnot(None),
            Account.credit_limit > 0,
        )
    )
    credit_cards = credit_res.scalars().all()

    if credit_cards:
        total_limit = sum(float(c.credit_limit) for c in credit_cards)
        total_balance = sum(float(c.current_balance or 0) for c in credit_cards)
        utilization = total_balance / total_limit if total_limit > 0 else 0
        # <10% → 100, 10-29% → 80, 30-49% → 60, 50-74% → 35, 75%+ → 0
        if utilization < 0.10:   util_score = 100
        elif utilization < 0.30: util_score = 80
        elif utilization < 0.50: util_score = 60
        elif utilization < 0.75: util_score = 35
        else:                    util_score = 0
        factors.append(HealthFactor(
            name="Credit utilization",
            score=util_score,
            description=f"{utilization * 100:.0f}% average utilization",
            color=_color(util_score),
        ))
        has_data = True
    else:
        factors.append(HealthFactor(
            name="Credit utilization",
            score=75,
            description="No credit cards tracked",
            color="green",
        ))

    # ── 4. Net worth trend (15 pts) ───────────────────────────────────────────
    nw_res = await db.execute(
        select(NetWorthSnapshot.net_worth, NetWorthSnapshot.snapshot_date)
        .where(NetWorthSnapshot.snapshot_date >= three_months_ago)
        .order_by(NetWorthSnapshot.snapshot_date)
    )
    snapshots = nw_res.all()

    if len(snapshots) >= 2:
        nw_start = float(snapshots[0].net_worth)
        nw_end = float(snapshots[-1].net_worth)
        nw_delta = nw_end - nw_start
        if nw_delta > 0:
            nw_score = 100
            nw_desc = f"↑ ${nw_delta:,.0f} net worth gained"
        elif nw_delta == 0:
            nw_score = 70
            nw_desc = "Net worth unchanged"
        else:
            nw_score = max(0, round(50 + (nw_delta / max(abs(nw_start), 1)) * 100))
            nw_desc = f"↓ ${abs(nw_delta):,.0f} net worth lost"
        factors.append(HealthFactor(
            name="Net worth trend",
            score=nw_score,
            description=nw_desc,
            color=_color(nw_score),
        ))
        has_data = True
    else:
        factors.append(HealthFactor(
            name="Net worth trend",
            score=50,
            description="Tracking will improve with more data",
            color="amber",
        ))

    # ── 5. Emergency fund (15 pts) ────────────────────────────────────────────
    cash_res = await db.execute(
        select(func.coalesce(func.sum(Account.current_balance), 0)).where(
            Account.type == "depository",
            Account.subtype.in_(["checking", "savings"]),
        )
    )
    cash = float(cash_res.scalar_one() or 0)

    if monthly_income > 0 and expenses > 0:
        monthly_expenses = expenses  # current month's spend as proxy
        months_covered = cash / max(monthly_expenses, 1)
        # 6+ months → 100, 3-5 → 70, 1-2 → 40, <1 → 10
        if months_covered >= 6:   ef_score = 100
        elif months_covered >= 3: ef_score = 70
        elif months_covered >= 1: ef_score = 40
        else:                     ef_score = 10
        factors.append(HealthFactor(
            name="Emergency fund",
            score=ef_score,
            description=f"{months_covered:.1f} months of expenses",
            color=_color(ef_score),
        ))
    else:
        factors.append(HealthFactor(
            name="Emergency fund",
            score=50,
            description="Insufficient data",
            color="amber",
        ))

    # ── Composite score (weighted) ────────────────────────────────────────────
    weights = [0.25, 0.25, 0.20, 0.15, 0.15]
    composite = round(sum(f.score * w for f, w in zip(factors, weights)))

    return HealthScore(
        score=composite,
        grade=_grade(composite),
        factors=factors,
        has_data=has_data,
    )


class DailySpend(BaseModel):
    date: str       # YYYY-MM-DD
    total: float
    count: int


class WeeklyComparison(BaseModel):
    this_week_total: float
    last_week_total: float
    delta: float            # this_week - last_week (positive = more spent this week)
    delta_pct: float        # % change vs last week
    days_elapsed_this_week: int  # how many days of this week have data (1-7)
    this_week_days: list[DailySpend]
    last_week_days: list[DailySpend]


@router.get("/weekly-comparison", response_model=WeeklyComparison)
async def weekly_comparison(db: AsyncSession = Depends(get_db)) -> WeeklyComparison:
    """
    Compare spending this week vs last week.
    Week boundaries are Mon–Sun. Today's partial day is included.
    """
    today = date.today()
    # Monday of this week
    this_week_start = today - timedelta(days=today.weekday())
    this_week_end   = this_week_start + timedelta(days=7)
    last_week_start = this_week_start - timedelta(days=7)
    last_week_end   = this_week_start

    rows = await db.execute(
        select(
            Transaction.date.label("txn_date"),
            func.sum(Transaction.amount).label("total"),
            func.count().label("count"),
        )
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Transaction.date >= last_week_start,
            Transaction.date < this_week_end,
            Transaction.amount > 0,
            Transaction.is_excluded.is_(False),
            Transaction.is_transfer.is_(False),
            Transaction.pending.is_(False),
            Account.subtype.notin_(["savings", "cd", "money market", "checking"]),
        )
        .group_by(Transaction.date)
        .order_by(Transaction.date)
    )
    by_date: dict[date, tuple[float, int]] = {
        r.txn_date: (float(r.total or 0), int(r.count or 0))
        for r in rows.all()
    }

    def week_days(start: date, end: date) -> list[DailySpend]:
        days = []
        d = start
        while d < end:
            if d > today:
                break
            total, count = by_date.get(d, (0.0, 0))
            days.append(DailySpend(date=d.isoformat(), total=round(total, 2), count=count))
            d += timedelta(days=1)
        return days

    this_days = week_days(this_week_start, this_week_end)
    last_days = week_days(last_week_start, last_week_end)

    this_total = sum(d.total for d in this_days)
    last_total = sum(d.total for d in last_days)
    delta      = round(this_total - last_total, 2)
    delta_pct  = round((delta / last_total * 100) if last_total > 0 else 0.0, 1)
    days_elapsed = today.weekday() + 1  # Mon=0 → 1 day elapsed

    return WeeklyComparison(
        this_week_total=round(this_total, 2),
        last_week_total=round(last_total, 2),
        delta=delta,
        delta_pct=delta_pct,
        days_elapsed_this_week=days_elapsed,
        this_week_days=this_days,
        last_week_days=last_days,
    )
