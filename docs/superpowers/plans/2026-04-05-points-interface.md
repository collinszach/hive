# Points Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/points` page into an interactive two-section layout — program portfolio cards with a time window picker and inline balance editing at the top, and a searchable/filterable earn activity ledger at the bottom.

**Architecture:** Three backend changes (fix summary date filter bug, extend ledger with merchant/amount, add balance upsert). Frontend converts from a static server component to a `"use client"` component split into focused sub-components. Search and filter are pure client-side over fetched data — no extra API calls on keystroke.

**Tech Stack:** FastAPI + SQLAlchemy (async) · Next.js 14 App Router · Tailwind CSS · TypeScript strict mode · shadcn/ui

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Modify | `backend/app/api/points.py` | Add `days` param to summary + fix date filter; extend ledger with merchant/amount; add balance upsert endpoint |
| Modify | `frontend/src/lib/api.ts` | Add `LedgerEntry`, `PointsBalanceResponse` types; add `api.points.ledger()` and `api.points.setBalance()` methods; update `api.points.summary()` to accept `days` |
| Create | `frontend/src/app/points/_components/TimeWindowPicker.tsx` | Pill button group for 30d/90d/180d/1y |
| Create | `frontend/src/app/points/_components/ProgramCard.tsx` | Individual program card with inline balance editing |
| Create | `frontend/src/app/points/_components/EarnActivity.tsx` | Earn activity table with search + multi-select program/card filters |
| Modify | `frontend/src/app/points/page.tsx` | Rebuild as `"use client"` orchestrator — fetches data, owns top-level state, composes sub-components |

---

## Task 1: Backend — Fix summary, extend ledger, add balance upsert

**Tasks 1 and 2 (Frontend API client) can be worked in parallel by separate agents — they touch different files.**

**Files:**
- Modify: `backend/app/api/points.py`

### Step 1.1 — Write failing tests for the three backend changes

Create `backend/tests/test_points_api_logic.py`:

```python
"""
Tests for points API logic — date filtering, ledger enrichment mapping, balance upsert logic.
These test pure logic helpers extracted from the endpoint, not the DB calls themselves.
"""
from datetime import date, timedelta
import pytest

from app.points.tracker import EARN_RULES


# ---------------------------------------------------------------------------
# program → card_slug mapping (used by balance upsert)
# ---------------------------------------------------------------------------

def _build_program_to_card_slug() -> dict[str, str]:
    """Derives program→card_slug from EARN_RULES (first rule seen wins)."""
    mapping: dict[str, str] = {}
    for rule in EARN_RULES:
        if rule.program not in mapping:
            mapping[rule.program] = rule.card_slug
    return mapping


class TestProgramToCardSlugMapping:
    def test_all_six_programs_mapped(self):
        mapping = _build_program_to_card_slug()
        expected = {
            "Amex MR", "Chase UR", "SW RR",
            "Bilt Points", "WF Rewards", "Capital One Miles",
        }
        assert set(mapping.keys()) == expected

    def test_amex_mr_maps_to_amex_gold(self):
        mapping = _build_program_to_card_slug()
        assert mapping["Amex MR"] == "amex_gold"

    def test_chase_ur_maps_to_chase_sapphire(self):
        mapping = _build_program_to_card_slug()
        assert mapping["Chase UR"] == "chase_sapphire"

    def test_sw_rr_maps_to_chase_southwest(self):
        mapping = _build_program_to_card_slug()
        assert mapping["SW RR"] == "chase_southwest"

    def test_bilt_maps_to_bilt_blue(self):
        mapping = _build_program_to_card_slug()
        assert mapping["Bilt Points"] == "bilt_blue"

    def test_wf_rewards_maps_to_wf_autograph(self):
        mapping = _build_program_to_card_slug()
        assert mapping["WF Rewards"] == "wf_autograph"

    def test_capital_one_maps_to_venture_x(self):
        mapping = _build_program_to_card_slug()
        assert mapping["Capital One Miles"] == "venture_x"


# ---------------------------------------------------------------------------
# days → cutoff date calculation
# ---------------------------------------------------------------------------

class TestDaysCutoff:
    def test_90_days_is_roughly_3_months(self):
        today = date.today()
        cutoff = today - timedelta(days=90)
        assert (today - cutoff).days == 90

    def test_365_days_is_one_year(self):
        today = date.today()
        cutoff = today - timedelta(days=365)
        assert (today - cutoff).days == 365

    def test_30_days(self):
        today = date.today()
        cutoff = today - timedelta(days=30)
        assert (today - cutoff).days == 30
```

- [ ] Create the file above at `backend/tests/test_points_api_logic.py`

### Step 1.2 — Run tests to verify they fail

```bash
cd /home/zach/hive
docker compose exec backend pytest tests/test_points_api_logic.py -v
```

