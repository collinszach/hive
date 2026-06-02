"""ML Celery tasks — anomaly detection and spending forecasts."""
import logging

from app.celery_app import app
from app.db import get_sync_db

logger = logging.getLogger(__name__)

# Categories with enough typical data to run Prophet forecasts
_FORECAST_CATEGORIES = [
    "Food & Drink",
    "Groceries",
    "Travel",
    "Transportation",
    "Entertainment",
    "Shopping",
    "Health",
    "Utilities",
    "Home",
]


@app.task(
    name="app.tasks.ml_tasks.run_anomaly_scan",
    bind=True,
    max_retries=3,
    default_retry_delay=120,
)
def run_anomaly_scan(self) -> dict:
    """Run IsolationForest anomaly detection on recent transactions."""
    from app.ml.anomaly_detector import run_anomaly_detection

    db = get_sync_db()
    try:
        result = run_anomaly_detection(db)
        logger.info(
            "run_anomaly_scan: scanned=%d flagged=%d errors=%d",
            result["scanned"],
            result["flagged"],
            result.get("errors", 0),
        )
        flagged = result.get("flagged", 0)
        if flagged > 0:
            from app.notifications.push import send_to_all

            count = "an unusual charge" if flagged == 1 else f"{flagged} unusual charges"
            try:
                send_to_all(
                    db,
                    title="Unusual activity",
                    body=f"We flagged {count} for you to review.",
                    data={"route": "insights"},
                    thread_id="anomaly",
                )
            except Exception:
                logger.exception("anomaly push notification failed")
        return result
    except Exception as exc:
        logger.exception("run_anomaly_scan failed")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@app.task(
    name="app.tasks.ml_tasks.run_spending_forecast",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def run_spending_forecast(self) -> dict:
    """Run Prophet spending forecasts for all major categories."""
    from app.ml.forecaster import forecast_category_spending

    db = get_sync_db()
    results = {}
    errors = 0
    try:
        for category in _FORECAST_CATEGORIES:
            try:
                result = forecast_category_spending(db, category)
                if result:
                    results[category] = result["projected_total"]
                    logger.info(
                        "forecast %s: $%.2f projected over %d days",
                        category,
                        result["projected_total"],
                        result["periods"],
                    )
                else:
                    logger.info("forecast %s: insufficient data", category)
            except Exception as exc:
                logger.exception("forecast failed for %s", category)
                errors += 1

        return {"forecasted": len(results), "errors": errors, "totals": results}
    finally:
        db.close()
