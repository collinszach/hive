"""Intelligence tasks: subscription detection + proactive insights generation."""
import logging
import re
import uuid
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select, text

from app.analytics.spend import net_spend_sql
from app.celery_app import app as celery_app
from app.db import SyncSessionLocal
from app.models.budget import Budget
from app.models.insight import Insight
from app.models.subscription import Subscription
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

# Spend insights/budget-pace alerts net out expense shares, matching budgets.
_NET = net_spend_sql("transactions")

# Minimum occurrences to classify as a subscription
_MIN_CHARGES = 2
# Patterns that indicate a recurring service
_SUBSCRIPTION_PATTERNS = re.compile(
    r"(?i)(netflix|spotify|hulu|disney|apple\.com|amazon prime|youtube premium|"
    r"openai|chatgpt|github|dropbox|icloud|google one|adobe|notion|"
    r"paramount|peacock|hbo|siriusxm|audible|duolingo|grammarly|"
    r"zoom|slack|figma|linear|aws|digitalocean|linode|cloudflare|"
    r"nordvpn|expressvpn|1password|lastpass|dashlane)"
)


@celery_app.task(
    name="app.tasks.intelligence.detect_subscriptions",
    bind=True,
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
)
def detect_subscriptions(self) -> dict:
    """Scan last 90 days of transactions and upsert detected subscriptions."""
    logger.info("Starting subscription detection")
    cutoff = date.today() - timedelta(days=90)

    with SyncSessionLocal() as session:
        txns = session.execute(
            select(Transaction).where(
                Transaction.date >= cutoff,
                Transaction.amount > 0,
                Transaction.is_excluded.is_(False),
                Transaction.is_transfer.is_(False),
                Transaction.pending.is_(False),
            )
        ).scalars().all()

    # Group by normalized merchant name
    by_merchant: dict[str, list[Transaction]] = defaultdict(list)
    for txn in txns:
        name = (txn.merchant or txn.raw_description or "").strip().lower()
        # Remove noise: trailing card numbers, dates, etc.
        name = re.sub(r"\s+\d{4,}$", "", name)
        name = re.sub(r"\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d+", "", name)
        if name:
            by_merchant[name].append(txn)

    detected = 0
    with SyncSessionLocal() as session:
        for normalized, charges in by_merchant.items():
            if len(charges) < _MIN_CHARGES:
                continue

            # Must match known subscription pattern OR have similar amounts recurring monthly
            amounts = [float(t.amount) for t in charges]
            dates_sorted = sorted(t.date for t in charges)

            # Check if amounts are consistent (within 5%)
            avg_amt = sum(amounts) / len(amounts)
            consistent = all(abs(a - avg_amt) / avg_amt < 0.05 for a in amounts if avg_amt > 0)

            is_known = bool(_SUBSCRIPTION_PATTERNS.search(normalized))
            if not is_known and not consistent:
                continue

            # Determine frequency
            if len(dates_sorted) >= 2:
                gaps = [(dates_sorted[i + 1] - dates_sorted[i]).days for i in range(len(dates_sorted) - 1)]
                avg_gap = sum(gaps) / len(gaps)
                if avg_gap < 10:
                    frequency = "weekly"
                elif avg_gap < 45:
                    frequency = "monthly"
                elif avg_gap < 100:
                    frequency = "quarterly"
                else:
                    frequency = "annual"
            else:
                frequency = "monthly"

            # Annual cost projection
            annual_cost = (
                avg_amt * 52 if frequency == "weekly" else
                avg_amt * 12 if frequency == "monthly" else
                avg_amt * 4 if frequency == "quarterly" else
                avg_amt
            )

            # Check for price changes
            first_amount = float(charges[0].amount)
            last_amount = float(charges[-1].amount)
            price_changed = abs(last_amount - first_amount) > 0.01

            # Upsert
            existing = session.execute(
                select(Subscription).where(Subscription.normalized_name == normalized)
            ).scalar_one_or_none()

            representative = charges[-1]
            merchant_display = representative.merchant or representative.raw_description or normalized

            if existing:
                existing.last_charged = dates_sorted[-1]
                existing.charge_count = len(charges)
                existing.annual_cost = annual_cost
                if price_changed and existing.amount != last_amount:
                    existing.previous_amount = existing.amount
                    existing.amount = last_amount
                    existing.price_changed_at = date.today()
            else:
                sub = Subscription(
                    id=uuid.uuid4(),
                    merchant_name=merchant_display,
                    normalized_name=normalized,
                    amount=avg_amt,
                    frequency=frequency,
                    category=representative.category,
                    subcategory=representative.subcategory,
                    last_charged=dates_sorted[-1],
                    charge_count=len(charges),
                    annual_cost=annual_cost,
                )
                session.add(sub)
                detected += 1

        # Mark all matched transactions as is_subscription=True
        session.execute(
            text("""
                UPDATE transactions t
                SET is_subscription = TRUE
                FROM subscriptions s
                WHERE LOWER(COALESCE(t.merchant, t.raw_description, '')) = s.normalized_name
                  AND s.is_active = TRUE
                  AND NOT t.is_excluded
            """)
        )
        session.commit()

    logger.info("Subscription detection complete: %d new", detected)
    return {"detected": detected}