Expected: **PASS** — these tests are pure logic with no external deps. If they fail, something is wrong with the import path.

### Step 1.3 — Implement the three backend changes

Replace `backend/app/api/points.py` with the following (complete file):

```python
"""Points API — summary, optimizer, balance upsert, and ledger endpoints."""
import logging
import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.points_balance import PointsBalance
from app.models.points_ledger import PointsLedger
from app.points.tracker import (
    EARN_RULES,
    POINT_VALUES_CPP,
    REDEMPTION_THRESHOLDS,
    CardOption,
    get_best_card_for_purchase,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/points", tags=["points"])

# ---------------------------------------------------------------------------
# Program → card_slug mapping (derived from earn rules — single source of truth)
# ---------------------------------------------------------------------------

_PROGRAM_TO_CARD_SLUG: dict[str, str] = {}
for _rule in EARN_RULES:
    if _rule.program not in _PROGRAM_TO_CARD_SLUG:
        _PROGRAM_TO_CARD_SLUG[_rule.program] = _rule.card_slug


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class ProgramSummary(BaseModel):
    program: str
    points_earned_90d: float          # field name kept for backward compat; reflects actual window
    manual_balance: Optional[int]
    estimated_value_dollars: float
    redemption_threshold: Optional[int]
    above_threshold: bool


class PointsSummaryResponse(BaseModel):
    programs: list[ProgramSummary]
    total_estimated_value_dollars: float


class CardOptionOut(BaseModel):
    card_slug: str
    account_name: Optional[str] = None
    program: str
    earn_rate: float
    points_earned: float
    dollar_value: float
    is_best: bool


class OptimizerResponse(BaseModel):
    category: Optional[str]
    subcategory: Optional[str]
    amount: float
    cards: list[CardOptionOut]


class LedgerEntryOut(BaseModel):
    transaction_id: uuid.UUID
    account_id: uuid.UUID
    card_slug: str
    program: str
    points_earned: float
    earn_rate: float
    category: Optional[str]
    subcategory: Optional[str]
    merchant: Optional[str]
    amount: float


class BalanceUpsertRequest(BaseModel):
    program: str
    balance: int


class BalanceUpsertResponse(BaseModel):
    program: str
    balance: int
    updated_at: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=PointsSummaryResponse)
async def points_summary(
    days: int = Query(90, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
) -> PointsSummaryResponse:
    """
    Total points earned (within `days` window) per program, plus manual balance if entered,
    estimated dollar value, and redemption nudge.
    """
    from app.models.transaction import Transaction

    cutoff = date.today() - timedelta(days=days)

    # Aggregate earned points from ledger joined to transactions for date filter
    earned_rows = await db.execute(
        select(PointsLedger.program, func.sum(PointsLedger.points_earned))
        .join(Transaction, PointsLedger.transaction_id == Transaction.id)
        .where(Transaction.date >= cutoff)
        .group_by(PointsLedger.program)
    )
    earned_by_program: dict[str, float] = {
        row[0]: float(row[1]) for row in earned_rows.all()
    }

    # Latest manual balances (sum per program — one row per card per day)
    latest_balances = await db.execute(
        select(PointsBalance.program, func.sum(PointsBalance.balance))
        .group_by(PointsBalance.program)
    )
    manual_by_program: dict[str, int] = {
        row[0]: int(row[1]) for row in latest_balances.all()
    }

    all_programs = set(earned_by_program) | set(manual_by_program) | set(POINT_VALUES_CPP)
    programs = []
    total_value = 0.0

    for program in sorted(all_programs):
        earned = earned_by_program.get(program, 0.0)
        manual = manual_by_program.get(program)
        cpp = POINT_VALUES_CPP.get(program, 1.0)
        threshold = REDEMPTION_THRESHOLDS.get(program)

        balance_for_value = float(manual) if manual is not None else earned
        est_value = round(balance_for_value * cpp / 100.0, 2)
        total_value += est_value

        programs.append(ProgramSummary(
            program=program,
            points_earned_90d=round(earned, 2),
            manual_balance=manual,
            estimated_value_dollars=est_value,
            redemption_threshold=threshold,
            above_threshold=threshold is not None and balance_for_value >= threshold,
        ))

    return PointsSummaryResponse(
        programs=programs,
        total_estimated_value_dollars=round(total_value, 2),
    )


@router.put("/balance", response_model=BalanceUpsertResponse)
async def upsert_balance(
    body: BalanceUpsertRequest,
    db: AsyncSession = Depends(get_db),
) -> BalanceUpsertResponse:
    """
    Upsert a manual points balance for a program.
    Uses today's date as the as_of date; updates if a row already exists for today.
    """
    from datetime import datetime

    card_slug = _PROGRAM_TO_CARD_SLUG.get(body.program)
    if card_slug is None:
        raise HTTPException(status_code=422, detail=f"Unknown program: {body.program}")

    today = date.today()

    stmt = (
        pg_insert(PointsBalance)
        .values(
            card_slug=card_slug,
            program=body.program,
            balance=body.balance,
            as_of=today,
            source="manual",
        )
        .on_conflict_do_update(
            constraint="uq_points_balance_card_date",
            set_={"balance": body.balance},
        )
    )
    await db.execute(stmt)
    await db.commit()

    return BalanceUpsertResponse(
        program=body.program,
        balance=body.balance,
        updated_at=datetime.now().isoformat(),
    )


@router.get("/optimize", response_model=OptimizerResponse)
async def optimize_card(
    category: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    amount: float = Query(100.0, gt=0),
    db: AsyncSession = Depends(get_db),
) -> OptimizerResponse:
    """Return ranked card list for a given purchase category and amount."""
    from app.models.account import Account

    options: list[CardOption] = get_best_card_for_purchase(category, subcategory, amount)

    slug_name_rows = await db.execute(
        select(Account.card_slug, Account.name)
        .where(Account.card_slug.isnot(None), Account.is_active == True)  # noqa: E712
    )
    slug_to_name: dict[str, str] = {row.card_slug: row.name for row in slug_name_rows.all()}

    cards_out = []
    for i, opt in enumerate(options):
        cards_out.append(CardOptionOut(
            card_slug=opt.card_slug,
            account_name=slug_to_name.get(opt.card_slug),
            program=opt.program,
            earn_rate=opt.earn_rate,
            points_earned=opt.points_earned,
            dollar_value=opt.dollar_value,
            is_best=(i == 0),
        ))

    return OptimizerResponse(
        category=category,
        subcategory=subcategory,
        amount=amount,
        cards=cards_out,
    )


@router.get("/ledger", response_model=list[LedgerEntryOut])
async def points_ledger(
    days: int = Query(90, ge=7, le=365),
    account_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[LedgerEntryOut]:
    """
    Transaction-level points ledger.
    `days` controls the lookback window (default 90).
    `account_id` optionally narrows to a specific account.
    """
    from sqlalchemy import and_
    from app.models.transaction import Transaction

    cutoff = date.today() - timedelta(days=days)

    filters = [Transaction.date >= cutoff]
    if account_id:
        filters.append(PointsLedger.account_id == account_id)

    result = await db.execute(
        select(
            PointsLedger,
            Transaction.merchant,
            Transaction.amount,
        )
        .join(Transaction, PointsLedger.transaction_id == Transaction.id)
        .where(and_(*filters))
        .order_by(Transaction.date.desc())
        .limit(500)
    )

    entries = []
    for row in result.all():
        ledger, merchant, amount = row
        entries.append(LedgerEntryOut(
            transaction_id=ledger.transaction_id,
            account_id=ledger.account_id,
            card_slug=ledger.card_slug,
            program=ledger.program,
            points_earned=float(ledger.points_earned),
            earn_rate=float(ledger.earn_rate),
            category=ledger.category,
            subcategory=ledger.subcategory,
            merchant=merchant,
            amount=float(amount),
        ))

    return entries
```

