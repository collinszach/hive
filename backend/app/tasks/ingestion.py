"""Daily transaction sync task — pulls from all linked Plaid accounts."""
import logging
import re as _re
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.celery_app import app
from app.db import get_sync_db
from app.ml.categorizer import categorize_transaction
from app.ml.transfer_detector import classify_transfer_subcategory, is_transfer
from app.models.account import Account
from app.models.plaid_link import PlaidLink
from app.models.transaction import Transaction
from app.plaid.connector import plaid_connector

logger = logging.getLogger(__name__)


def _compute_statement_balance(db, acct: Account) -> Optional[float]:
    """
    Compute the statement balance for a credit account.

    Statement balance = current_balance − posted charges since the last statement closed.
    The last statement close date is the most recent occurrence of statement_close_day
    that is in the past.
    """
    if acct.current_balance is None or not acct.statement_close_day:
        return None

    today = date.today()
    close_day = acct.statement_close_day

    # Find the most recent statement close date
    if today.day >= close_day:
        last_close = today.replace(day=close_day)
    else:
        # Close day hasn't happened this month yet — use last month
        if today.month == 1:
            last_close = date(today.year - 1, 12, close_day)
        else:
            import calendar
            max_day = calendar.monthrange(today.year, today.month - 1)[1]
            last_close = date(today.year, today.month - 1, min(close_day, max_day))

    # Sum of posted, non-excluded, non-transfer positive charges since statement closed
    row = db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.account_id == acct.id,
            Transaction.date > last_close,
            Transaction.amount > 0,
            Transaction.pending == False,  # noqa: E712
            Transaction.is_excluded == False,  # noqa: E712
            Transaction.is_transfer == False,  # noqa: E712
        )
    ).scalar()

    new_charges = float(row or 0)
    statement_bal = float(acct.current_balance) - new_charges
    return round(max(0.0, statement_bal), 2)


def _apply_custom_rules(description: str, rules: list) -> tuple[str, str, str] | None:
    """
    Check active custom DB rules against a transaction description.
    Rules are pre-sorted by priority (lower = higher precedence).
    Returns (category, subcategory, source) or None if no rule matches.
    """
    desc_lower = description.lower()
    for rule in rules:
        matched = False
        mt, mv = rule.match_type, rule.match_value
        if mt == "contains":
            matched = mv.lower() in desc_lower
        elif mt == "starts_with":
            matched = desc_lower.startswith(mv.lower())
        elif mt == "exact":
            matched = desc_lower == mv.lower()
        elif mt == "regex":
            try:
                matched = bool(_re.search(mv, description, _re.IGNORECASE))
            except _re.error:
                logger.warning("Invalid regex in custom rule: %s", mv)
        if matched:
            return rule.category, rule.subcategory or "", "custom_rule"
    return None


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
            select(Account).where(
                Account.plaid_item_id == link.item_id,
                Account.is_active == True,  # noqa: E712 — exclude stale re-linked accounts
            )
        ).scalars().all()
        account_map = {a.plaid_account_id: a.id for a in accounts}

        added_count = _upsert_transactions(db, account_map, added)
        mod_count = _upsert_transactions(db, account_map, modified)
        removed_count = _remove_transactions(db, removed)

        # Refresh account balances from Plaid
        try:
            plaid_accounts = plaid_connector.get_accounts(link.access_token)
            for pa in plaid_accounts:
                acct = db.execute(
                    select(Account).where(Account.plaid_account_id == pa["account_id"])
                ).scalar_one_or_none()
                if acct:
                    balances = pa.get("balances") or {}
                    acct.current_balance = balances.get("current")
                    acct.available_balance = balances.get("available")
                    acct.credit_limit = balances.get("limit")
                    # Compute statement balance for credit accounts
                    if acct.type == "credit" and acct.statement_close_day:
                        acct.statement_balance = _compute_statement_balance(db, acct)
                    db.add(acct)
            db.commit()
            logger.info("Refreshed balances for %d accounts on item %s", len(plaid_accounts), item_id)
        except Exception as bal_exc:
            logger.warning("Balance refresh failed for item %s: %s", item_id, bal_exc)

        link.sync_cursor = next_cursor
        link.last_sync_at = datetime.now(timezone.utc)
        link.last_sync_error = None
        db.add(link)
        db.commit()

        # Update net worth snapshot with fresh balances
        from app.tasks.maintenance import snapshot_net_worth
        snapshot_net_worth.delay()

        logger.info(
            "sync_single_link %s: +%d ~%d -%d", item_id, added_count, mod_count, removed_count
        )
        return {"item_id": item_id, "added": added_count, "modified": mod_count, "removed": removed_count}

    except Exception as exc:
        logger.exception("Sync failed for link %s", item_id)
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