@celery_app.task(
    name="app.tasks.intelligence.generate_insights",
    bind=True,
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
)
def generate_insights(self) -> dict:
    """Generate proactive insights from recent transaction data.

    Insight types produced:
      - spending_spike: category spend ≥30% above 3-month average
      - large_transaction: charges >$200 with context vs. typical spend
      - budget_alert: budget ≥80% used with days remaining
      - subscription_price_change: subscription amount increased
      - reward_threshold: points balance above redemption nudge threshold
    """
    logger.info("Generating proactive insights")
    generated = 0

    with SyncSessionLocal() as session:
        today = date.today()
        month_start = today.replace(day=1)

        # ------------------------------------------------------------------ #
        # 1. SPENDING SPIKE — compare this month's category totals to the     #
        #    average of the prior 3 complete months                            #
        # ------------------------------------------------------------------ #
        three_months_ago_start = (month_start - timedelta(days=1)).replace(day=1)
        three_months_ago_start = (three_months_ago_start - timedelta(days=1)).replace(day=1)
        three_months_ago_start = (three_months_ago_start - timedelta(days=1)).replace(day=1)

        this_month_spend: list = session.execute(
            text("""
                SELECT category, SUM(""" + _NET + """) AS total
                FROM transactions
                WHERE date >= :start AND NOT is_excluded AND NOT is_transfer
                  AND NOT pending AND amount > 0
                GROUP BY category
            """),
            {"start": month_start},
        ).fetchall()

        # Average monthly spend per category over the prior 3 full months
        prior_avg_rows: list = session.execute(
            text("""
                SELECT
                    category,
                    SUM(""" + _NET + """) / 3.0 AS avg_monthly
                FROM transactions
                WHERE date >= :start AND date < :end
                  AND NOT is_excluded AND NOT is_transfer
                  AND NOT pending AND amount > 0
                GROUP BY category
            """),
            {"start": three_months_ago_start, "end": month_start},
        ).fetchall()

        prior_avg_map: dict[str, float] = {
            row.category: float(row.avg_monthly or 0) for row in prior_avg_rows
        }

        for row in this_month_spend:
            if not row.category:
                continue
            avg_3m = prior_avg_map.get(row.category, 0.0)
            this = float(row.total or 0)
            if avg_3m > 10 and this > avg_3m * 1.3:  # ≥30% above 3-month avg
                delta_pct = (this - avg_3m) / avg_3m * 100
                dedup_key = f"spending_spike:{row.category}:{today.strftime('%Y-%m')}"
                exists = session.execute(
                    select(Insight).where(Insight.dedup_key == dedup_key)
                ).scalar_one_or_none()
                if not exists:
                    session.add(Insight(
                        id=uuid.uuid4(),
                        insight_type="spending_spike",
                        title=f"{row.category} spending up {delta_pct:.0f}%",
                        body=(
                            f"You've spent ${this:.0f} on {row.category} this month, "
                            f"{delta_pct:.0f}% higher than your 3-month average of ${avg_3m:.0f}."
                        ),
                        amount=this,
                        delta_pct=delta_pct,
                        category=row.category,
                        priority="high" if delta_pct > 50 else "medium",
                        dedup_key=dedup_key,
                    ))
                    generated += 1

        # ------------------------------------------------------------------ #
        # 2. LARGE TRANSACTION — charges >$200 this month, with context       #
        #    vs. typical spend at that merchant                                #
        # ------------------------------------------------------------------ #
        large_txns: list = session.execute(
            text("""
                SELECT
                    t.id,
                    t.amount,
                    COALESCE(t.merchant, t.raw_description) AS merchant,
                    t.category,
                    t.subcategory,
                    COALESCE(hist.avg_amount, 0) AS typical_amount
                FROM transactions t
                LEFT JOIN LATERAL (
                    SELECT AVG(h.amount) AS avg_amount
                    FROM transactions h
                    WHERE COALESCE(h.merchant, h.raw_description) =
                          COALESCE(t.merchant, t.raw_description)
                      AND h.date < :month_start
                      AND h.date >= :hist_start
                      AND NOT h.is_excluded AND NOT h.is_transfer AND NOT h.pending
                ) hist ON true
                WHERE t.date >= :month_start
                  AND t.amount > 200
                  AND NOT t.is_excluded
                  AND NOT t.is_transfer
                  AND NOT t.pending
                ORDER BY t.amount DESC
                LIMIT 5
            """),
            {"month_start": month_start, "hist_start": today - timedelta(days=365)},
        ).fetchall()

        for txn in large_txns:
            dedup_key = f"large_txn:{txn.id}"
            exists = session.execute(
                select(Insight).where(Insight.dedup_key == dedup_key)
            ).scalar_one_or_none()
            if not exists:
                typical = float(txn.typical_amount or 0)
                amt = float(txn.amount)
                if typical > 5:
                    ratio = amt / typical
                    body = (
                        f"${amt:.2f} at {txn.merchant} — "
                        f"{ratio:.1f}x your typical spend there (avg ${typical:.0f})."
                    )
                else:
                    body = f"${amt:.2f} at {txn.merchant} this month."
                session.add(Insight(
                    id=uuid.uuid4(),
                    insight_type="large_transaction",
                    title=f"Large charge: ${amt:.0f} at {txn.merchant}",
                    body=body,
                    amount=amt,
                    category=txn.category,
                    linked_entity_type="transaction",
                    linked_entity_id=str(txn.id),
                    priority="medium",
                    dedup_key=dedup_key,
                ))
                generated += 1

        # ------------------------------------------------------------------ #
        # 3. BUDGET ALERT — ≥80% of budget consumed with ≥5 days remaining   #
        # ------------------------------------------------------------------ #
        budgets: list[Budget] = session.execute(
            select(Budget).where(Budget.month == month_start)
        ).scalars().all()

        days_in_month = (
            (month_start.replace(month=month_start.month % 12 + 1, day=1)
             if month_start.month < 12
             else month_start.replace(year=month_start.year + 1, month=1, day=1))
            - timedelta(days=1)
        ).day
        days_remaining = days_in_month - today.day + 1

        if budgets and days_remaining >= 1:
            # Get actual spend per category this month in one query
            spend_rows: list = session.execute(
                text("""
                    SELECT category, SUM(""" + _NET + """) AS total
                    FROM transactions
                    WHERE date >= :start AND NOT is_excluded AND NOT is_transfer
                      AND NOT pending AND amount > 0
                    GROUP BY category
                """),
                {"start": month_start},
            ).fetchall()
            spend_map: dict[str, float] = {r.category: float(r.total or 0) for r in spend_rows}

            for budget in budgets:
                spent = spend_map.get(budget.category, 0.0)
                budget_amt = float(budget.budget_amount)
                if budget_amt <= 0:
                    continue
                pct_used = spent / budget_amt * 100
                if pct_used < 80:
                    continue

                dedup_key = f"budget_alert:{budget.category}:{today.strftime('%Y-%m')}"
                exists = session.execute(
                    select(Insight).where(Insight.dedup_key == dedup_key)
                ).scalar_one_or_none()
                if not exists:
                    if pct_used >= 100:
                        title = f"{budget.category} budget exceeded"
                        body = (
                            f"You've spent ${spent:.0f} on {budget.category} this month, "
                            f"${spent - budget_amt:.0f} over your ${budget_amt:.0f} budget "
                            f"with {days_remaining} day{'s' if days_remaining != 1 else ''} left."
                        )
                        priority = "high"
                    else:
                        title = f"{budget.category} budget {pct_used:.0f}% used"
                        body = (
                            f"You've used {pct_used:.0f}% of your {budget.category} budget "
                            f"(${spent:.0f} of ${budget_amt:.0f}) with "
                            f"{days_remaining} day{'s' if days_remaining != 1 else ''} remaining."
                        )
                        priority = "high" if pct_used >= 95 else "medium"
                    session.add(Insight(
                        id=uuid.uuid4(),
                        insight_type="budget_alert",
                        title=title,
                        body=body,
                        amount=spent,
                        delta_pct=pct_used,
                        category=budget.category,
                        priority=priority,
                        dedup_key=dedup_key,
                    ))
                    generated += 1

        # ------------------------------------------------------------------ #
        # 4. SUBSCRIPTION PRICE CHANGE — subscriptions whose price changed    #
        #    within the last 30 days                                           #
        # ------------------------------------------------------------------ #
        price_change_cutoff = today - timedelta(days=30)
        changed_subs: list[Subscription] = session.execute(
            select(Subscription).where(
                Subscription.price_changed_at >= price_change_cutoff,
                Subscription.previous_amount.isnot(None),
            )
        ).scalars().all()

        for sub in changed_subs:
            dedup_key = f"sub_price_change:{sub.id}:{sub.price_changed_at}"
            exists = session.execute(
                select(Insight).where(Insight.dedup_key == dedup_key)
            ).scalar_one_or_none()
            if not exists:
                prev = float(sub.previous_amount)
                curr = float(sub.amount)
                delta = curr - prev
                direction = "raised" if delta > 0 else "lowered"
                session.add(Insight(
                    id=uuid.uuid4(),
                    insight_type="subscription_price_change",
                    title=f"{sub.merchant_name} price {direction}",
                    body=(
                        f"{sub.merchant_name} {direction} its price from "
                        f"${prev:.2f} to ${curr:.2f} "
                        f"(${abs(delta):.2f}/{'month' if sub.frequency == 'monthly' else sub.frequency})."
                    ),
                    amount=curr,
                    delta_pct=(delta / prev * 100) if prev > 0 else None,
                    linked_entity_type="subscription",
                    linked_entity_id=str(sub.id),
                    priority="high" if abs(delta) >= 2 else "medium",
                    dedup_key=dedup_key,
                ))
                generated += 1

        session.commit()

    logger.info("Generated %d insights", generated)
    return {"generated": generated}