- [ ] Replace `backend/app/api/points.py` with the code above

### Step 1.4 — Run tests to verify they pass

```bash
cd /home/zach/hive
docker compose exec backend pytest tests/test_points_api_logic.py tests/test_points_tracker.py -v
```

Expected: all tests **PASS**

### Step 1.5 — Smoke-test the endpoints manually

```bash
# Test summary with days param
curl -s "http://localhost:8000/api/points/summary?days=30" | python3 -m json.tool | head -30

# Test balance upsert
curl -s -X PUT "http://localhost:8000/api/points/balance" \
  -H "Content-Type: application/json" \
  -d '{"program": "Chase UR", "balance": 50000}' | python3 -m json.tool

# Test ledger with days param
curl -s "http://localhost:8000/api/points/ledger?days=30" | python3 -m json.tool | head -40
```

Expected: JSON responses with correct shapes. Balance upsert returns `{ program, balance, updated_at }`. Ledger entries include `merchant` and `amount` fields.

### Step 1.6 — Commit

```bash
cd /home/zach/hive
git add backend/app/api/points.py backend/tests/test_points_api_logic.py
git commit -m "feat(points): fix summary date filter, extend ledger with merchant/amount, add balance upsert endpoint"
```

---

## Task 2: Frontend — Update API client

**Can run in parallel with Task 1 — touches only `frontend/src/lib/api.ts`.**

**Files:**
- Modify: `frontend/src/lib/api.ts`

### Step 2.1 — Add new types

