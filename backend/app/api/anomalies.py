"""Anomalies API — list flagged transactions and mark as reviewed."""
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.anomaly import Anomaly
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/anomalies", tags=["anomalies"])


class TransactionSummary(BaseModel):
    id: uuid.UUID
    date: str
    amount: float
    merchant: Optional[str]
    raw_description: str
    category: Optional[str]
    subcategory: Optional[str]


class AnomalyOut(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    anomaly_score: float
    reason: str
    features: Optional[dict]
    status: str
    flagged_at: str
    transaction: Optional[TransactionSummary]

    model_config = {"from_attributes": True}


class ReviewRequest(BaseModel):
    status: str  # "ok" or "confirmed"


@router.get("", response_model=list[AnomalyOut])
async def list_anomalies(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> list[AnomalyOut]:
    """Return anomalies, optionally filtered by status. Default: unreviewed."""
    filter_status = status or "unreviewed"
    result = await db.execute(
        select(Anomaly)
        .where(Anomaly.status == filter_status)
        .order_by(Anomaly.flagged_at.desc())
        .limit(100)
    )
    anomalies = result.scalars().all()

    # Load related transactions
    tx_ids = [a.transaction_id for a in anomalies]
    tx_map: dict[uuid.UUID, Transaction] = {}
    if tx_ids:
        tx_result = await db.execute(
            select(Transaction).where(Transaction.id.in_(tx_ids))
        )
        for tx in tx_result.scalars().all():
            tx_map[tx.id] = tx

    out = []
    for a in anomalies:
        tx = tx_map.get(a.transaction_id)
        out.append(
            AnomalyOut(
                id=a.id,
                transaction_id=a.transaction_id,
                anomaly_score=float(a.anomaly_score),
                reason=a.reason,
                features=a.features,
                status=a.status,
                flagged_at=a.flagged_at.isoformat() if a.flagged_at else "",
                transaction=TransactionSummary(
                    id=tx.id,
                    date=tx.date.isoformat(),
                    amount=float(tx.amount),
                    merchant=tx.merchant,
                    raw_description=tx.raw_description,
                    category=tx.category,
                    subcategory=tx.subcategory,
                )
                if tx
                else None,
            )
        )
    return out


@router.post("/{anomaly_id}/review", response_model=AnomalyOut)
async def review_anomaly(
    anomaly_id: uuid.UUID,
    body: ReviewRequest,
    db: AsyncSession = Depends(get_db),
) -> AnomalyOut:
    """Mark an anomaly as reviewed. Status: 'ok' (false positive) or 'confirmed' (real issue)."""
    if body.status not in ("ok", "confirmed"):
        raise HTTPException(status_code=400, detail="status must be 'ok' or 'confirmed'")

    result = await db.execute(select(Anomaly).where(Anomaly.id == anomaly_id))
    anomaly = result.scalar_one_or_none()
    if anomaly is None:
        raise HTTPException(status_code=404, detail="Anomaly not found")

    anomaly.status = body.status
    anomaly.reviewed_at = datetime.now(timezone.utc)
    db.add(anomaly)
    await db.commit()

    # Reload transaction
    tx_result = await db.execute(
        select(Transaction).where(Transaction.id == anomaly.transaction_id)
    )
    tx = tx_result.scalar_one_or_none()

    return AnomalyOut(
        id=anomaly.id,
        transaction_id=anomaly.transaction_id,
        anomaly_score=float(anomaly.anomaly_score),
        reason=anomaly.reason,
        features=anomaly.features,
        status=anomaly.status,
        flagged_at=anomaly.flagged_at.isoformat() if anomaly.flagged_at else "",
        transaction=TransactionSummary(
            id=tx.id,
            date=tx.date.isoformat(),
            amount=float(tx.amount),
            merchant=tx.merchant,
            raw_description=tx.raw_description,
            category=tx.category,
            subcategory=tx.subcategory,
        )
        if tx
        else None,
    )
