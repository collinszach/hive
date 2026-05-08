"""Maintenance Celery tasks — net worth snapshots and materialized view refresh."""
import logging
from datetime import date, datetime, timezone

from sqlalchemy import text

from app.celery_app import app
from app.db import get_sync_db

logger = logging.getLogger(__name__)


@app.task(
    name="app.tasks.maintenance.snapshot_net_worth",
    bind=True,
    max_retries=3,
    default_retry_delay=120,
)
def snapshot_net_worth(self) -> dict:
    """
    Snapshot all account balances into net_worth_snapshots.
    Sums assets (depository) and liabilities (credit) separately.
    Upserts on today's date to allow re-running idempotently.
    """
    from sqlalchemy import select, func
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.account import Account
    from app.models.net_worth import NetWorthSnapshot

    db = get_sync_db()
    try:
        accounts = db.execute(
            select(Account).where(
                Account.is_active == True,  # noqa: E712
                Account.is_excluded == False,  # noqa: E712
            )
        ).scalars().all()

        total_assets = 0.0
        total_liabilities = 0.0
        breakdown: dict[str, float] = {}

        # Build a set of account names that appear more than once so we can
        # disambiguate them in the breakdown dict (otherwise duplicate names
        # silently overwrite each other).
        name_counts: dict[str, int] = {}
        for acct in accounts:
            name_counts[acct.name] = name_counts.get(acct.name, 0) + 1

        name_seen: dict[str, int] = {}

        def _breakdown_key(acct, suffix: str) -> str:
            """Return a unique breakdown key, appending institution when the name is shared."""
            if name_counts.get(acct.name, 1) > 1:
                inst = acct.institution or str(acct.id)[:8]
                # Further disambiguate with a counter if institution is also shared
                base = f"{acct.name} · {inst} ({suffix})"
            else:
                base = f"{acct.name} ({suffix})"
            # Final safety: append counter if base key still collides
            count = name_seen.get(base, 0)
            name_seen[base] = count + 1
            return base if count == 0 else f"{base} #{count + 1}"

        for acct in accounts:
            balance = float(acct.current_balance or 0)
            acct_type = acct.type.lower()

            if acct_type in ("depository", "investment", "brokerage", "other"):
                total_assets += balance
                breakdown[_breakdown_key(acct, "asset")] = round(balance, 2)
            elif acct_type in ("credit", "loan", "mortgage"):
                total_liabilities += abs(balance)
                breakdown[_breakdown_key(acct, "liability")] = round(abs(balance), 2)
            else:
                # Unknown type — treat positive as asset, negative as liability
                if balance >= 0:
                    total_assets += balance
                    breakdown[_breakdown_key(acct, "asset")] = round(balance, 2)
                else:
                    total_liabilities += abs(balance)
                    breakdown[_breakdown_key(acct, "liability")] = round(abs(balance), 2)

        today = date.today()
        stmt = pg_insert(NetWorthSnapshot).values(
            snapshot_date=today,
            total_assets=round(total_assets, 2),
            total_liabilities=round(total_liabilities, 2),
            breakdown=breakdown,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["snapshot_date"],
            set_={
                "total_assets": stmt.excluded.total_assets,
                "total_liabilities": stmt.excluded.total_liabilities,
                "breakdown": stmt.excluded.breakdown,
            },
        )
        db.execute(stmt)
        db.commit()

        net = round(total_assets - total_liabilities, 2)
        logger.info(
            "snapshot_net_worth: assets=%.2f liabilities=%.2f net=%.2f",
            total_assets,
            total_liabilities,
            net,
        )
        return {
            "snapshot_date": str(today),
            "total_assets": round(total_assets, 2),
            "total_liabilities": round(total_liabilities, 2),
            "net_worth": net,
        }

    except Exception as exc:
        logger.exception("snapshot_net_worth failed")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@app.task(
    name="app.tasks.maintenance.refresh_materialized_views",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def refresh_materialized_views(self) -> dict:
    """REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_category_spend."""
    db = get_sync_db()
    try:
        db.execute(
            text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_category_spend")
        )
        db.commit()
        logger.info("refresh_materialized_views: done")
        return {"status": "ok"}
    except Exception as exc:
        logger.exception("refresh_materialized_views failed")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()
