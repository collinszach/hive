# Sub-B: Financial Planning Hub (`/plan`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/plan` page with three panels: Net Worth Projection (with major expense scenarios), Goals (with trajectory analysis and Claude commentary), and Trim the Fat (Claude-powered budget cut recommendations).

**Architecture:** New `plan_events` DB table + Alembic migration. New `backend/app/api/plan.py` router with projection, events CRUD, and trim-recommendations endpoints. New `frontend/src/app/plan/page.tsx` with three tab panels. Existing `Goal` model and `/api/goals` endpoints are reused; a new `GET /api/goals/{id}/projection` endpoint is added to `goals.py`.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Anthropic SDK (`claude-sonnet-4-6`), Next.js 14 App Router, TypeScript, Tailwind CSS, Recharts (`AreaChart`, `LineChart`), shadcn/ui.

**UI/UX Note:** Model after ORIGIN + MONARCH MONEY: clean Inter typography, area charts with soft gradient fills (not just bars), generous card padding, premium feel. Use existing Hive honey accent (`#F5B942`) and semantic green (`#32D583`). Cards should feel clean and airy.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/app/models/plan_event.py` | Create | `PlanEvent` SQLAlchemy model |
| `backend/app/models/__init__.py` | Modify | Import `PlanEvent` for Alembic autodiscovery |
| `backend/alembic/versions/e1f2a3b4c5d6_add_plan_events.py` | Create | Migration: `plan_events` table |
| `backend/app/api/plan.py` | Create | `/api/plan/*` endpoints |
| `backend/app/api/goals.py` | Modify | Add `GET /{id}/projection` endpoint |
| `backend/app/main.py` | Modify | Register plan router |
| `frontend/src/lib/api.ts` | Modify | Add `plan.*` and `goals.projection` API methods + types |
| `frontend/src/app/plan/page.tsx` | Create | Full planning hub page with 3 tabs |
| `frontend/src/components/Sidebar.tsx` | Modify | Add `/plan` nav link under FINANCES group |

---

## Task 1: `PlanEvent` model and Alembic migration

**Files:**
- Create: `backend/app/models/plan_event.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/e1f2a3b4c5d6_add_plan_events.py`

- [ ] **Step 1: Create `backend/app/models/plan_event.py`**

```python
"""Major future expense event for net worth projection."""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PlanEvent(Base):
    __tablename__ = "plan_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)   # Housing, Vehicle, Travel, Other
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Register model in `backend/app/models/__init__.py`**

Add after the last import:
```python
from app.models.plan_event import PlanEvent  # noqa: F401
```

And add `"PlanEvent"` to `__all__`.

- [ ] **Step 3: Generate Alembic migration**

```bash
docker compose exec backend alembic revision --autogenerate -m "add_plan_events"
```

Expected output: `Generating .../versions/xxxx_add_plan_events.py ... done`

- [ ] **Step 4: Run migration**

```bash
docker compose exec backend alembic upgrade head
```

Expected: `Running upgrade ... -> xxxx_add_plan_events, add_plan_events`

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/plan_event.py backend/app/models/__init__.py
git add backend/alembic/versions/
git commit -m "feat: add plan_events model and migration"
```

---

## Task 2: `/api/plan/projection` endpoint

**Files:**
- Create: `backend/app/api/plan.py` (start of file through projection endpoint)

- [ ] **Step 1: Create `backend/app/api/plan.py` with the projection endpoint**

```python
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
```

- [ ] **Step 2: Commit the initial plan.py**

```bash
git add backend/app/api/plan.py
git commit -m "feat: plan projection endpoint with net worth trajectory and event overlays"
```

---

## Task 3: Plan events CRUD endpoints

**Files:**
- Modify: `backend/app/api/plan.py` (append to file)

- [ ] **Step 1: Append events CRUD to `backend/app/api/plan.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/plan.py
git commit -m "feat: plan events CRUD endpoints"
```

---

## Task 4: Goal projection endpoint

**Files:**
- Modify: `backend/app/api/goals.py`

- [ ] **Step 1: Add `GET /{id}/projection` to `backend/app/api/goals.py`**

First, check what imports are already at the top of `goals.py`. Then append this endpoint:

```python
@router.get("/{goal_id}/projection")
async def goal_projection(
    goal_id: str,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    For a goal, return: current trajectory (when will it complete at current savings rate),
    required monthly delta to hit the target date, and on_track status.
    """
    import uuid as uuid_mod
    from datetime import date
    from app.models.goal import Goal

    result = await session.execute(
        select(Goal).where(Goal.id == uuid_mod.UUID(goal_id))
    )
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    # Average monthly net savings from last 3 months
    from sqlalchemy import text
    from datetime import timedelta
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
```

Also add `HTTPException` to goals.py imports if not present: `from fastapi import APIRouter, Depends, HTTPException`

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/goals.py
git commit -m "feat: goal projection endpoint with trajectory and required-savings calculation"
```

---

## Task 5: Trim recommendations endpoint (Claude call)

**Files:**
- Modify: `backend/app/api/plan.py` (append)

- [ ] **Step 1: Append the trim-recommendations endpoint to `backend/app/api/plan.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/plan.py
git commit -m "feat: trim-recommendations endpoint with Claude-powered budget cut analysis"
```

---

## Task 6: Register plan router in `main.py`

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add plan router import and registration**

Add to the imports block (alphabetically):
```python
from app.api.plan import router as plan_router
```

Add to the `app.include_router(...)` block:
```python
app.include_router(plan_router)
```

- [ ] **Step 2: Rebuild and verify backend starts**

```bash
docker compose build backend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d backend
docker compose logs backend --tail=20
```

Expected: No import errors. `Application startup complete.`

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register plan router in FastAPI app"
```

---

## Task 7: Frontend API types and client methods

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add types**

Find the type definitions section and add:

```typescript
export interface PlanEvent {
  id: string;
  name: string;
  amount: number;
  event_date: string;  // ISO date
  category: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface ProjectionPoint {
  date: string;
  net_worth: number;
}

export interface ProjectionResponse {
  historical: ProjectionPoint[];
  projected: ProjectionPoint[];
  monthly_savings_avg: number;
  events: PlanEvent[];
}

export interface GoalProjection {
  goal_id: string;
  current_amount: number;
  target_amount: number;
  gap: number;
  monthly_savings_avg: number;
  months_to_completion: number | null;
  projected_completion_date: string | null;
  required_monthly_to_hit_target: number | null;
  months_until_target: number | null;
  on_track: boolean;
}

export interface TrimRecommendation {
  category: string;
  subcategory: string | null;
  current_monthly: number;
  suggested_monthly: number;
  savings_per_month: number;
  rationale: string;
  goal_impact: string | null;
}

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  goal_type: string;
  target_amount: number;
  current_amount: number;
  linked_account_id: string | null;
  target_date: string | null;
  projected_completion_date: string | null;
  required_monthly_contribution: number | null;
  on_track: boolean | null;
  is_completed: boolean;
  sort_order: number;
}
```

- [ ] **Step 2: Add API methods inside the `api` object**

```typescript
plan: {
  projection: (months?: number) =>
    get<ProjectionResponse>("/api/plan/projection", months ? { months } : undefined),
  events: () => get<PlanEvent[]>("/api/plan/events"),
  createEvent: (data: Omit<PlanEvent, "id" | "is_active">) =>
    post<PlanEvent>("/api/plan/events", data),
  updateEvent: (id: string, data: Partial<PlanEvent>) =>
    put<PlanEvent>(`/api/plan/events/${id}`, data),
  deleteEvent: (id: string) => del<void>(`/api/plan/events/${id}`),
  trimRecommendations: (goalIds?: string[]) =>
    post<TrimRecommendation[]>("/api/plan/trim-recommendations", { goal_ids: goalIds ?? [] }),
},

goals: {
  list: () => get<Goal[]>("/api/goals"),
  create: (data: Partial<Goal>) => post<Goal>("/api/goals", data),
  update: (id: string, data: Partial<Goal>) => put<Goal>(`/api/goals/${id}`, data),
  delete: (id: string) => del<void>(`/api/goals/${id}`),
  projection: (id: string) => get<GoalProjection>(`/api/goals/${id}/projection`),
},
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add plan and goals API types and client methods"
```

---

## Task 8: Build the `/plan` page

**Files:**
- Create: `frontend/src/app/plan/page.tsx`

- [ ] **Step 1: Create `frontend/src/app/plan/page.tsx`**

This is the full page. The three tabs are: Projection, Goals, Trim the Fat.

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  api,
  ProjectionResponse,
  PlanEvent,
  Goal,
  GoalProjection,
  TrimRecommendation,
} from "@/lib/api";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  Plus,
  Trash2,
  Loader2,
  Target,
  Scissors,
  ChevronRight,
  CheckCircle2,
  X,
} from "lucide-react";

type Tab = "projection" | "goals" | "trim";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function fmtFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Projection Tab ────────────────────────────────────────────────────────────

function ProjectionTab() {
  const [data, setData]         = useState<ProjectionResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate]   = useState("");
  const [newCat, setNewCat]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.plan.projection(24).then(setData).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAddEvent() {
    if (!newName || !newAmount || !newDate) return;
    setSaving(true);
    try {
      await api.plan.createEvent({
        name: newName,
        amount: parseFloat(newAmount),
        event_date: newDate,
        category: newCat || null,
        notes: null,
      });
      setNewName(""); setNewAmount(""); setNewDate(""); setNewCat("");
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEvent(ev: PlanEvent) {
    await api.plan.updateEvent(ev.id, { is_active: !ev.is_active });
    load();
  }

  async function handleDeleteEvent(id: string) {
    setDeletingId(id);
    try {
      await api.plan.deleteEvent(id);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-tertiary gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[13px]">Loading projection…</span>
      </div>
    );
  }

  if (!data) return null;

  // Merge historical + projected for the chart
  const chartData = [
    ...data.historical.map(p => ({ date: p.date, historical: p.net_worth, projected: null })),
    // Bridge: last historical point also appears as first projected
    ...(data.projected.length > 0 && data.historical.length > 0
      ? [{ date: data.historical[data.historical.length - 1].date,
           historical: null,
           projected: data.historical[data.historical.length - 1].net_worth }]
      : []),
    ...data.projected.map(p => ({ date: p.date, historical: null, projected: p.net_worth })),
  ];

  // Downsample to ~36 points for readability
  const step = Math.max(1, Math.floor(chartData.length / 36));
  const displayData = chartData.filter((_, i) => i % step === 0);

  return (
    <div className="space-y-5">
      {/* Summary stat */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          {
            label: "Avg Monthly Savings",
            value: fmt(data.monthly_savings_avg),
            color: data.monthly_savings_avg >= 0 ? "text-semantic-income" : "text-semantic-expense",
          },
          {
            label: "Planned Expenses",
            value: fmt(data.events.filter(e => e.is_active).reduce((s, e) => s + e.amount, 0)),
            color: "text-semantic-expense",
          },
          {
            label: "Active Events",
            value: String(data.events.filter(e => e.is_active).length),
            color: "text-ink-primary",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="hive-card p-4">
            <p className="hive-label mb-2">{label}</p>
            <p className={cn("text-[20px] font-semibold font-mono tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Projection chart */}
      <div className="hive-card p-5">
        <p className="text-[13px] font-medium text-ink-primary mb-1">Net Worth Trajectory</p>
        <p className="text-[11px] text-ink-tertiary mb-4">Historical (solid) + 24-month projection (dashed)</p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={displayData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#32D583" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#32D583" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F5B942" stopOpacity={0.20} />
                <stop offset="95%" stopColor="#F5B942" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6B6B73", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtDate}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#6B6B73", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: "#1A1A1D",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                fontSize: 12,
                color: "#F5F5F7",
              }}
              formatter={(v: number, name: string) => [fmt(v), name === "historical" ? "Actual" : "Projected"]}
              labelFormatter={fmtDate}
            />
            <Area
              type="monotone"
              dataKey="historical"
              stroke="#32D583"
              strokeWidth={2}
              fill="url(#histGrad)"
              dot={false}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="projected"
              stroke="#F5B942"
              strokeWidth={2}
              strokeDasharray="5 3"
              fill="url(#projGrad)"
              dot={false}
              connectNulls={false}
            />
            {/* Event markers */}
            {data.events
              .filter(e => e.is_active)
              .map(ev => (
                <ReferenceLine
                  key={ev.id}
                  x={ev.event_date}
                  stroke="rgba(249,112,102,0.6)"
                  strokeDasharray="3 3"
                  label={{ value: ev.name, position: "top", fill: "#F97066", fontSize: 10 }}
                />
              ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Events list */}
      <div className="hive-card overflow-hidden">
        <div className="hive-section-header">
          <p className="text-[13px] font-medium text-ink-primary">Planned Major Expenses</p>
          <button
            onClick={() => setShowForm(v => !v)}
            className="hive-btn-ghost flex items-center gap-1.5 text-[12px] text-honey"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Event
          </button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-white/[0.04] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="hive-label block mb-1">Event Name</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="New car, vacation…"
                  className="w-full text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-honey/30"
                />
              </div>
              <div>
                <label className="hive-label block mb-1">Amount</label>
                <input
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  type="number"
                  placeholder="35000"
                  className="w-full text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-honey/30"
                />
              </div>
              <div>
                <label className="hive-label block mb-1">Date</label>
                <input
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  type="date"
                  className="w-full text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary focus:outline-none focus:border-honey/30"
                />
              </div>
              <div>
                <label className="hive-label block mb-1">Category</label>
                <select
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  className="w-full text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary focus:outline-none focus:border-honey/30"
                >
                  <option value="">— optional —</option>
                  {["Housing", "Vehicle", "Travel", "Education", "Medical", "Investment", "Other"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddEvent}
                disabled={saving || !newName || !newAmount || !newDate}
                className="text-[12px] px-4 py-2 rounded-lg bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40 font-medium"
              >
                {saving ? "Saving…" : "Add Event"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-[12px] px-4 py-2 rounded-lg hover:bg-white/[0.05] text-ink-tertiary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {data.events.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-ink-tertiary">
            No planned expenses yet. Add events to see their impact on your trajectory.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {data.events.map(ev => (
              <div key={ev.id} className="flex items-center gap-4 px-5 py-3">
                <input
                  type="checkbox"
                  checked={ev.is_active}
                  onChange={() => handleToggleEvent(ev)}
                  className="accent-honey w-4 h-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[13px] font-medium", ev.is_active ? "text-ink-primary" : "text-ink-tertiary line-through")}>
                    {ev.name}
                  </p>
                  <p className="text-[11px] text-ink-tertiary">
                    {fmtFullDate(ev.event_date)}{ev.category ? ` · ${ev.category}` : ""}
                  </p>
                </div>
                <p className="text-[13px] font-mono font-semibold text-semantic-expense tabular-nums shrink-0">
                  −{fmt(ev.amount)}
                </p>
                <button
                  onClick={() => handleDeleteEvent(ev.id)}
                  disabled={deletingId === ev.id}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] text-ink-tertiary hover:text-semantic-expense transition-colors disabled:opacity-40"
                >
                  {deletingId === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Goals Tab ─────────────────────────────────────────────────────────────────

const GOAL_TYPE_LABELS: Record<string, string> = {
  savings: "Savings Target",
  debt_payoff: "Debt Payoff",
  net_worth: "Net Worth Milestone",
  spend_limit: "Spending Limit",
};

function GoalsTab() {
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [projections, setProjections] = useState<Record<string, GoalProjection>>({});
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newType, setNewType]   = useState("savings");
  const [newTarget, setNewTarget] = useState("");
  const [newDate, setNewDate]   = useState("");
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const gs = await api.goals.list();
      setGoals(gs);
      // Load projections in parallel
      const projs = await Promise.all(gs.map(g => api.goals.projection(g.id).catch(() => null)));
      const projMap: Record<string, GoalProjection> = {};
      gs.forEach((g, i) => { if (projs[i]) projMap[g.id] = projs[i]!; });
      setProjections(projMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAddGoal() {
    if (!newName || !newTarget) return;
    setSaving(true);
    try {
      await api.goals.create({
        name: newName,
        goal_type: newType,
        target_amount: parseFloat(newTarget),
        current_amount: 0,
        target_date: newDate || null,
      });
      setNewName(""); setNewType("savings"); setNewTarget(""); setNewDate("");
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-ink-tertiary gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-[13px]">Loading goals…</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-tertiary">{goals.filter(g => !g.is_completed).length} active goals</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="hive-btn-ghost flex items-center gap-1.5 text-[12px] text-honey"
        >
          <Plus className="w-3.5 h-3.5" /> Add Goal
        </button>
      </div>

      {showForm && (
        <div className="hive-card p-5 space-y-3">
          <p className="text-[13px] font-medium text-ink-primary">New Goal</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="hive-label block mb-1">Goal Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="House down payment, emergency fund…"
                className="w-full text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-honey/30"
              />
            </div>
            <div>
              <label className="hive-label block mb-1">Type</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="w-full text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary"
              >
                {Object.entries(GOAL_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="hive-label block mb-1">Target Amount</label>
              <input
                value={newTarget}
                onChange={e => setNewTarget(e.target.value)}
                type="number"
                placeholder="50000"
                className="w-full text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-honey/30"
              />
            </div>
            <div>
              <label className="hive-label block mb-1">Target Date (optional)</label>
              <input
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                type="date"
                className="w-full text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-2 text-ink-primary focus:outline-none focus:border-honey/30"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddGoal}
              disabled={saving || !newName || !newTarget}
              className="text-[12px] px-4 py-2 rounded-lg bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40 font-medium"
            >
              {saving ? "Saving…" : "Create Goal"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-[12px] px-4 py-2 rounded-lg hover:bg-white/[0.05] text-ink-tertiary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {goals.filter(g => !g.is_completed).length === 0 && !showForm && (
        <div className="hive-card py-12 text-center">
          <Target className="w-8 h-8 text-ink-tertiary/40 mx-auto mb-3" />
          <p className="text-[13px] text-ink-tertiary">No goals yet. Add one to start planning.</p>
        </div>
      )}

      {goals.filter(g => !g.is_completed).map(goal => {
        const proj = projections[goal.id];
        const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
        return (
          <div key={goal.id} className="hive-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px] font-semibold text-ink-primary">{goal.name}</p>
                <p className="text-[11px] text-ink-tertiary mt-0.5">
                  {GOAL_TYPE_LABELS[goal.goal_type] ?? goal.goal_type}
                  {goal.target_date ? ` · Target: ${fmtDate(goal.target_date)}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[18px] font-bold font-mono text-ink-primary tabular-nums">
                  {fmt(goal.current_amount)}
                </p>
                <p className="text-[11px] text-ink-tertiary">of {fmt(goal.target_amount)}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[10px] text-ink-tertiary mb-1">
                <span>{pct.toFixed(1)}% complete</span>
                <span>{fmt(goal.target_amount - goal.current_amount)} remaining</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 80 ? "#32D583" : pct >= 40 ? "#F5B942" : "#F97066",
                  }}
                />
              </div>
            </div>

            {/* Projection data */}
            {proj && (
              <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] px-4 py-3 space-y-1">
                {proj.projected_completion_date && (
                  <p className="text-[12px] text-ink-secondary">
                    At your current savings rate of{" "}
                    <span className="text-semantic-income font-semibold">{fmt(proj.monthly_savings_avg)}/mo</span>,
                    you&apos;ll reach this goal by{" "}
                    <span className={cn("font-semibold", proj.on_track ? "text-semantic-income" : "text-semantic-expense")}>
                      {fmtDate(proj.projected_completion_date)}
                    </span>
                    {!proj.on_track && goal.target_date && " (behind target)"}.
                  </p>
                )}
                {proj.required_monthly_to_hit_target !== null && !proj.on_track && (
                  <p className="text-[12px] text-ink-tertiary">
                    You need{" "}
                    <span className="text-honey font-semibold">{fmt(proj.required_monthly_to_hit_target)}/mo</span>
                    {" "}to hit your target date
                    {proj.monthly_savings_avg > 0
                      ? ` — ${fmt(proj.required_monthly_to_hit_target - proj.monthly_savings_avg)}/mo more than current pace.`
                      : "."}
                  </p>
                )}
                {proj.on_track && (
                  <p className="text-[12px] text-semantic-income flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> On track to hit your target.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Trim the Fat Tab ──────────────────────────────────────────────────────────

function TrimTab() {
  const [recs, setRecs]         = useState<TrimRecommendation[]>([]);
  const [loading, setLoading]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [error, setError]       = useState(false);

  async function loadRecs() {
    setLoading(true);
    setError(false);
    try {
      const r = await api.plan.trimRecommendations();
      setRecs(r);
      setLoaded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetBudget(rec: TrimRecommendation) {
    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    await api.budgets.upsert(rec.category, month, rec.suggested_monthly);
  }

  const totalSavings = recs.reduce((s, r) => s + r.savings_per_month, 0);

  return (
    <div className="space-y-5">
      {!loaded && !loading && (
        <div className="hive-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-honey/10 flex items-center justify-center">
            <Scissors className="w-6 h-6 text-honey" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-ink-primary">Analyze Your Budget</p>
            <p className="text-[12px] text-ink-tertiary mt-1 max-w-sm">
              Claude will analyze your last 3 months of spending and your goals to find the highest-leverage cuts.
            </p>
          </div>
          <button
            onClick={loadRecs}
            className="text-[13px] px-5 py-2.5 rounded-xl bg-honey/20 text-honey hover:bg-honey/30 transition-colors font-medium"
          >
            Analyze Spending
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-ink-tertiary gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[13px]">Claude is analyzing your spending…</span>
        </div>
      )}

      {error && (
        <div className="hive-card p-6 text-center">
          <p className="text-[13px] text-semantic-expense mb-3">Analysis failed. Check backend logs.</p>
          <button onClick={loadRecs} className="text-[12px] text-honey hover:underline">Try again</button>
        </div>
      )}

      {loaded && recs.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-ink-primary">Budget Optimization Opportunities</p>
              <p className="text-[11px] text-ink-tertiary mt-0.5">
                {recs.length} recommendations · {fmt(totalSavings)}/mo potential savings
              </p>
            </div>
            <button onClick={loadRecs} className="text-[11px] text-honey hover:underline">Re-analyze</button>
          </div>

          <div className="space-y-3">
            {recs.map((rec, i) => (
              <div key={i} className="hive-card p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-[13px] font-semibold text-ink-primary">
                      {rec.category}{rec.subcategory ? ` · ${rec.subcategory}` : ""}
                    </p>
                    <p className="text-[12px] text-ink-tertiary mt-0.5">{rec.rationale}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[18px] font-bold font-mono text-semantic-income tabular-nums">
                      +{fmt(rec.savings_per_month)}/mo
                    </p>
                    <p className="text-[10px] text-ink-tertiary">savings</p>
                  </div>
                </div>

                {/* Current vs suggested */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-1.5 rounded-full bg-semantic-expense/30 relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-semantic-expense"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <span className="text-[11px] text-ink-tertiary tabular-nums shrink-0">
                    {fmt(rec.current_monthly)} → {fmt(rec.suggested_monthly)}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-semantic-income/30 relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-semantic-income"
                      style={{ width: `${(rec.suggested_monthly / rec.current_monthly) * 100}%` }}
                    />
                  </div>
                </div>

                {rec.goal_impact && (
                  <p className="text-[11px] text-honey mb-3">🎯 {rec.goal_impact}</p>
                )}

                <button
                  onClick={() => handleSetBudget(rec)}
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-ink-secondary hover:text-ink-primary transition-colors flex items-center gap-1.5"
                >
                  <Target className="w-3 h-3" />
                  Set as budget ({fmt(rec.suggested_monthly)}/mo)
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {loaded && recs.length === 0 && (
        <div className="hive-card py-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-semantic-income mx-auto mb-3" />
          <p className="text-[13px] text-ink-secondary font-medium">Your spending looks well-optimized!</p>
          <p className="text-[12px] text-ink-tertiary mt-1">No significant cuts identified based on your goals.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [tab, setTab] = useState<Tab>("projection");

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "projection", label: "Projection",    icon: TrendingUp },
    { id: "goals",      label: "Goals",         icon: Target     },
    { id: "trim",       label: "Trim the Fat",  icon: Scissors   },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Financial Planning</h1>
        <p className="text-[13px] text-ink-tertiary mt-0.5">Project your future, set goals, trim the fat</p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-elevated rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium transition-all",
              tab === id
                ? "bg-white/[0.08] text-ink-primary shadow-sm"
                : "text-ink-tertiary hover:text-ink-secondary"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "projection" && <ProjectionTab />}
      {tab === "goals"      && <GoalsTab />}
      {tab === "trim"       && <TrimTab />}
    </div>
  );
}
```

Note: `api.budgets.upsert` may need to be added to `api.ts` if it doesn't exist. Check the budgets API — it should call `POST /api/budgets` with `{ category, month, budget_amount }`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/plan/page.tsx
git commit -m "feat: financial planning hub page with projection, goals, and trim-the-fat tabs"
```

---

## Task 9: Add `/plan` to sidebar navigation

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Add Planning to the FINANCES nav group**

In `Sidebar.tsx`, find the `FINANCES` group import block. Add `Calculator` to the lucide-react imports (or use `TrendingUp` which is already imported):

```typescript
import { ..., TrendingUp, ... } from "lucide-react";
```

In the `FINANCES` group items array, add after the Goals entry:

```typescript
{ href: "/plan", label: "Planning", icon: TrendingUp, exact: false },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: add Planning to sidebar navigation"
```

---

## Final Verification

- [ ] Rebuild and restart

```bash
docker compose build backend frontend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d
docker compose logs backend --tail=20
```

Expected: No import errors, `Application startup complete.`

- [ ] Navigate to `/plan` — confirm three tabs render, Projection tab loads chart data.

- [ ] Add a plan event (e.g., "New Car", $35,000, 6 months from now) — confirm the yellow dashed line shows a dip and the event appears in the list.

- [ ] Switch to Goals tab — confirm goals load with progress bars and projection text.

- [ ] Switch to Trim the Fat — click "Analyze Spending" and confirm recommendations load within ~5 seconds.