@celery_app.task(
    name="app.tasks.intelligence.weekly_insight_digest",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def weekly_insight_digest(self) -> dict:
    """Push a weekly digest summarizing the highest-priority fresh insight.

    Runs after the week's insights are generated. Picks the most important unread,
    undismissed, unexpired insight and sends it as a single push (no per-insight spam).
    """
    from app.notifications.push import send_to_all

    _PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}

    with SyncSessionLocal() as session:
        recent = (
            session.execute(
                select(Insight).where(
                    Insight.is_read.is_(False),
                    Insight.is_dismissed.is_(False),
                )
            )
            .scalars()
            .all()
        )
        # Only insights from the last 7 days are "this week's".
        cutoff = date.today() - timedelta(days=7)
        fresh = [
            i
            for i in recent
            if i.created_at is not None and i.created_at.date() >= cutoff
        ]
        if not fresh:
            logger.info("weekly_insight_digest: no fresh insights to surface")
            return {"sent": 0}

        fresh.sort(key=lambda i: _PRIORITY_RANK.get(i.priority or "medium", 1))
        top = fresh[0]
        extra = len(fresh) - 1
        title = top.title
        body = top.body
        if extra > 0:
            body = f"{body}  (+{extra} more this week)"

        try:
            sent = send_to_all(
                session,
                title=title,
                body=body,
                data={"route": "insights"},
                thread_id="weekly-digest",
            )
        except Exception as exc:
            logger.exception("weekly_insight_digest push failed")
            raise self.retry(exc=exc)

    logger.info("weekly_insight_digest: surfaced '%s' to %d devices", top.title, sent)
    return {"sent": sent, "fresh": len(fresh)}