@app.task(
    name="app.tasks.ingestion.recategorize_uncategorized",
    bind=True,
    max_retries=2,
)
def recategorize_uncategorized(self) -> dict:
    """Re-run the categorization pipeline on all Uncategorized transactions.

    Also re-runs transfer detection so newly-matched autopay/transfer
    patterns get is_excluded set correctly.
    """
    db = get_sync_db()
    try:
        rows = db.execute(
            select(Transaction).where(Transaction.category == "Uncategorized")
        ).scalars().all()

        updated = 0
        for tx in rows:
            tx_is_transfer, tx_is_excluded = is_transfer(tx.raw_description)
            if tx_is_transfer:
                cat, sub, source = "Transfers", classify_transfer_subcategory(tx.raw_description), "rules"
            else:
                try:
                    cat, sub, source = categorize_transaction(tx.raw_description)
                except Exception:
                    continue

            if cat != "Uncategorized":
                tx.category = cat
                tx.subcategory = sub
                tx.category_source = source
                tx.is_transfer = tx_is_transfer
                tx.is_excluded = tx_is_excluded
                db.add(tx)
                updated += 1

        db.commit()
        logger.info("recategorize_uncategorized: updated %d transactions", updated)
        return {"updated": updated}
    finally:
        db.close()


def _run_categorizer(description: str, is_xfer: bool, plaid_category: list | None = None) -> dict:
    """Run categorization pipeline. Transfers get a fixed category; others go through pipeline."""
    if is_xfer:
        subcategory = classify_transfer_subcategory(description)
        return {"category": "Transfers", "subcategory": subcategory, "category_source": "rules"}
    try:
        category, subcategory, source = categorize_transaction(description, plaid_category=plaid_category)
        return {"category": category, "subcategory": subcategory, "category_source": source}
    except Exception as exc:
        logger.error("Categorization error for '%s': %s", description, exc)
        return {"category": "Uncategorized", "subcategory": "Uncategorized", "category_source": "uncategorized"}


def _plaid_tx_to_dict(account_map: dict, tx, custom_rules: list) -> Optional[dict]:
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

    # Custom DB rules take priority over the ML pipeline (but not over transfer detection).
    # Rules are pre-sorted by priority (lower int = higher precedence).
    categorization: dict
    if not tx_is_transfer and custom_rules:
        rule_result = _apply_custom_rules(raw_desc, custom_rules)
        if rule_result:
            cat, sub, source = rule_result
            categorization = {"category": cat, "subcategory": sub or "", "category_source": source}
        else:
            categorization = _run_categorizer(raw_desc, tx_is_transfer, plaid_category=plaid_cat or None)
    else:
        categorization = _run_categorizer(raw_desc, tx_is_transfer, plaid_category=plaid_cat or None)

    return {
        "plaid_transaction_id": tx["transaction_id"],
        "account_id": account_id,
        "date": tx_date,
        "authorized_date": auth_date,
        "amount": tx["amount"],
        "currency": tx.get("iso_currency_code") or "USD",
        "merchant": tx.get("merchant_name"),
        "raw_description": raw_desc,
        **categorization,
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

    # Load active custom rules once per batch so they run BEFORE the ML pipeline.
    # Sorted by priority ascending (lower int = higher precedence).
    from app.models.categorization_rule import CategorizationRule
    custom_rules = db.execute(
        select(CategorizationRule)
        .where(CategorizationRule.is_active.is_(True))
        .order_by(CategorizationRule.priority)
    ).scalars().all()

    rows = []
    for tx in transactions:
        row = _plaid_tx_to_dict(account_map, tx, custom_rules)
        if row:
            rows.append(row)

    if not rows:
        return 0

    from sqlalchemy import case as sa_case

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
            # Re-categorize on modify, but never overwrite a manual override.
            "category": sa_case(
                (Transaction.category_source == "manual", Transaction.category),
                else_=stmt.excluded.category,
            ),
            "subcategory": sa_case(
                (Transaction.category_source == "manual", Transaction.subcategory),
                else_=stmt.excluded.subcategory,
            ),
            "category_source": sa_case(
                (Transaction.category_source == "manual", Transaction.category_source),
                else_=stmt.excluded.category_source,
            ),
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


@app.task(
    name="app.tasks.ingestion.apply_custom_rules_to_all",
    bind=True,
    max_retries=2,
)
def apply_custom_rules_to_all(self) -> dict:
    """
    Apply all active custom categorization rules to ALL non-excluded transactions.
    Runs after a rule is created/modified from the Settings page.
    Skips transactions already correctly categorized by the rule.
    """
    from app.models.categorization_rule import CategorizationRule

    db = get_sync_db()
    try:
        rules = db.execute(
            select(CategorizationRule)
            .where(CategorizationRule.is_active.is_(True))
            .order_by(CategorizationRule.priority)
        ).scalars().all()

        if not rules:
            logger.info("apply_custom_rules_to_all: no active rules")
            return {"updated": 0}

        txns = db.execute(
            select(Transaction).where(Transaction.is_excluded == False)  # noqa: E712
        ).scalars().all()

        updated = 0
        for tx in txns:
            result = _apply_custom_rules(tx.raw_description, rules)
            if result:
                cat, sub, source = result
                sub = sub or None
                if tx.category != cat or tx.subcategory != sub:
                    tx.category = cat
                    tx.subcategory = sub
                    tx.category_source = source
                    db.add(tx)
                    updated += 1

        db.commit()
        logger.info("apply_custom_rules_to_all: updated %d transactions", updated)
        return {"updated": updated}
    finally:
        db.close()
