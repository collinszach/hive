"""Celery task: sync SnapTrade investment account balances daily."""
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.celery_app import app
from app.db import get_sync_db
from app.models.account import Account
from app.models.user import User
from app.snaptrade.connector import get_connector

logger = logging.getLogger(__name__)


@app.task(
    name="app.tasks.snaptrade_sync.sync_snaptrade_balances",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def sync_snaptrade_balances(self) -> dict:
    """
    Fetch current balances for all SnapTrade-connected accounts.
    Runs daily after Plaid sync. Skips gracefully if SnapTrade is not configured.
    """
    connector = get_connector()
    if connector is None:
        logger.info("sync_snaptrade_balances: SnapTrade not configured, skipping")
        return {"updated": 0, "skipped": "not configured"}

    db = get_sync_db()
    try:
        users = db.execute(
            select(User).where(
                User.snaptrade_user_id.isnot(None),
                User.is_active == True,  # noqa: E712
            )
        ).scalars().all()

        total_updated = 0
        for user in users:
            try:
                snaptrade_accounts = connector.get_accounts(
                    snaptrade_user_id=user.snaptrade_user_id,
                    user_secret=user.snaptrade_user_secret,
                )
            except Exception as exc:
                logger.exception("SnapTrade fetch failed for user %s", user.id)
                continue

            for acct_data in snaptrade_accounts:
                acct = db.execute(
                    select(Account).where(
                        Account.snaptrade_account_id == acct_data["id"]
                    )
                ).scalar_one_or_none()

                if acct:
                    acct.current_balance = acct_data["balance"]
                    acct.available_balance = acct_data["balance"]
                    acct.last_synced = datetime.now(timezone.utc)
                    db.add(acct)
                    total_updated += 1

        db.commit()
        logger.info("sync_snaptrade_balances: updated=%d", total_updated)
        return {"updated": total_updated}

    except Exception as exc:
        logger.exception("sync_snaptrade_balances failed")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()
