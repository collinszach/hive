"""Financial goals API."""
import uuid
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.goal import Goal

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/goals", tags=["goals"])


class GoalCreate(BaseModel):
    name: str
    description: Optional[str] = None
    goal_type: str  # savings | debt_payoff | spend_limit | net_worth
    target_amount: float
    current_amount: float = 0.0
    linked_account_id: Optional[str] = None
    linked_category: Optional[str] = None
    target_date: Optional[date] = None
    sort_order: int = 0


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    target_date: Optional[date] = None
    is_completed: Optional[bool] = None
    is_archived: Optional[bool] = None
    sort_order: Optional[int] = None


def _goal_out(g: Goal) -> dict:
    pct = (float(g.current_amount) / float(g.target_amount) * 100) if g.target_amount else 0
    return {
        "id": str(g.id),
        "name": g.name,
        "description": g.description,
        "goal_type": g.goal_type,
        "target_amount": float(g.target_amount),
        "current_amount": float(g.current_amount),
        "pct_complete": round(min(pct, 100), 1),
        "remaining": max(float(g.target_amount) - float(g.current_amount), 0),
        "linked_account_id": g.linked_account_id,
        "linked_category": g.linked_category,
        "target_date": g.target_date.isoformat() if g.target_date else None,
        "projected_completion_date": g.projected_completion_date.isoformat() if g.projected_completion_date else None,
        "required_monthly_contribution": float(g.required_monthly_contribution) if g.required_monthly_contribution else None,
        "on_track": g.on_track,
        "is_completed": g.is_completed,
        "is_archived": g.is_archived,
        "completed_at": g.completed_at.isoformat() if g.completed_at else None,
        "sort_order": g.sort_order,
        "created_at": g.created_at.isoformat() if g.created_at else None,
    }


@router.get("")
async def list_goals(
    include_archived: bool = False,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    q = select(Goal).order_by(Goal.sort_order, Goal.created_at)
    if not include_archived:
        q = q.where(Goal.is_archived.is_(False))
    result = await session.execute(q)
    return [_goal_out(g) for g in result.scalars()]


@router.post("", status_code=201)
async def create_goal(
    body: GoalCreate,
    session: AsyncSession = Depends(get_db),
) -> dict:
    VALID_TYPES = {"savings", "debt_payoff", "spend_limit", "net_worth"}
    if body.goal_type not in VALID_TYPES:
        raise HTTPException(400, f"goal_type must be one of: {', '.join(VALID_TYPES)}")

    goal = Goal(
        id=uuid.uuid4(),
        name=body.name,
        description=body.description,
        goal_type=body.goal_type,
        target_amount=body.target_amount,
        current_amount=body.current_amount,
        linked_account_id=body.linked_account_id,
        linked_category=body.linked_category,
        target_date=body.target_date,
        sort_order=body.sort_order,
    )
    session.add(goal)
    await session.commit()
    await session.refresh(goal)
    return _goal_out(goal)


@router.put("/{goal_id}")
async def update_goal(
    goal_id: str,
    body: GoalUpdate,
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await session.execute(select(Goal).where(Goal.id == uuid.UUID(goal_id)))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(404, "Goal not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(goal, field, value)

    if body.is_completed and not goal.completed_at:
        goal.completed_at = date.today()

    await session.commit()
    await session.refresh(goal)
    return _goal_out(goal)


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await session.execute(select(Goal).where(Goal.id == uuid.UUID(goal_id)))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(404, "Goal not found")

    await session.delete(goal)
    await session.commit()
    return {"deleted": goal_id}


@router.get("/{goal_id}/projection")
async def goal_projection(
    goal_id: str,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    For a goal, return: current trajectory (when will it complete at current savings rate),
    required monthly delta to hit the target date, and on_track status.
    """
    from datetime import timedelta
    from sqlalchemy import text

    result = await session.execute(
        select(Goal).where(Goal.id == uuid.UUID(goal_id))
    )
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    # Average monthly net savings from last 3 months
    cutoff = date.today().replace(day=1) - timedelta(days=90)
    flow = await session.execute(
        text("""
            SELECT
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS income,
                SUM(CASE WHEN amount > 0 AND NOT is_excluded AND NOT pending THEN amount ELSE 0 END) AS expenses
            FROM transactions WHERE date >= :cutoff AND NOT is_transfer
        """),
        {"cutoff": cutoff},
    )
    r = flow.fetchone()
    monthly_savings = (float(r.income or 0) - float(r.expenses or 0)) / 3

    current = float(goal.current_amount)
    target = float(goal.target_amount)
    gap = max(target - current, 0)

    # Months to completion at current rate
    if monthly_savings > 0 and gap > 0:
        months_at_current = gap / monthly_savings
        projected_date = date.today() + timedelta(days=months_at_current * 30.44)
    elif gap == 0:
        months_at_current = 0
        projected_date = date.today()
    else:
        months_at_current = None
        projected_date = None

    # Required monthly savings to hit target_date
    required_monthly = None
    months_until_target = None
    if goal.target_date:
        days_left = (goal.target_date - date.today()).days
        months_until_target = max(days_left / 30.44, 0.1)
        required_monthly = round(gap / months_until_target, 2) if gap > 0 else 0

    on_track = (
        projected_date is not None
        and goal.target_date is not None
        and projected_date <= goal.target_date
    )

    return {
        "goal_id": goal_id,
        "current_amount": current,
        "target_amount": target,
        "gap": round(gap, 2),
        "monthly_savings_avg": round(monthly_savings, 2),
        "months_to_completion": round(months_at_current, 1) if months_at_current is not None else None,
        "projected_completion_date": projected_date.isoformat() if projected_date else None,
        "required_monthly_to_hit_target": required_monthly,
        "months_until_target": round(months_until_target, 1) if months_until_target else None,
        "on_track": on_track,
    }
