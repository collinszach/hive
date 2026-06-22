"""Minimal ntfy.sh publisher. No-ops gracefully when not configured.

ntfy delivers a push to any device subscribed to the topic — no per-device tokens or
APNs key required. Configure with NTFY_URL (e.g. https://ntfy.sh) and NTFY_TOPIC.
Use a hard-to-guess topic: ntfy.sh topics are unauthenticated, so the topic name is
the only secret.
"""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def send_ntfy(
    title: str,
    body: str,
    *,
    priority: str | None = None,
    tags: list[str] | None = None,
    click: str | None = None,
) -> bool:
    """Publish a notification to the configured ntfy topic. Returns True if sent."""
    if not settings.ntfy_url or not settings.ntfy_topic:
        return False
    url = f"{settings.ntfy_url.rstrip('/')}/{settings.ntfy_topic}"
    headers = {"Title": title}
    if priority:
        headers["Priority"] = priority
    if tags:
        headers["Tags"] = ",".join(tags)
    if click:
        headers["Click"] = click
    try:
        resp = httpx.post(url, content=body.encode("utf-8"), headers=headers, timeout=10)
        resp.raise_for_status()
        return True
    except Exception:
        logger.warning("ntfy send failed", exc_info=True)
        return False
