"""
Plaid webhook endpoint for real-time transaction updates.
Plaid sends webhooks when new transactions are available (DEFAULT_UPDATE, HISTORICAL_UPDATE, etc.)
This endpoint triggers an immediate sync for the relevant item.
"""
import hashlib
import hmac
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.plaid_link import PlaidLink

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plaid/webhook", tags=["plaid-webhook"])


class PlaidWebhookPayload(BaseModel):
    webhook_type: str
    webhook_code: str
    item_id: str
    error: Optional[dict] = None
    new_transactions: Optional[int] = None
    removed_transactions: Optional[list[str]] = None


def _trigger_sync(item_id: str) -> None:
    """Fire off a Celery sync task for the given Plaid item."""
    from app.tasks.ingestion import sync_all_accounts
    # Celery runs sync for all active links — item_id is logged for tracing
    logger.info("Webhook triggered sync for item_id=%s", item_id)
    sync_all_accounts.delay()


@router.post("")
async def plaid_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Receive Plaid webhook events and trigger transaction syncs.

    Supported webhook_type + webhook_code combinations:
      TRANSACTIONS / DEFAULT_UPDATE     → new transactions available
      TRANSACTIONS / HISTORICAL_UPDATE  → historical data ready
      TRANSACTIONS / TRANSACTIONS_REMOVED → transactions removed
      ITEM / ERROR                       → item needs re-linking
    """
    body = await request.body()

    try:
        payload = PlaidWebhookPayload.model_validate_json(body)
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
        logger.warning(
            "Plaid item error for item_id=%s: %s", item_id, error_code
        )
        if error_code == "ITEM_LOGIN_REQUIRED":
            logger.error(
                "Item %s needs re-authentication — user must re-link via /connect", item_id
            )
        return {"status": "error_logged", "item_id": item_id}

    # All other webhook types acknowledged but not acted upon
    return {"status": "acknowledged", "item_id": item_id}
