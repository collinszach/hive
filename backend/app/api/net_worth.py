"""Net worth API — daily balance snapshots."""
import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.net_worth import NetWorthSnapshot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/net-worth", tags=["net-worth"])


class SnapshotOut(BaseModel):
    snapshot_date: str
    total_assets: float
    total_liabilities: float
    net_worth: float
    breakdown: dict

    model_config = {"from_attributes": True}


@router.get("/history", response_model=list[SnapshotOut])
async def net_worth_history(
    days: int = Query(365, ge=7, le=1825),
    db: AsyncSession = Depends(get_db),
) -> list[SnapshotOut]:
    """Return daily net worth snapshots for the past N days."""
    cutoff = date.today() - timedelta(days=days)
    result = await db.execute(
        select(NetWorthSnapshot)
        .where(NetWorthSnapshot.snapshot_date >= cutoff)
        .order_by(NetWorthSnapshot.snapshot_date.asc())
    )
    snapshots = result.scalars().all()

    return [
        SnapshotOut(
            snapshot_date=s.snapshot_date.isoformat(),
            total_assets=float(s.total_assets),
            total_liabilities=float(s.total_liabilities),
            net_worth=float(s.net_worth),
            breakdown=s.breakdown or {},
        )
        for s in snapshots
    ]
