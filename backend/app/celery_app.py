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
    timezone=settings.celery_timezone,
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

app.conf.beat_schedule = {
    "daily-sync": {
        "task": "app.tasks.ingestion.sync_all_accounts",
        "schedule": crontab(hour=2, minute=0),
        "options": {"queue": "default"},
    },
    "daily-points": {
        "task": "app.tasks.points.compute_points_ledger",
        "schedule": crontab(hour=2, minute=30),
        "options": {"queue": "default"},
    },
    "daily-anomaly": {
        "task": "app.tasks.ml_tasks.run_anomaly_scan",
        "schedule": crontab(hour=3, minute=0),
        "options": {"queue": "default"},
    },
    "daily-net-worth": {
        "task": "app.tasks.maintenance.snapshot_net_worth",
        "schedule": crontab(hour=3, minute=30),
        "options": {"queue": "default"},
    },
    "refresh-views": {
        "task": "app.tasks.maintenance.refresh_materialized_views",
        "schedule": crontab(hour=4, minute=0),
        "options": {"queue": "default"},
    },
    "weekly-forecast": {
        "task": "app.tasks.ml_tasks.run_spending_forecast",
        "schedule": crontab(hour=5, minute=0, day_of_week=1),
        "options": {"queue": "default"},
    },
    "daily-subscription-detect": {
        "task": "app.tasks.intelligence.detect_subscriptions",
        "schedule": crontab(hour=4, minute=30),
        "options": {"queue": "default"},
    },
    "daily-insights": {
        "task": "app.tasks.intelligence.generate_insights",
        "schedule": crontab(hour=5, minute=0),
        "options": {"queue": "default"},
    },
    "weekly-insight-digest": {
        # Monday 8 AM — after daily-insights has populated the week's feed.
        "task": "app.tasks.intelligence.weekly_insight_digest",
        "schedule": crontab(hour=8, minute=0, day_of_week=1),
        "options": {"queue": "default"},
    },
    "daily-snaptrade-sync": {
        "task": "app.tasks.snaptrade_sync.sync_snaptrade_balances",
        "schedule": crontab(hour=2, minute=45),
        "options": {"queue": "default"},
    },
    "daily-backup": {
        "task": "app.tasks.maintenance.backup_database",
        "schedule": crontab(hour=1, minute=0),  # 1 AM, before sync tasks
        "options": {"queue": "default"},
    },
}
