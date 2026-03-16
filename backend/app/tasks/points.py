"""Celery task: recompute points ledger for recent transactions."""
import logging
from datetime import date, timedelta

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.celery_app import app
from app.db import get_sync_db
from app.models.account import Account
from app.models.points_ledger import PointsLedger
from app.models.transaction import Transaction
from app.points.tracker import compute_points_for_transaction

logger = logging.getLogger(__name__)


@app.task(
    name="app.tasks.points.compute_points_ledger",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def compute_points_ledger(self, days: int = 90) -> dict:
    """
    Recompute points earned for all non-excluded, non-pending transactions
    in the last `days` days. Upserts into points_ledger (one row per transaction).

    Each account must have a card_slug set to attribute points to a program.
    Transactions on accounts without a card_slug are skipped.
    """
    db = get_sync_db()
    try:
        cutoff = date.today() - timedelta(days=days)

        # Load transactions that are eligible for points
        txns = db.execute(
            select(Transaction, Account.card_slug)
            .join(Account, Transaction.account_id == Account.id)
            .where(
                Transaction.date >= cutoff,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Account.card_slug.isnot(None),
            )
        ).all()

        if not txns:
            logger.info("compute_points_ledger: no eligible transactions found")
            return {"computed": 0, "skipped": 0}

        rows = []
        skipped = 0
        for tx, card_slug in txns:
            result = compute_points_for_transaction(
                card_slug=card_slug,
                category=tx.category,
                subcategory=tx.subcategory,
                amount=float(tx.amount),
            )
            if result is None:
                skipped += 1
                continue

            rows.append({
                "transaction_id": tx.id,
                "account_id": tx.account_id,
                "card_slug": result.card_slug,
                "program": result.program,
                "points_earned": result.points_earned,
                "earn_rate": result.earn_rate,
                "category": tx.category,
                "subcategory": tx.subcategory,
            })

        if rows:
            stmt = pg_insert(PointsLedger).values(rows)
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
            db.execute(stmt)
            db.commit()

        logger.info(
            "compute_points_ledger: computed=%d skipped=%d", len(rows), skipped
        )
        return {"computed": len(rows), "skipped": skipped}

    except Exception as exc:
        logger.error("compute_points_ledger failed: %s", exc)
        db.rollback()
        raise self.retry(exc=exc)

    finally:
        db.close()
