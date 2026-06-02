"""Apple Push Notification service (APNs) sender — token-based auth over HTTP/2.

Token auth uses a provider JWT (ES256) signed with the .p8 key downloaded from the
Apple Developer portal. The same JWT is reused for up to ~1h (Apple's window) and
regenerated lazily. Delivery uses httpx with HTTP/2 (the `h2` package).

The .p8 key file is a secret — it lives at `settings.apns_key_path` on the host and is
never committed. If APNs isn't configured, the sender is a no-op so dev/test still run.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass

import httpx
from jose import jwt

from app.config import settings

logger = logging.getLogger(__name__)

# APNs production vs sandbox hosts. Dev builds register sandbox tokens.
_HOST_PROD = "https://api.push.apple.com"
_HOST_SANDBOX = "https://api.sandbox.push.apple.com"
# Provider tokens must be refreshed periodically; Apple rejects tokens older than 1h.
_TOKEN_TTL_SECONDS = 50 * 60


@dataclass
class APNsResult:
    token: str
    ok: bool
    status: int
    reason: str | None = None
    # True when APNs says the token is dead (410 Unregistered or 400 BadDeviceToken)
    # so the caller can deactivate it.
    should_deactivate: bool = False


class APNsClient:
    """Minimal APNs provider client. One instance is reused (caches the provider JWT)."""

    def __init__(self) -> None:
        self._cached_jwt: str | None = None
        self._jwt_issued_at: float = 0.0
        self._private_key: str | None = None

    @property
    def configured(self) -> bool:
        return bool(
            settings.apns_key_id
            and settings.apns_team_id
            and settings.apns_key_path
            and settings.apns_bundle_id
        )

    def _load_key(self) -> str:
        if self._private_key is None:
            with open(settings.apns_key_path, "r", encoding="utf-8") as fh:
                self._private_key = fh.read()
        return self._private_key

    def _provider_jwt(self) -> str:
        now = time.time()
        if self._cached_jwt and (now - self._jwt_issued_at) < _TOKEN_TTL_SECONDS:
            return self._cached_jwt
        token = jwt.encode(
            {"iss": settings.apns_team_id, "iat": int(now)},
            self._load_key(),
            algorithm="ES256",
            headers={"kid": settings.apns_key_id},
        )
        self._cached_jwt = token
        self._jwt_issued_at = now
        return token

    def send(
        self,
        device_token: str,
        *,
        title: str,
        body: str,
        is_sandbox: bool = True,
        data: dict | None = None,
        category: str | None = None,
        thread_id: str | None = None,
    ) -> APNsResult:
        """Send one alert push. Synchronous (called from Celery sync tasks)."""
        if not self.configured:
            logger.info("APNs not configured; skipping push to %s…", device_token[:8])
            return APNsResult(token=device_token, ok=False, status=0, reason="not_configured")

        payload: dict = {
            "aps": {
                "alert": {"title": title, "body": body},
                "sound": "default",
            }
        }
        if category:
            payload["aps"]["category"] = category
        if thread_id:
            payload["aps"]["thread-id"] = thread_id
        if data:
            payload.update(data)

        host = _HOST_SANDBOX if is_sandbox else _HOST_PROD
        url = f"{host}/3/device/{device_token}"
        headers = {
            "authorization": f"bearer {self._provider_jwt()}",
            "apns-topic": settings.apns_bundle_id,
            "apns-push-type": "alert",
            "apns-priority": "10",
        }

        try:
            with httpx.Client(http2=True, timeout=10.0) as client:
                resp = client.post(url, headers=headers, content=json.dumps(payload))
        except Exception as exc:  # network/transport failure — retryable, don't deactivate
            logger.warning("APNs send failed for %s…: %s", device_token[:8], exc)
            return APNsResult(token=device_token, ok=False, status=0, reason=str(exc))

        if resp.status_code == 200:
            return APNsResult(token=device_token, ok=True, status=200)

        reason = None
        try:
            reason = resp.json().get("reason")
        except Exception:
            reason = resp.text or None
        dead = resp.status_code == 410 or reason in {"BadDeviceToken", "Unregistered"}
        logger.warning(
            "APNs rejected %s… status=%s reason=%s", device_token[:8], resp.status_code, reason
        )
        return APNsResult(
            token=device_token,
            ok=False,
            status=resp.status_code,
            reason=reason,
            should_deactivate=dead,
        )


# Module-level singleton (caches the provider JWT across calls).
apns_client = APNsClient()