Find the `CardOption` interface (around line 173) and add after the existing `OptimizerResponse` interface:

```typescript
export interface LedgerEntry {
  transaction_id: string;
  account_id: string;
  card_slug: string;
  program: string;
  points_earned: number;
  earn_rate: number;
  category: string | null;
  subcategory: string | null;
  merchant: string | null;
  amount: number;
}

export interface PointsBalanceResponse {
  program: string;
  balance: number;
  updated_at: string;
}
```

- [ ] Add both interfaces after `OptimizerResponse` in `frontend/src/lib/api.ts`

### Step 2.2 — Update the points API section

Find the existing `points` section in the `api` object (around line 505):

```typescript
  points: {
    summary: () => get<PointsSummary>("/api/points/summary"),
    optimize: (params: { category?: string; subcategory?: string; amount: number }) =>
      get<OptimizerResponse>("/api/points/optimize", params as Record<string, string | number | undefined>),
  },
```

Replace it with:

```typescript
  points: {
    summary: (days?: number) =>
      get<PointsSummary>("/api/points/summary", days ? { days } : undefined),
    optimize: (params: { category?: string; subcategory?: string; amount: number }) =>
      get<OptimizerResponse>("/api/points/optimize", params as Record<string, string | number | undefined>),
    ledger: (params?: { days?: number; account_id?: string }) =>
      get<LedgerEntry[]>("/api/points/ledger", params as Record<string, string | number | undefined>),
    setBalance: (program: string, balance: number) =>
      put<PointsBalanceResponse>("/api/points/balance", { program, balance }),
  },
```

- [ ] Apply the replacement in `frontend/src/lib/api.ts`

### Step 2.3 — Verify TypeScript compiles

```bash
cd /home/zach/hive/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to this file)

### Step 2.4 — Commit

```bash
cd /home/zach/hive
git add frontend/src/lib/api.ts
git commit -m "feat(points): add ledger and setBalance API client methods, days param on summary"
```

---

## Task 3: Frontend — Sub-components

**Depends on Task 2 (uses `LedgerEntry`, `ProgramSummary` types). Tasks 3 and 4 modify different files and can run in parallel if desired.**

**Files:**
- Create: `frontend/src/app/points/_components/TimeWindowPicker.tsx`
- Create: `frontend/src/app/points/_components/ProgramCard.tsx`
- Create: `frontend/src/app/points/_components/EarnActivity.tsx`

### Step 3.1 — Create `TimeWindowPicker`

Create `frontend/src/app/points/_components/TimeWindowPicker.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

const OPTIONS: { label: string; days: number }[] = [
  { label: "30d",  days: 30  },
  { label: "90d",  days: 90  },
  { label: "180d", days: 180 },
  { label: "1y",   days: 365 },
];

interface TimeWindowPickerProps {
  value: number;
  onChange: (days: number) => void;
}

