"""AI Insights feed API."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.insight import Insight

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/insights", tags=["insights"])


def _insight_out(i: Insight) -> dict:
    return {
        "id": str(i.id),
        "insight_type": i.insight_type,
        "title": i.title,
        "body": i.body,
        "amount": float(i.amount) if i.amount is not None else None,
        "delta_pct": float(i.delta_pct) if i.delta_pct is not None else None,
        "category": i.category,
        "linked_entity_type": i.linked_entity_type,
        "linked_entity_id": i.linked_entity_id,
        "priority": i.priority,
        "is_read": i.is_read,
        "is_dismissed": i.is_dismissed,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


@router.get("")
async def list_insights(
    limit: int = 20,
    include_dismissed: bool = False,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Return insights (unread first, then newest first) plus unread count."""
    q = (
        select(Insight)
        # Unread rows first (is_read=False sorts before True), then newest first
        .order_by(
            Insight.is_read.asc(),
            Insight.created_at.desc(),
        )
        .limit(limit)
    )
    if not include_dismissed:
        q = q.where(Insight.is_dismissed.is_(False))

    result = await session.execute(q)
    insights = [_insight_out(i) for i in result.scalars()]

    # Unread count (never includes dismissed)
    unread_result = await session.execute(
        select(func.count()).select_from(Insight).where(
            Insight.is_read.is_(False),
            Insight.is_dismissed.is_(False),
        )
    )
    unread_count: int = unread_result.scalar_one()

    return {"insights": insights, "unread_count": unread_count}


@router.post("/{insight_id}/read")
async def mark_read(
    insight_id: str,
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await session.execute(select(Insight).where(Insight.id == insight_id))
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(404, "Insight not found")
    insight.is_read = True
    await session.commit()
    return {"id": insight_id, "is_read": True}


@router.post("/{insight_id}/dismiss")
async def dismiss_insight(
    insight_id: str,
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await session.execute(select(Insight).where(Insight.id == insight_id))
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(404, "Insight not found")
    insight.is_dismissed = True
    await session.commit()
    return {"id": insight_id, "is_dismissed": True}


@router.post("/mark-all-read")
async def mark_all_read(
    session: AsyncSession = Depends(get_db),
) -> dict:
    await session.execute(
        update(Insight).where(Insight.is_dismissed.is_(False)).values(is_read=True)
    )
    await session.commit()
    return {"ok": True}


@router.post("/generate")
async def trigger_generate() -> dict:
    """Fire the generate_insights Celery task on demand."""
    from app.tasks.intelligence import generate_insights
    task = generate_insights.delay()
    return {"task_id": task.id, "status": "queued"}
