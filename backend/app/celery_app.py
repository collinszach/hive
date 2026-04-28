import logging

from celery import Celery
from celery.schedules import crontab

from app.config import settings

logger = logging.getLogger(__name__)

app = Celery(
    "hive",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.ingestion",
        "app.tasks.points",
        "app.tasks.ml_tasks",
        "app.tasks.maintenance",
        "app.tasks.intelligence",
        "app.tasks.snaptrade_sync",
    ],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Chicago",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

app.conf.beat_schedule = {
    # Sync every 4 hours as a safety net; Plaid webhooks handle near-real-time updates
    "periodic-sync": {
        "task": "app.tasks.ingestion.sync_all_accounts",
        "schedule": crontab(minute=0, hour="*/4"),
        "options": {"queue": "default"},
    },
    "daily-points": {
        "task": "app.tasks.points.compute_points_ledger",
        "schedule": crontab(hour=6, minute=30),
        "options": {"queue": "default"},
    },
    "daily-anomaly": {
        "task": "app.tasks.ml_tasks.run_anomaly_scan",
        "schedule": crontab(hour=7, minute=0),
        "options": {"queue": "default"},
    },
    "periodic-net-worth": {
        "task": "app.tasks.maintenance.snapshot_net_worth",
        "schedule": crontab(minute=15, hour="*/4"),
        "options": {"queue": "default"},
    },
    "refresh-views": {
        "task": "app.tasks.maintenance.refresh_materialized_views",
        "schedule": crontab(hour=8, minute=0),
        "options": {"queue": "default"},
    },
    "weekly-forecast": {
        "task": "app.tasks.ml_tasks.run_spending_forecast",
        "schedule": crontab(hour=9, minute=0, day_of_week=1),
        "options": {"queue": "default"},
    },
    "daily-subscription-detect": {
        "task": "app.tasks.intelligence.detect_subscriptions",
        "schedule": crontab(hour=8, minute=30),
        "options": {"queue": "default"},
    },
    "daily-insights": {
        "task": "app.tasks.intelligence.generate_insights",
        "schedule": crontab(hour=9, minute=0),
        "options": {"queue": "default"},
    },
    "daily-snaptrade-sync": {
        "task": "app.tasks.snaptrade_sync.sync_snaptrade_balances",
        "schedule": crontab(hour=6, minute=45),
        "options": {"queue": "default"},
    },
}