export function TimeWindowPicker({ value, onChange }: TimeWindowPickerProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
      {OPTIONS.map((opt) => (
        <button
          key={opt.days}
          onClick={() => onChange(opt.days)}
          className={cn(
            "px-3 py-1 rounded-md text-[12px] font-medium transition-all duration-150",
            value === opt.days
              ? "bg-honey/20 text-honey"
              : "text-ink-tertiary hover:text-ink-secondary"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] Create the file above

### Step 3.2 — Create `ProgramCard`

Create `frontend/src/app/points/_components/ProgramCard.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { Bell, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/utils";
import { api, ProgramSummary } from "@/lib/api";

const PROGRAM_ACCENTS: Record<string, { bar: string; text: string; bg: string }> = {
  "Amex MR":           { bar: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/10" },
  "Chase UR":          { bar: "bg-sky-400",      text: "text-sky-400",     bg: "bg-sky-400/10"     },
  "SW RR":             { bar: "bg-orange-400",   text: "text-orange-400",  bg: "bg-orange-400/10"  },
  "Bilt Points":       { bar: "bg-violet-400",   text: "text-violet-400",  bg: "bg-violet-400/10"  },
  "WF Rewards":        { bar: "bg-rose-400",     text: "text-rose-400",    bg: "bg-rose-400/10"    },
  "Capital One Miles": { bar: "bg-blue-400",     text: "text-blue-400",    bg: "bg-blue-400/10"    },
};

interface ProgramCardProps {
  program: ProgramSummary;
  onBalanceUpdate: (program: string, balance: number) => void;
}

export function ProgramCard({ program: p, onBalanceUpdate }: ProgramCardProps) {
  const [editing, setEditing]   = useState(false);
  const [inputVal, setInputVal] = useState(String(p.manual_balance ?? ""));
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accent = PROGRAM_ACCENTS[p.program] ?? { bar: "bg-honey", text: "text-honey", bg: "bg-honey/10" };

  const balanceForProgress = p.manual_balance ?? p.points_earned_90d;
  const progress = p.redemption_threshold
    ? Math.min((balanceForProgress / p.redemption_threshold) * 100, 100)
    : null;

  function startEdit() {
    setInputVal(String(p.manual_balance ?? ""));
    setSaveError(false);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(false);
  }

  async function commitEdit() {
    const parsed = parseInt(inputVal.replace(/,/g, ""), 10);
    if (isNaN(parsed) || parsed < 0) {
      cancelEdit();
      return;
    }
    setSaving(true);
    setSaveError(false);
    try {
      await api.points.setBalance(p.program, parsed);
      onBalanceUpdate(p.program, parsed);
      setEditing(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn(
      "hive-card p-5 space-y-4 transition-all duration-200",
      p.above_threshold && "border-honey/20",
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[14px] font-medium text-ink-primary">{p.program}</p>
          {p.above_threshold && (
            <div className="flex items-center gap-1.5 mt-1">
              <Bell className="w-3 h-3 text-honey" />
              <span className="text-[11px] text-honey font-medium">Ready to redeem</span>
            </div>
          )}
        </div>
        <div className={cn("px-2.5 py-1 rounded-lg text-[13px] font-semibold font-mono tabular-nums", accent.bg, accent.text)}>
          {fmt(p.estimated_value_dollars)}
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        {/* Balance row — editable */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-tertiary">Balance</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                className="w-24 text-right text-[12px] font-mono bg-white/[0.06] border border-white/[0.12] rounded px-1.5 py-0.5 text-ink-primary focus:outline-none focus:border-honey/40"
                placeholder="0"
              />
              <button
                onClick={commitEdit}
                disabled={saving}
                className="text-semantic-income hover:opacity-80 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={cancelEdit} className="text-ink-tertiary hover:opacity-80">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="group flex items-center gap-1"
            >
              {p.manual_balance !== null ? (
                <span className="text-[12px] font-mono text-ink-secondary tabular-nums group-hover:text-ink-primary transition-colors">
                  {p.manual_balance.toLocaleString()} pts
                </span>
              ) : (
                <span className="text-[12px] text-ink-tertiary/40 group-hover:text-ink-tertiary transition-colors">
                  Add balance
                </span>
              )}
            </button>
          )}
        </div>
        {saveError && (
          <p className="text-[11px] text-semantic-expense">Failed to save — try again</p>
        )}

        {/* Earned in window */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-tertiary">Earned (window)</span>
          <span className="text-[12px] font-mono text-ink-secondary tabular-nums">
            {Math.round(p.points_earned_90d).toLocaleString()} pts
          </span>
        </div>

        {/* Threshold */}
        {p.redemption_threshold && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-tertiary">Threshold</span>
            <span className="text-[12px] font-mono text-ink-tertiary tabular-nums">
              {p.redemption_threshold.toLocaleString()} pts
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <div>
          <div className="h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", accent.bar)}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-ink-tertiary/60 mt-1.5">
            {p.above_threshold
              ? "Above redemption threshold"
              : `${(p.redemption_threshold! - balanceForProgress).toLocaleString()} pts to threshold`}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] Create the file above

### Step 3.3 — Create `EarnActivity`

Create `frontend/src/app/points/_components/EarnActivity.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/utils";
import { LedgerEntry } from "@/lib/api";
import { POINT_VALUES_CPP } from "@/lib/pointsConstants";

const CARD_LABELS: Record<string, string> = {
  amex_gold:      "Amex Gold",
  chase_sapphire: "Chase Sapphire",
  chase_southwest: "Chase Southwest",
  bilt_blue:      "Bilt Blue",
  wf_autograph:   "WF Autograph",
  venture_x:      "Venture X",
};

interface EarnActivityProps {
  ledger: LedgerEntry[];
  loading: boolean;
  error: boolean;
}

export function EarnActivity({ ledger, loading, error }: EarnActivityProps) {
  const [search, setSearch]               = useState("");
  const [filterPrograms, setFilterPrograms] = useState<string[]>([]);
  const [filterCards, setFilterCards]     = useState<string[]>([]);

  const allPrograms = useMemo(() => [...new Set(ledger.map((e) => e.program))].sort(), [ledger]);
  const allCards    = useMemo(() => [...new Set(ledger.map((e) => e.card_slug))].sort(), [ledger]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ledger.filter((e) => {
      if (q && !(e.merchant ?? "").toLowerCase().includes(q)) return false;
      if (filterPrograms.length && !filterPrograms.includes(e.program)) return false;
      if (filterCards.length && !filterCards.includes(e.card_slug)) return false;
      return true;
    });
  }, [ledger, search, filterPrograms, filterCards]);

  function toggleProgram(p: string) {
    setFilterPrograms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function toggleCard(c: string) {
    setFilterCards((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  function clearFilters() {
    setSearch("");
    setFilterPrograms([]);
    setFilterCards([]);
  }

  const hasFilters = search || filterPrograms.length || filterCards.length;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-ink-primary">
          Earn Activity
          {!loading && (
            <span className="ml-2 text-[12px] font-normal text-ink-tertiary">
              {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-[12px] text-ink-tertiary hover:text-ink-secondary flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search merchant…"
          className="w-full pl-8 pr-3 py-2 text-[13px] bg-white/[0.04] border border-white/[0.07] rounded-lg text-ink-primary placeholder:text-ink-tertiary/40 focus:outline-none focus:border-honey/30 transition-colors"
        />
      </div>

      {/* Filter pills */}
      {(allPrograms.length > 1 || allCards.length > 1) && (
        <div className="flex flex-wrap gap-2">
          {allPrograms.map((prog) => (
            <button
              key={prog}
              onClick={() => toggleProgram(prog)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-150",
                filterPrograms.includes(prog)
                  ? "bg-honey/15 border-honey/30 text-honey"
                  : "border-white/[0.08] text-ink-tertiary hover:text-ink-secondary"
              )}
            >
              {prog}
            </button>
          ))}
          <div className="w-px bg-white/[0.06] self-stretch" />
          {allCards.map((slug) => (
            <button
              key={slug}
              onClick={() => toggleCard(slug)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-150",
                filterCards.includes(slug)
                  ? "bg-sky-400/15 border-sky-400/30 text-sky-400"
                  : "border-white/[0.08] text-ink-tertiary hover:text-ink-secondary"
              )}
            >
              {CARD_LABELS[slug] ?? slug}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="hive-card p-6 text-center text-[13px] text-ink-tertiary border-dashed">
          Failed to load earn activity.
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="hive-card p-10 text-center border-dashed">
          <p className="text-[14px] text-ink-secondary mb-1">No transactions found</p>
          <p className="text-[12px] text-ink-tertiary">Try adjusting your search or filters.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="hive-card overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["Date", "Merchant", "Category", "Card", "Rate", "Points", "Value"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] text-ink-tertiary font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const cpp = POINT_VALUES_CPP[entry.program] ?? 1.0;
                const estValue = (entry.points_earned * cpp) / 100;
                return (
                  <tr
                    key={entry.transaction_id}
                    className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-ink-tertiary whitespace-nowrap">
                      {new Date(entry.amount).toLocaleDateString === undefined
                        ? "—"
                        : entry.transaction_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5 text-ink-primary max-w-[160px] truncate">
                      {entry.merchant ?? <span className="text-ink-tertiary/50">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-ink-tertiary">
                      {[entry.category, entry.subcategory].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-tertiary">
                      {CARD_LABELS[entry.card_slug] ?? entry.card_slug}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-ink-secondary tabular-nums">
                      {entry.earn_rate}x
                    </td>
                    <td className="px-4 py-2.5 font-mono text-ink-secondary tabular-nums">
                      {Math.round(entry.points_earned).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-semantic-income tabular-nums">
                      {fmt(estValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] Create the file above

### Step 3.4 — Create `pointsConstants.ts` (shared constants for frontend)

The `EarnActivity` component needs `POINT_VALUES_CPP`. Rather than duplicating the values, create a constants file:

Create `frontend/src/lib/pointsConstants.ts`:

```typescript
/** Points-per-cent valuations — mirrors CLAUDE.md / backend tracker.py exactly */
export const POINT_VALUES_CPP: Record<string, number> = {
  "Amex MR":           2.0,
  "Chase UR":          2.05,
  "SW RR":             1.4,
  "Bilt Points":       2.1,
  "WF Rewards":        1.0,
  "Capital One Miles": 1.85,
};
```

- [ ] Create `frontend/src/lib/pointsConstants.ts`

### Step 3.5 — Verify TypeScript compiles

```bash
cd /home/zach/hive/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors

### Step 3.6 — Commit

```bash
cd /home/zach/hive
git add frontend/src/app/points/_components/ frontend/src/lib/pointsConstants.ts
git commit -m "feat(points): add TimeWindowPicker, ProgramCard, EarnActivity components"
```

---

## Task 4: Frontend — Rebuild page.tsx

**Depends on Tasks 2 and 3.**

**Files:**
- Modify: `frontend/src/app/points/page.tsx`

### Step 4.1 — Replace page.tsx with the rebuilt client component

Replace the entire contents of `frontend/src/app/points/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Star } from "lucide-react";
import { api, PointsSummary, LedgerEntry } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { TimeWindowPicker } from "./_components/TimeWindowPicker";
import { ProgramCard } from "./_components/ProgramCard";
import { EarnActivity } from "./_components/EarnActivity";

export default function PointsPage() {
  const [days, setDays]                   = useState<number>(90);
  const [summary, setSummary]             = useState<PointsSummary | null>(null);
  const [ledger, setLedger]               = useState<LedgerEntry[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [summaryError, setSummaryError]   = useState(false);
  const [ledgerError, setLedgerError]     = useState(false);

  const fetchData = useCallback(async (d: number) => {
    setSummaryLoading(true);
    setLedgerLoading(true);
    setSummaryError(false);
    setLedgerError(false);

    // Parallel fetches — each section fails independently
    const [summaryResult, ledgerResult] = await Promise.allSettled([
      api.points.summary(d),
      api.points.ledger({ days: d }),
    ]);

    if (summaryResult.status === "fulfilled") {
      setSummary(summaryResult.value);
    } else {
      setSummaryError(true);
    }
    setSummaryLoading(false);

    if (ledgerResult.status === "fulfilled") {
      setLedger(ledgerResult.value);
    } else {
      setLedgerError(true);
    }
    setLedgerLoading(false);
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  function handleWindowChange(d: number) {
    setDays(d);
  }

  function handleBalanceUpdate(program: string, balance: number) {
    if (!summary) return;
    setSummary({
      ...summary,
      programs: summary.programs.map((p) =>
        p.program === program ? { ...p, manual_balance: balance } : p
      ),
    });
  }

  // ── Summary error state ──────────────────────────────────────────────────
  if (summaryError && !summaryLoading) {
    return (
      <div className="hive-card p-10 text-center text-ink-tertiary text-[13px]">
        Failed to load points summary.
      </div>
    );
  }

  const totalValue = summary?.total_estimated_value_dollars ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">Points</h1>
          <p className="text-[13px] text-ink-tertiary mt-0.5">
            Estimated total value:{" "}
            <span className="text-semantic-income font-semibold">
              {summaryLoading ? "—" : fmt(totalValue)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TimeWindowPicker value={days} onChange={handleWindowChange} />
          <div className="flex items-center gap-2 hive-card px-4 py-2.5">
            <TrendingUp className="w-4 h-4 text-semantic-income" />
            <span className="text-[15px] font-semibold font-mono text-semantic-income tabular-nums">
              {summaryLoading ? "—" : fmt(totalValue)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Program Cards ────────────────────────────────────────────────── */}
      {summaryLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="hive-card p-5 h-44 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      )}

      {!summaryLoading && summary && summary.programs.length === 0 && (
        <div className="hive-card p-16 text-center border-dashed">
          <Star className="w-8 h-8 text-ink-tertiary/30 mx-auto mb-3" />
          <p className="text-[14px] text-ink-secondary mb-1">No points data yet</p>
          <p className="text-[12px] text-ink-tertiary">
            Link accounts and run a sync to get started.
          </p>
        </div>
      )}

      {!summaryLoading && summary && summary.programs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {summary.programs.map((p) => (
            <ProgramCard
              key={p.program}
              program={p}
              onBalanceUpdate={handleBalanceUpdate}
            />
          ))}
        </div>
      )}

      {/* ── Earn Activity ────────────────────────────────────────────────── */}
      <EarnActivity
        ledger={ledger}
        loading={ledgerLoading}
        error={ledgerError}
      />

      <p className="text-[11px] text-ink-tertiary/50">
        Values are estimates based on typical transfer partner redemptions. Actual redemption value may vary.
      </p>
    </div>
  );
}
```

- [ ] Replace `frontend/src/app/points/page.tsx` with the code above

### Step 4.2 — Fix the Date column in EarnActivity

The `EarnActivity` table has a placeholder for the date column. The ledger endpoint returns `transaction_id` but not `date` directly. We need to fix the backend `LedgerEntryOut` to include a `date` field, and update `EarnActivity` accordingly.

**Backend fix** — add `date` to `LedgerEntryOut` in `backend/app/api/points.py`:

Find `LedgerEntryOut`:
```python
class LedgerEntryOut(BaseModel):
    transaction_id: uuid.UUID
    account_id: uuid.UUID
    card_slug: str
    program: str
    points_earned: float
    earn_rate: float
    category: Optional[str]
    subcategory: Optional[str]
    merchant: Optional[str]
    amount: float
```

Replace with:
```python
class LedgerEntryOut(BaseModel):
    transaction_id: uuid.UUID
    account_id: uuid.UUID
    card_slug: str
    program: str
    points_earned: float
    earn_rate: float
    category: Optional[str]
    subcategory: Optional[str]
    merchant: Optional[str]
    amount: float
    date: str   # ISO date string YYYY-MM-DD
```

And in the ledger endpoint, update the select and mapping:

Find the `select(` call in `points_ledger`:
```python
    result = await db.execute(
        select(
            PointsLedger,
            Transaction.merchant,
            Transaction.amount,
        )
```
Replace with:
```python
    result = await db.execute(
        select(
            PointsLedger,
            Transaction.merchant,
            Transaction.amount,
            Transaction.date,
        )
```

Find the row mapping loop:
```python
    for row in result.all():
        ledger, merchant, amount = row
        entries.append(LedgerEntryOut(
            ...
            amount=float(amount),
        ))
```
Replace with:
```python
    for row in result.all():
        ledger, merchant, amount, txn_date = row
        entries.append(LedgerEntryOut(
            transaction_id=ledger.transaction_id,
            account_id=ledger.account_id,
            card_slug=ledger.card_slug,
            program=ledger.program,
            points_earned=float(ledger.points_earned),
            earn_rate=float(ledger.earn_rate),
            category=ledger.category,
            subcategory=ledger.subcategory,
            merchant=merchant,
            amount=float(amount),
            date=txn_date.isoformat(),
        ))
```

**Frontend fix** — add `date: string` to `LedgerEntry` in `frontend/src/lib/api.ts`:

Find:
```typescript
export interface LedgerEntry {
  transaction_id: string;
  account_id: string;
  card_slug: string;
  program: string;
  points_earned: number;
  earn_rate: number;
  category: string | null;
  subcategory: string | null;
  merchant: string | null;
  amount: number;
}
```
Replace with:
```typescript
export interface LedgerEntry {
  transaction_id: string;
  account_id: string;
  card_slug: string;
  program: string;
  points_earned: number;
  earn_rate: number;
  category: string | null;
  subcategory: string | null;
  merchant: string | null;
  amount: number;
  date: string;  // ISO date YYYY-MM-DD
}
```

**Frontend fix** — update the Date cell in `EarnActivity.tsx`. Find the broken date cell:
```tsx
                    <td className="px-4 py-2.5 font-mono text-ink-tertiary whitespace-nowrap">
                      {new Date(entry.amount).toLocaleDateString === undefined
                        ? "—"
                        : entry.transaction_id.slice(0, 8)}
                    </td>
```
Replace with:
```tsx
                    <td className="px-4 py-2.5 font-mono text-ink-tertiary whitespace-nowrap">
                      {entry.date}
                    </td>
```

- [ ] Apply all three fixes above (backend model, backend row mapping, frontend interface, frontend cell)

### Step 4.3 — Verify TypeScript compiles

```bash
cd /home/zach/hive/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors

### Step 4.4 — Rebuild and restart containers

```bash
cd /home/zach/hive
docker compose build backend frontend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d
```

### Step 4.5 — End-to-end smoke test

1. Open `http://localhost:3000/points` (or via Tailscale)
2. Verify 6 program cards render with values
3. Click "30d" — cards and activity should update
4. Click "Add balance" on a program card, enter a number, press Enter — verify it saves and progress bar updates
5. Type a merchant name in the search bar — verify table filters
6. Click program filter pills — verify they work independently of search
7. Click "Clear" — verify all filters reset

### Step 4.6 — Commit

```bash
cd /home/zach/hive
git add frontend/src/app/points/page.tsx \
        frontend/src/app/points/_components/ \
        frontend/src/lib/api.ts \
        backend/app/api/points.py
git commit -m "feat(points): rebuild points page with time window picker, inline balance editing, and earn activity ledger"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Time window picker (30d/90d/180d/1y) — `TimeWindowPicker`, state in page.tsx
- ✅ Program cards with inline balance editing — `ProgramCard`
- ✅ Earn activity section with search — `EarnActivity` search bar
- ✅ Multi-select filters (program + card) — `EarnActivity` filter pills
- ✅ Parallel data fetching, independent failure — `Promise.allSettled` in page.tsx
- ✅ Skeleton loading for both sections — skeleton divs in page.tsx + loading state in EarnActivity
- ✅ Backend: summary date filter fix — Task 1
- ✅ Backend: ledger `merchant`, `amount`, `date` — Task 1 + Step 4.2
- ✅ Backend: balance upsert — Task 1
- ✅ Optimizer excluded — not present anywhere

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:**
- `LedgerEntry` defined in Task 2, used in Tasks 3+4 ✅
- `PointsBalanceResponse` defined in Task 2, used in `api.points.setBalance()` ✅
- `onBalanceUpdate(program: string, balance: number)` — consistent between ProgramCard and page.tsx ✅
- `date: string` added to both backend model and frontend interface in Step 4.2 ✅
- `POINT_VALUES_CPP` imported from `@/lib/pointsConstants` in EarnActivity ✅
