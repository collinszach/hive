"""Custom categorization rules API."""
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.categorization_rule import CategorizationRule

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/rules", tags=["rules"])


class RuleCreate(BaseModel):
    match_type: str  # contains | starts_with | exact | regex | amount_range
    match_value: str
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    category: str
    subcategory: Optional[str] = None
    priority: int = 100


class RuleUpdate(BaseModel):
    match_type: Optional[str] = None
    match_value: Optional[str] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


def _rule_out(rule: CategorizationRule) -> dict:
    return {
        "id": str(rule.id),
        "match_type": rule.match_type,
        "match_value": rule.match_value,
        "amount_min": float(rule.amount_min) if rule.amount_min is not None else None,
        "amount_max": float(rule.amount_max) if rule.amount_max is not None else None,
        "category": rule.category,
        "subcategory": rule.subcategory,
        "priority": rule.priority,
        "is_active": rule.is_active,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
        "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
    }


@router.get("")
async def list_rules(
    active_only: bool = False,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    q = select(CategorizationRule).order_by(CategorizationRule.priority, CategorizationRule.created_at)
    if active_only:
        q = q.where(CategorizationRule.is_active.is_(True))
    result = await session.execute(q)
    return [_rule_out(r) for r in result.scalars()]


@router.post("", status_code=201)
async def create_rule(
    body: RuleCreate,
    session: AsyncSession = Depends(get_db),
) -> dict:
    VALID_MATCH_TYPES = {"contains", "starts_with", "exact", "regex", "amount_range"}
    if body.match_type not in VALID_MATCH_TYPES:
        raise HTTPException(400, f"match_type must be one of: {', '.join(VALID_MATCH_TYPES)}")

    rule = CategorizationRule(
        id=uuid.uuid4(),
        match_type=body.match_type,
        match_value=body.match_value,
        amount_min=body.amount_min,
        amount_max=body.amount_max,
        category=body.category,
        subcategory=body.subcategory,
        priority=body.priority,
    )
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return _rule_out(rule)


@router.put("/{rule_id}")
async def update_rule(
    rule_id: str,
    body: RuleUpdate,
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await session.execute(
        select(CategorizationRule).where(CategorizationRule.id == uuid.UUID(rule_id))
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(rule, field, value)

    await session.commit()
    await session.refresh(rule)
    return _rule_out(rule)


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: str,
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await session.execute(
        select(CategorizationRule).where(CategorizationRule.id == uuid.UUID(rule_id))
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")

    await session.delete(rule)
    await session.commit()
    return {"deleted": rule_id}
