"""Celery task: raise award-redemption candidates from the transaction feed.

Detection never touches a balance. It creates ``points_redemptions`` rows in the
``candidate`` state for review, because the one thing the feed can't reveal is how
many points a ticket cost.
"""
import logging
from datetime import date, timedelta

from sqlalchemy import select

from app.celery_app import app
from app.db import get_sync_db
from app.models.points_redemption import PointsRedemption
from app.models.transaction import Transaction
from app.points.redemption_detector import classify_award_fee

logger = logging.getLogger(__name__)

# A fare and its taxes post together. If a big charge from the same merchant sits
# within this window, the small one is that booking's extras — a seat, a bag — not
# an award.
FARE_WINDOW_DAYS = 3
# What counts as "a fare was actually paid here".
FARE_MIN = 150.00


@app.task(
    name="app.tasks.redemptions.detect_award_redemptions",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def detect_award_redemptions(self, days: int = 400) -> dict:
    """Scan recent transactions for award-fee fingerprints.

    Idempotent: ``points_redemptions.transaction_id`` is unique, and any transaction
    already reviewed (confirmed or dismissed) is left alone, so re-running never
    resurrects something the user has already judged.
    """
    db = get_sync_db()
    try:
        cutoff = date.today() - timedelta(days=days)

        txns = db.execute(
            select(Transaction).where(
                Transaction.date >= cutoff,
                Transaction.amount > 0,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
            )
        ).scalars().all()

        # Every transaction already has a row — don't re-raise a dismissed candidate.
        seen = {
            r[0] for r in db.execute(select(PointsRedemption.transaction_id)).all()
            if r[0] is not None
        }

        # Merchant → dates on which a fare-sized charge posted, for suppression.
        fare_dates: dict[str, list[date]] = {}
        for tx in txns:
            if float(tx.amount) >= FARE_MIN:
                key = (tx.merchant or tx.raw_description or "").lower()
                fare_dates.setdefault(key, []).append(tx.date)

        created = 0
        suppressed = 0
        for tx in txns:
            if tx.id in seen:
                continue
            reason = classify_award_fee(
                merchant=tx.merchant,
                raw_description=tx.raw_description,
                amount=float(tx.amount),
                category=tx.category,
                subcategory=tx.subcategory,
            )
            if reason is None:
                continue

            key = (tx.merchant or tx.raw_description or "").lower()
            if any(abs((d - tx.date).days) <= FARE_WINDOW_DAYS for d in fare_dates.get(key, [])):
                suppressed += 1
                continue

            db.add(PointsRedemption(
                transaction_id=tx.id,
                redeemed_on=tx.date,
                merchant=tx.merchant or tx.raw_description,
                fees_paid=tx.amount,
                status="candidate",
                detection_reason=reason,
            ))
            created += 1

        db.commit()
        logger.info(
            "detect_award_redemptions: %d candidates created, %d suppressed by a nearby fare",
            created, suppressed,
        )
        return {"created": created, "suppressed": suppressed, "scanned": len(txns)}
    finally:
        db.close()
