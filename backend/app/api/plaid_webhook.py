"""
Plaid webhook endpoint for real-time transaction updates.
Plaid sends webhooks when new transactions are available (DEFAULT_UPDATE, HISTORICAL_UPDATE, etc.)
This endpoint triggers an immediate sync for the relevant item.

Verification uses Plaid's JWT-based webhook verification:
  - Plaid sends a `Plaid-Verification` header containing a signed JWT (ES256)
  - The JWT is signed with a key from Plaid's JWKS endpoint (fetched via WebhookVerificationKeyGet)
  - We verify the JWT signature, body hash, algorithm, and replay window
See: https://plaid.com/docs/api/webhooks/webhook-verification/
"""
import asyncio
import hashlib
import hmac
import logging
import time
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from jose import JWTError, jwt
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plaid/webhook", tags=["plaid-webhook"])

# Bounded LRU key cache — prevents memory exhaustion from crafted kid values.
# Plaid rotates keys rarely; 20 slots is ample.
_KEY_CACHE: dict[str, tuple[dict, float]] = {}  # kid → (jwk, fetched_at)
_KEY_CACHE_MAX = 20
_KEY_CACHE_SECONDS = 300
_EXPECTED_ALG = "ES256"


def _get_plaid_jwk(key_id: str) -> dict:
    """
    Fetch the Plaid JWKS public key for the given key_id.
    Results are cached for 5 minutes with an LRU eviction policy (max 20 keys).
    Raises HTTPException(401) if Plaid does not recognise the key_id.
    """
    now = time.monotonic()

    cached = _KEY_CACHE.get(key_id)
    if cached and (now - cached[1]) < _KEY_CACHE_SECONDS:
        return cached[0]

    from plaid.model.webhook_verification_key_get_request import (
        WebhookVerificationKeyGetRequest,
    )
    from app.plaid.connector import plaid_connector

    try:
        request = WebhookVerificationKeyGetRequest(key_id=key_id)
        response = plaid_connector._client.webhook_verification_key_get(request)
        jwk = response["key"].to_dict()
    except Exception as exc:
        logger.error("Failed to fetch Plaid JWKS key %s: %s", key_id, exc)
        # Return 401 — caller cannot distinguish "bad JWT" from "key fetch broken"
        raise HTTPException(status_code=401, detail="Webhook verification failed")

    # LRU eviction: if at capacity, drop the oldest entry
    if len(_KEY_CACHE) >= _KEY_CACHE_MAX:
        oldest_kid = min(_KEY_CACHE, key=lambda k: _KEY_CACHE[k][1])
        del _KEY_CACHE[oldest_kid]

    _KEY_CACHE[key_id] = (jwk, now)
    return jwk


async def _get_plaid_jwk_async(key_id: str) -> dict:
    """Async wrapper — runs the blocking Plaid SDK call in a thread."""
    return await asyncio.to_thread(_get_plaid_jwk, key_id)


def _verify_plaid_jwt(verification_header: str, raw_body: bytes) -> None:
    """
    Synchronous inner verifier (called from the async wrapper below).
    Raises HTTPException(401) on any verification failure.

    Checks:
      1. `alg` header must be ES256 (algorithm confusion guard)
      2. JWT is structurally valid and signed by a known Plaid key
      3. `request_body_sha256` claim matches SHA-256 of the raw request body (timing-safe)
      4. `iat` claim is within the last 5 minutes (replay protection)
    """
    # 1. Decode headers without verification to inspect alg and kid
    try:
        unverified_headers = jwt.get_unverified_headers(verification_header)
    except JWTError as exc:
        logger.warning("Plaid webhook JWT malformed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Guard against algorithm confusion before fetching the key
    if unverified_headers.get("alg") != _EXPECTED_ALG:
        logger.warning(
            "Plaid webhook JWT unexpected alg: %s", unverified_headers.get("alg")
        )
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    key_id = unverified_headers.get("kid")
    if not key_id:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # 2. Fetch key (cached) and verify signature
    jwk = _get_plaid_jwk(key_id)
    try:
        claims = jwt.decode(
            verification_header,
            jwk,
            algorithms=[_EXPECTED_ALG],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        logger.warning("Plaid webhook JWT signature invalid: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # 3. Body hash — timing-safe comparison prevents oracle attacks
    expected_hash = hashlib.sha256(raw_body).hexdigest()
    claimed_hash = claims.get("request_body_sha256", "")
    if not claimed_hash or not hmac.compare_digest(claimed_hash, expected_hash):
        logger.warning(
            "Webhook body hash mismatch: claimed=%s actual=%s",
            claimed_hash,
            expected_hash,
        )
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # 4. Replay protection — JWT must be ≤5 min old, ≤30s in the future (clock skew)
    issued_at = claims.get("iat", 0)
    age_seconds = time.time() - issued_at
    if age_seconds > 300 or age_seconds < -30:
        logger.warning("Webhook JWT iat out of range: age=%.0fs", age_seconds)
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


class PlaidWebhookPayload(BaseModel):
    webhook_type: str
    webhook_code: str
    item_id: str
    error: Optional[dict] = None
    new_transactions: Optional[int] = None
    removed_transactions: Optional[list[str]] = None


def _trigger_sync(item_id: str) -> None:
    """Fire off a Celery sync task for the given Plaid item."""
    from app.tasks.ingestion import sync_single_link
    logger.info("Webhook triggered sync for item_id=%s", item_id)
    sync_single_link.delay(item_id)


@router.post("")
async def plaid_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    plaid_verification: Optional[str] = Header(default=None, alias="Plaid-Verification"),
) -> dict:
    """
    Receive Plaid webhook events and trigger transaction syncs.

    Authentication: Plaid-Verification JWT header (JWKS-signed, ES256).
    Supported webhook_type + webhook_code combinations:
      TRANSACTIONS / DEFAULT_UPDATE     → new transactions available
      TRANSACTIONS / HISTORICAL_UPDATE  → historical data ready
      TRANSACTIONS / TRANSACTIONS_REMOVED → transactions removed
      ITEM / ERROR                       → item needs re-linking
    """
    raw_body = await request.body()

    if not plaid_verification:
        logger.warning("Webhook request missing Plaid-Verification header")
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Run the blocking JWKS fetch + JWT decode in a thread so the event loop stays free
    await asyncio.to_thread(_verify_plaid_jwt, plaid_verification, raw_body)

    try:
        payload = PlaidWebhookPayload.model_validate_json(raw_body)
    except Exception as exc:
        logger.error("Invalid webhook payload: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid payload")

    webhook_type = payload.webhook_type.upper()
    webhook_code = payload.webhook_code.upper()
    item_id = payload.item_id

    logger.info(
        "Plaid webhook: type=%s code=%s item_id=%s",
        webhook_type,
        webhook_code,
        item_id,
    )

    if webhook_type == "TRANSACTIONS" and webhook_code in (
        "DEFAULT_UPDATE",
        "HISTORICAL_UPDATE",
        "TRANSACTIONS_REMOVED",
    ):
        background_tasks.add_task(_trigger_sync, item_id)
        return {"status": "sync_queued", "item_id": item_id}

    if webhook_type == "ITEM" and webhook_code == "ERROR":
        error_code = (payload.error or {}).get("error_code", "unknown")
        logger.warning("Plaid item error for item_id=%s: %s", item_id, error_code)
        if error_code == "ITEM_LOGIN_REQUIRED":
            logger.error(
                "Item %s needs re-authentication — user must re-link via /connect", item_id
            )
        return {"status": "error_logged", "item_id": item_id}

    return {"status": "acknowledged", "item_id": item_id}
