"""Financial goals API."""
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.goal import Goal, GoalType

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/goals", tags=["goals"])


class GoalCreate(BaseModel):
    name: str
    goal_type: str
    target_amount: Decimal
    current_amount: Optional[Decimal] = Decimal("0")
    account_id: Optional[int] = None
    category: Optional[str] = None
    deadline: Optional[date] = None
    pinned: Optional[bool] = True

    @field_validator("goal_type")
    @classmethod
    def validate_goal_type(cls, v: str) -> str:
        valid = {e.value for e in GoalType}
        if v not in valid:
            raise ValueError(f"goal_type must be one of: {', '.join(sorted(valid))}")
        return v

    @field_validator("target_amount")
    @classmethod
    def validate_target_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("target_amount must be greater than 0")
        return v


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    goal_type: Optional[str] = None
    target_amount: Optional[Decimal] = None
    current_amount: Optional[Decimal] = None
    account_id: Optional[int] = None
    category: Optional[str] = None
    deadline: Optional[date] = None
    pinned: Optional[bool] = None
    archived: Optional[bool] = None

    @field_validator("goal_type")
    @classmethod
    def validate_goal_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        valid = {e.value for e in GoalType}
        if v not in valid:
            raise ValueError(f"goal_type must be one of: {', '.join(sorted(valid))}")
        return v

    @field_validator("target_amount")
    @classmethod
    def validate_target_amount(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("target_amount must be greater than 0")
        return v


def _months_until(deadline: date) -> int:
    """Number of full months remaining until deadline (min 1)."""
    today = date.today()
    months = (deadline.year - today.year) * 12 + (deadline.month - today.month)
    # If deadline is past the 15th of this month, count this month
    if deadline.day >= 15 and deadline.year == today.year and deadline.month == today.month:
        months = 1
    return max(months, 1)


def _goal_out(g: Goal) -> dict:
    target = float(g.target_amount)
    current = float(g.current_amount)
    pct = round(min(current / target * 100, 100), 1) if target > 0 else 0.0
    remaining = round(max(target - current, 0), 2)

    # Auto-allocation: how much to set aside per month to hit deadline
    monthly_target: float | None = None
    months_remaining: int | None = None
    if g.deadline and remaining > 0:
        months_remaining = _months_until(g.deadline)
        monthly_target = round(remaining / months_remaining, 2)

    # on_track: compare pct of time elapsed vs pct of goal completed
    on_track: bool | None = None
    if g.deadline and g.created_at and target > 0:
        today = date.today()
        created = g.created_at.date() if hasattr(g.created_at, "date") else g.created_at
        total_days = max((g.deadline - created).days, 1)
        elapsed_days = max((today - created).days, 0)
        pct_time_elapsed = elapsed_days / total_days
        # On track if we've saved at least as much as time suggests we should have
        on_track = pct >= min(pct_time_elapsed * 100, 100) or pct >= 100

    return {
        "id": g.id,
        "name": g.name,
        "goal_type": g.goal_type.value if isinstance(g.goal_type, GoalType) else g.goal_type,
        "target_amount": round(target, 2),
        "current_amount": round(current, 2),
        "pct_complete": pct,
        "remaining": remaining,
        "monthly_target": monthly_target,
        "months_remaining": months_remaining,
        "on_track": on_track,
        "account_id": str(g.account_id) if g.account_id else None,
        "category": g.category,
        "deadline": g.deadline.isoformat() if g.deadline else None,
        "pinned": g.pinned,
        "archived": g.archived,
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "updated_at": g.updated_at.isoformat() if g.updated_at else None,
    }


@router.get("")
async def list_goals(
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List goals, ordered by pinned DESC then created_at ASC."""
    q = select(Goal).order_by(Goal.pinned.desc(), Goal.created_at.asc())
    if not include_archived:
        q = q.where(Goal.archived.is_(False))
    result = await db.execute(q)
    return [_goal_out(g) for g in result.scalars().all()]


@router.post("", status_code=201)
async def create_goal(
    body: GoalCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a new goal."""
    goal = Goal(
        name=body.name,
        goal_type=GoalType(body.goal_type),
        target_amount=body.target_amount,
        current_amount=body.current_amount if body.current_amount is not None else Decimal("0"),
        account_id=body.account_id,
        category=body.category,
        deadline=body.deadline,
        pinned=body.pinned if body.pinned is not None else True,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    logger.info("Created goal id=%s name=%r type=%s", goal.id, goal.name, goal.goal_type.value)
    return _goal_out(goal)


@router.patch("/{goal_id}")
async def update_goal(
    goal_id: int,
    body: GoalUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Partially update a goal. All fields optional."""
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field == "goal_type" and value is not None:
            value = GoalType(value)
        setattr(goal, field, value)

    goal.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(goal)
    logger.info("Updated goal id=%s fields=%s", goal_id, list(updates.keys()))
    return _goal_out(goal)


class GoalContribute(BaseModel):
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("amount must be non-zero")
        return v


@router.post("/{goal_id}/contribute")
async def contribute_to_goal(
    goal_id: int,
    body: GoalContribute,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Add (or subtract) an amount from a goal's current_amount.
    Positive amount = savings deposit; negative = correction/withdrawal.
    """
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    new_current = goal.current_amount + body.amount
    if new_current < 0:
        new_current = Decimal("0")

    goal.current_amount = new_current
    goal.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(goal)
    logger.info(
        "Goal id=%s contribution %s → current=%s",
        goal_id, body.amount, goal.current_amount,
    )
    return _goal_out(goal)


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete a goal by integer ID."""
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    await db.delete(goal)
    await db.commit()
    logger.info("Deleted goal id=%s", goal_id)
    return {"deleted": goal_id}


@router.get("/{goal_id}/projection")
async def goal_projection(
    goal_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Project when a goal will be completed based on trailing 3-month net savings rate.
    """
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    today = date.today()
    three_months_ago = (today.replace(day=1) - timedelta(days=90)).replace(day=1)

    # Trailing monthly net savings (income minus expenses)
    row = await db.execute(
        text("""
            SELECT
              (SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END)
               - SUM(CASE WHEN amount > 0 AND NOT is_excluded AND NOT is_transfer AND NOT pending THEN amount ELSE 0 END))
              / 3.0 AS monthly_net
            FROM transactions
            WHERE date >= :cutoff AND date < :today AND NOT is_transfer
        """),
        {"cutoff": three_months_ago, "today": today.replace(day=1)},
    )
    monthly_savings_avg = float(row.scalar_one() or 0)

    remaining = float(goal.target_amount) - float(goal.current_amount)
    projected_completion_date: Optional[str] = None
    required_monthly: Optional[float] = None
    on_track = False

    if monthly_savings_avg > 0 and remaining > 0:
        months_to_complete = remaining / monthly_savings_avg
        projected_date = today + timedelta(days=int(months_to_complete * 30.44))
        projected_completion_date = projected_date.isoformat()

        if goal.deadline:
            on_track = projected_date <= goal.deadline
            if not on_track:
                months_left = max(1, (goal.deadline.year - today.year) * 12 + (goal.deadline.month - today.month))
                required_monthly = round(remaining / months_left, 2)
        else:
            on_track = True  # No deadline, any positive progress is on track
    elif remaining <= 0:
        on_track = True

    return {
        "goal_id": goal_id,
        "monthly_savings_avg": round(monthly_savings_avg, 2),
        "projected_completion_date": projected_completion_date,
        "on_track": on_track,
        "required_monthly_to_hit_target": required_monthly,
    }
