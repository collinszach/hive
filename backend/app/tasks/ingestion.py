"""Daily transaction sync task — pulls from all linked Plaid accounts."""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.celery_app import app
from app.db import get_sync_db
from app.ml.categorizer import categorize_transaction
from app.ml.transfer_detector import is_transfer
from app.models.account import Account
from app.models.plaid_link import PlaidLink
from app.models.transaction import Transaction
from app.plaid.connector import plaid_connector

logger = logging.getLogger(__name__)


@app.task(
    name="app.tasks.ingestion.sync_single_link",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def sync_single_link(self, item_id: str) -> dict:
    """Pull incremental transaction updates for one specific Plaid item.

    Called immediately after account connection and by sync_all_accounts.
    Safe to call concurrently — cursor-based sync and plaid_transaction_id
    unique constraint make it fully idempotent.
    """
    db = get_sync_db()
    try:
        link = db.execute(
            select(PlaidLink).where(PlaidLink.item_id == item_id, PlaidLink.is_active == True)  # noqa: E712
        ).scalar_one_or_none()

        if not link:
            logger.warning("sync_single_link: no active link found for item_id=%s", item_id)
            return {"item_id": item_id, "skipped": True}

        added, modified, removed, next_cursor = plaid_connector.sync_transactions(
            access_token=link.access_token,
            cursor=link.sync_cursor,
        )

        accounts = db.execute(
            select(Account).where(Account.plaid_item_id == link.item_id)
        ).scalars().all()
        account_map = {a.plaid_account_id: a.id for a in accounts}

        added_count = _upsert_transactions(db, account_map, added)
        mod_count = _upsert_transactions(db, account_map, modified)
        removed_count = _remove_transactions(db, removed)

        link.sync_cursor = next_cursor
        link.last_sync_at = datetime.now(timezone.utc)
        link.last_sync_error = None
        db.add(link)
        db.commit()

        logger.info(
            "sync_single_link %s: +%d ~%d -%d", item_id, added_count, mod_count, removed_count
        )
        return {"item_id": item_id, "added": added_count, "modified": mod_count, "removed": removed_count}

    except Exception as exc:
        logger.error("Sync failed for link %s: %s", item_id, exc)
        try:
            link = db.execute(
                select(PlaidLink).where(PlaidLink.item_id == item_id)
            ).scalar_one_or_none()
            if link:
                link.last_sync_error = str(exc)
                db.add(link)
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()


@app.task(
    name="app.tasks.ingestion.sync_all_accounts",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def sync_all_accounts(self) -> dict:
    """Fan out to sync_single_link for every active Plaid link."""
    db = get_sync_db()
    try:
        links = db.execute(
            select(PlaidLink).where(PlaidLink.is_active == True)  # noqa: E712
        ).scalars().all()

        if not links:
            logger.info("No active Plaid links found.")
            return {"synced": 0}

        for link in links:
            sync_single_link.delay(link.item_id)
            logger.info("Queued sync for item %s", link.item_id)

        return {"queued": len(links)}
    finally:
        db.close()


def _run_categorizer(description: str, is_xfer: bool) -> dict:
    """Run categorization pipeline. Transfers get a fixed category; others go through pipeline."""
    if is_xfer:
        return {"category": "Transfers", "subcategory": "P2P", "category_source": "rules"}
    try:
        category, subcategory, source = categorize_transaction(description)
        return {"category": category, "subcategory": subcategory, "category_source": source}
    except Exception as exc:
        logger.error("Categorization error for '%s': %s", description, exc)
        return {"category": "Uncategorized", "subcategory": "Uncategorized", "category_source": "uncategorized"}


def _plaid_tx_to_dict(account_map: dict, tx) -> Optional[dict]:
    """Convert a Plaid transaction object to a dict for upsert."""
    account_id = account_map.get(tx["account_id"])
    if account_id is None:
        logger.warning("Unknown account_id in Plaid tx: %s", tx.get("account_id"))
        return None

    raw_desc = (
        tx.get("original_description")
        or tx.get("merchant_name")
        or tx.get("name")
        or ""
    )
    tx_is_transfer, tx_is_excluded = is_transfer(raw_desc)

    tx_date = tx.get("date")
    if hasattr(tx_date, "isoformat"):
        tx_date = tx_date
    elif isinstance(tx_date, str):
        from datetime import date as date_type
        tx_date = date_type.fromisoformat(tx_date)

    auth_date = tx.get("authorized_date")
    if isinstance(auth_date, str):
        from datetime import date as date_type
        auth_date = date_type.fromisoformat(auth_date)

    plaid_cat = tx.get("category") or []
    location = tx.get("location") or {}

    logo_url = None
    counterparty = tx.get("counterparties") or []
    if counterparty:
        logo_url = counterparty[0].get("logo_url")

    return {
        "plaid_transaction_id": tx["transaction_id"],
        "account_id": account_id,
        "date": tx_date,
        "authorized_date": auth_date,
        "amount": tx["amount"],
        "currency": tx.get("iso_currency_code") or "USD",
        "merchant": tx.get("merchant_name"),
        "raw_description": raw_desc,
        **_run_categorizer(raw_desc, tx_is_transfer),
        "plaid_category": plaid_cat if plaid_cat else None,
        "is_transfer": tx_is_transfer,
        "is_excluded": tx_is_excluded,
        "pending": tx.get("pending", False),
        "payment_channel": tx.get("payment_channel"),
        "location_address": location.get("address"),
        "location_city": location.get("city"),
        "location_state": location.get("region"),
        "location_zip": location.get("postal_code"),
        "logo_url": logo_url,
        "website": tx.get("website"),
    }


def _upsert_transactions(db, account_map: dict, transactions: list) -> int:
    """Upsert a batch of Plaid transactions. Returns count upserted."""
    if not transactions:
        return 0

    rows = []
    for tx in transactions:
        row = _plaid_tx_to_dict(account_map, tx)
        if row:
            rows.append(row)

    if not rows:
        return 0

    stmt = pg_insert(Transaction).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["plaid_transaction_id"],
        set_={
            "amount": stmt.excluded.amount,
            "pending": stmt.excluded.pending,
            "merchant": stmt.excluded.merchant,
            "raw_description": stmt.excluded.raw_description,
            "payment_channel": stmt.excluded.payment_channel,
            "logo_url": stmt.excluded.logo_url,
            "is_transfer": stmt.excluded.is_transfer,
            "is_excluded": stmt.excluded.is_excluded,
        },
    )
    db.execute(stmt)
    db.commit()
    return len(rows)


def _remove_transactions(db, removed: list) -> int:
    """Delete transactions Plaid has marked as removed."""
    if not removed:
        return 0

    removed_ids = [tx["transaction_id"] for tx in removed]
    result = db.execute(
        Transaction.__table__.delete().where(
            Transaction.plaid_transaction_id.in_(removed_ids)
        )
    )
    db.commit()
    count = result.rowcount
    logger.info("Removed %d transactions", count)
    return count
