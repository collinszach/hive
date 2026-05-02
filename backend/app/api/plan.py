"""Financial planning API — projection, events, and AI recommendations."""
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.plan_event import PlanEvent

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/plan", tags=["plan"])


@router.get("/projection")
async def get_projection(
    months: int = 24,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    Return historical net worth snapshots (last 12 months) plus a
    projected forward trajectory (up to `months` months ahead) with
    active plan_events applied as one-time deductions.
    """
    # 1. Historical snapshots
    hist = await session.execute(
        text("""
            SELECT snapshot_date, net_worth
            FROM net_worth_snapshots
            ORDER BY snapshot_date
            LIMIT 365
        """)
    )
    historical = [
        {"date": row.snapshot_date.isoformat(), "net_worth": float(row.net_worth)}
        for row in hist.fetchall()
    ]

    # 2. Compute average monthly net savings from last 3 months of cash flow
    three_months_ago = date.today().replace(day=1) - timedelta(days=90)
    flow = await session.execute(
        text("""
            SELECT
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS income,
                SUM(CASE WHEN amount > 0 AND NOT is_excluded AND NOT pending THEN amount ELSE 0 END) AS expenses
            FROM transactions
            WHERE date >= :cutoff AND NOT is_transfer
        """),
        {"cutoff": three_months_ago},
    )
    row = flow.fetchone()
    monthly_income   = float(row.income or 0) / 3
    monthly_expenses = float(row.expenses or 0) / 3
    monthly_savings  = monthly_income - monthly_expenses

    # 3. Latest net worth as projection baseline
    baseline_nw = historical[-1]["net_worth"] if historical else 0.0

    # 4. Load active plan events
    events_result = await session.execute(
        select(PlanEvent).where(PlanEvent.is_active == True)  # noqa: E712
    )
    events = events_result.scalars().all()

    # 5. Build projected points month by month
    projected = []
    current_nw = baseline_nw
    today = date.today()

    for i in range(1, months + 1):
        # Move forward one month
        m = today.month + i
        y = today.year + (m - 1) // 12
        m = ((m - 1) % 12) + 1
        proj_date = date(y, m, 1)

        current_nw += monthly_savings

        # Apply any events that fall in this month
        for ev in events:
            if ev.event_date.year == proj_date.year and ev.event_date.month == proj_date.month:
                current_nw -= float(ev.amount)

        projected.append({
            "date": proj_date.isoformat(),
            "net_worth": round(current_nw, 2),
        })

    return {
        "historical": historical,
        "projected": projected,
        "monthly_savings_avg": round(monthly_savings, 2),
        "events": [
            {
                "id": str(ev.id),
                "name": ev.name,
                "amount": float(ev.amount),
                "event_date": ev.event_date.isoformat(),
                "category": ev.category,
                "is_active": ev.is_active,
            }
            for ev in events
        ],
    }


# ── Events CRUD ────────────────────────────────────────────────────────────────

class PlanEventCreate(BaseModel):
    name: str
    amount: float
    event_date: str   # ISO date YYYY-MM-DD
    category: str | None = None
    notes: str | None = None


class PlanEventUpdate(BaseModel):
    name: str | None = None
    amount: float | None = None
    event_date: str | None = None
    category: str | None = None
    notes: str | None = None
    is_active: bool | None = None


@router.get("/events")
async def list_events(session: AsyncSession = Depends(get_db)) -> list[dict]:
    result = await session.execute(
        select(PlanEvent).order_by(PlanEvent.event_date)
    )
    return [
        {
            "id": str(e.id),
            "name": e.name,
            "amount": float(e.amount),
            "event_date": e.event_date.isoformat(),
            "category": e.category,
            "notes": e.notes,
            "is_active": e.is_active,
        }
        for e in result.scalars().all()
    ]


@router.post("/events")
async def create_event(body: PlanEventCreate, session: AsyncSession = Depends(get_db)) -> dict:
    from datetime import date as date_type
    ev = PlanEvent(
        name=body.name,
        amount=body.amount,
        event_date=date_type.fromisoformat(body.event_date),
        category=body.category,
        notes=body.notes,
    )
    session.add(ev)
    await session.commit()
    await session.refresh(ev)
    return {"id": str(ev.id), "name": ev.name, "amount": float(ev.amount),
            "event_date": ev.event_date.isoformat(), "category": ev.category,
            "notes": ev.notes, "is_active": ev.is_active}


@router.put("/events/{event_id}")
async def update_event(event_id: str, body: PlanEventUpdate, session: AsyncSession = Depends(get_db)) -> dict:
    import uuid as uuid_mod
    from datetime import date as date_type
    result = await session.execute(select(PlanEvent).where(PlanEvent.id == uuid_mod.UUID(event_id)))
    ev = result.scalar_one_or_none()
    if ev is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if body.name is not None: ev.name = body.name
    if body.amount is not None: ev.amount = body.amount
    if body.event_date is not None: ev.event_date = date_type.fromisoformat(body.event_date)
    if body.category is not None: ev.category = body.category
    if body.notes is not None: ev.notes = body.notes
    if body.is_active is not None: ev.is_active = body.is_active
    await session.commit()
    return {"id": str(ev.id), "name": ev.name, "amount": float(ev.amount),
            "event_date": ev.event_date.isoformat(), "category": ev.category,
            "notes": ev.notes, "is_active": ev.is_active}


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(event_id: str, session: AsyncSession = Depends(get_db)):
    import uuid as uuid_mod
    result = await session.execute(select(PlanEvent).where(PlanEvent.id == uuid_mod.UUID(event_id)))
    ev = result.scalar_one_or_none()
    if ev is None:
        raise HTTPException(status_code=404, detail="Event not found")
    await session.delete(ev)
    await session.commit()


# ── Trim the Fat ───────────────────────────────────────────────────────────────

class TrimRecommendationsRequest(BaseModel):
    goal_ids: list[str] = []


@router.post("/trim-recommendations")
async def trim_recommendations(
    body: TrimRecommendationsRequest,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Use Claude to analyze spending and return ranked actionable budget cuts
    based on current spend patterns and stated goals.
    """
    import anthropic
    from app.config import settings
    from app.models.goal import Goal
    import uuid as uuid_mod

    # 1. Gather last 3 months of category-level spend
    cutoff = date.today().replace(day=1) - timedelta(days=90)
    spend = await session.execute(
        text("""
            SELECT category, subcategory,
                   SUM(amount) / 3.0 AS monthly_avg,
                   COUNT(*) AS txn_count
            FROM transactions
            WHERE date >= :cutoff
              AND NOT is_excluded AND NOT is_transfer AND NOT pending AND amount > 0
            GROUP BY category, subcategory
            ORDER BY monthly_avg DESC
            LIMIT 25
        """),
        {"cutoff": cutoff},
    )
    spend_rows = [
        {
            "category": r.category or "Uncategorized",
            "subcategory": r.subcategory,
            "monthly_avg": round(float(r.monthly_avg), 2),
            "txn_count": r.txn_count,
        }
        for r in spend.fetchall()
    ]

    # 2. Gather goals (requested IDs or all active)
    if body.goal_ids:
        goals_result = await session.execute(
            select(Goal).where(
                Goal.id.in_([uuid_mod.UUID(g) for g in body.goal_ids]),
                Goal.is_completed == False,  # noqa: E712
            )
        )
    else:
        goals_result = await session.execute(
            select(Goal).where(Goal.is_completed == False)  # noqa: E712
        )
    goals = goals_result.scalars().all()
    goals_text = "\n".join(
        f"- {g.name}: target ${float(g.target_amount):,.0f} by {g.target_date or 'no date'}, "
        f"current ${float(g.current_amount):,.0f}"
        for g in goals
    ) or "No goals set."

    # 3. Current monthly surplus
    flow = await session.execute(
        text("""
            SELECT
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) / 3.0 AS income,
                SUM(CASE WHEN amount > 0 AND NOT is_excluded AND NOT pending THEN amount ELSE 0 END) / 3.0 AS expenses
            FROM transactions WHERE date >= :cutoff AND NOT is_transfer
        """),
        {"cutoff": cutoff},
    )
    fr = flow.fetchone()
    monthly_income = float(fr.income or 0)
    monthly_expenses = float(fr.expenses or 0)
    monthly_surplus = monthly_income - monthly_expenses

    # 4. Build Claude prompt
    spend_table = "\n".join(
        f"  {r['category']}{' > ' + r['subcategory'] if r['subcategory'] else ''}: ${r['monthly_avg']:,.2f}/mo"
        for r in spend_rows
    )

    prompt = f"""You are a financial advisor analyzing spending data for a single user.

MONTHLY SPENDING (3-month average):
{spend_table}

CURRENT MONTHLY SURPLUS: ${monthly_surplus:,.2f}

FINANCIAL GOALS:
{goals_text}

Identify the top 4-6 specific, actionable spending cuts. For each, return JSON with these exact fields:
- category (string)
- subcategory (string or null)
- current_monthly (number: current monthly spend)
- suggested_monthly (number: realistic reduced target)
- savings_per_month (number: the difference)
- rationale (string: 1-2 sentences explaining why this cut makes sense)
- goal_impact (string or null: e.g. "saves $280/mo → hits House goal 3 months earlier")

Return ONLY a JSON array, no markdown fences, no extra text. Example:
[{{"category":"Food & Drink","subcategory":"Restaurant","current_monthly":650,"suggested_monthly":400,"savings_per_month":250,"rationale":"Dining out is your largest discretionary category at $650/mo, well above the $400 typical target.","goal_impact":"Saves $250/mo → reaches Emergency Fund goal 6 months earlier"}}]"""

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system="You are a precise financial advisor. Respond only with valid JSON arrays.",
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    try:
        recommendations = json.loads(message.content[0].text)
        if not isinstance(recommendations, list):
            recommendations = []
    except (json.JSONDecodeError, IndexError, KeyError):
        logger.warning("trim_recommendations: Claude returned unparseable response")
        recommendations = []

    return recommendations
