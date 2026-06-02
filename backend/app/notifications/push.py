"""User-facing push dispatch — resolves a user's active device tokens, sends an
alert to each, and deactivates tokens APNs reports as dead. Synchronous, for use
from Celery tasks (which use sync DB sessions)."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.device_token import DeviceToken
from app.notifications.apns import apns_client

logger = logging.getLogger(__name__)


def send_to_user(
    db: Session,
    user_id: uuid.UUID,
    *,
    title: str,
    body: str,
    data: dict | None = None,
    category: str | None = None,
    thread_id: str | None = None,
) -> int:
    """Push an alert to all of a user's active devices. Returns delivery count.

    `data` carries a deep-link hint, e.g. {"route": "insights"}, that the app reads
    on tap to route to the right tab.
    """
    tokens = (
        db.query(DeviceToken)
        .filter(DeviceToken.user_id == user_id, DeviceToken.is_active.is_(True))
        .all()
    )
    if not tokens:
        return 0

    delivered = 0
    for dt in tokens:
        result = apns_client.send(
            dt.token,
            title=title,
            body=body,
            is_sandbox=dt.is_sandbox,
            data=data,
            category=category,
            thread_id=thread_id,
        )
        if result.ok:
            delivered += 1
            dt.last_seen_at = datetime.now(timezone.utc)
        elif result.should_deactivate:
            dt.is_active = False
            logger.info("Deactivated dead device token %s… for user %s", dt.token[:8], user_id)

    db.commit()
    return delivered


def send_to_all(
    db: Session,
    *,
    title: str,
    body: str,
    data: dict | None = None,
    category: str | None = None,
    thread_id: str | None = None,
) -> int:
    """Push to every user that has at least one active device. Used for global,
    daily/weekly jobs (anomaly scan, weekly insight) in this primarily single-user app."""
    user_ids = [
        row[0]
        for row in db.query(DeviceToken.user_id)
        .filter(DeviceToken.is_active.is_(True))
        .distinct()
        .all()
    ]
    total = 0
    for uid in user_ids:
        total += send_to_user(
            db, uid, title=title, body=body, data=data, category=category, thread_id=thread_id
        )
    return total
