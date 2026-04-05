# Sub-A: Merchant Categorization + Cash Flow Month Picker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline transaction categorization to the merchant detail page (with bulk "apply to all" + points recalc) and a month picker to the cash flow KPI summary.

**Architecture:** Two backend endpoint changes + one new Celery task + two frontend page updates. All changes are additive; no existing logic is removed. Points recalc on single-transaction edits is synchronous; bulk recategorization fires a Celery task and the UI polls for completion.

**Tech Stack:** FastAPI, SQLAlchemy async, Celery + Redis, Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Recharts.

**UI/UX Note:** New UI elements should follow the ORIGIN + MONARCH MONEY design aesthetic: clean Inter typography, generous padding, soft card shadows, smooth transitions. Match the existing Hive dark theme (honey `#F5B942` accent, `#0C0A09` background).

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/app/api/cash_flow.py` | Modify | Add optional `month` query param to `/api/cash-flow/summary` |
| `backend/app/api/transactions.py` | Modify | Add sync points ledger upsert to `PUT /{id}/category` |
| `backend/app/api/merchants.py` | Modify | Add `POST /{name}/bulk-recategorize` + `GET /tasks/{task_id}/status` |
| `backend/app/tasks/points.py` | Modify | Add `recalculate_points_for_merchant` Celery task |
| `backend/app/celery_app.py` | No change | Task is already included via `app.tasks.points` |
| `frontend/src/lib/api.ts` | Modify | Add `merchants.bulkRecategorize`, `tasks.status`, `cashFlow.summaryForMonth` |
| `frontend/src/app/cash-flow/page.tsx` | Modify | Month picker on KPI row; unified bar+picker selection |
| `frontend/src/app/merchants/page.tsx` | Modify | Inline category/subcategory editor; bulk recategorize button + polling badge |

---

## Task 1: Extend cash-flow summary endpoint with `month` param

**Files:**
- Modify: `backend/app/api/cash_flow.py`

- [ ] **Step 1: Open `backend/app/api/cash_flow.py` and update the `cash_flow_summary` function signature and query**

Replace the current `cash_flow_summary` function (lines 52–83) with:

```python
@router.get("/summary")
async def cash_flow_summary(
    month: str | None = None,   # YYYY-MM; defaults to current month
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Income, expenses, and savings rate for a given month (default: current)."""
    from datetime import date
    import calendar

    if month:
        try:
            year, m = int(month[:4]), int(month[5:7])
            month_start = date(year, m, 1)
            last_day = calendar.monthrange(year, m)[1]
            month_end = date(year, m, last_day)
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    else:
        today = date.today()
        month_start = today.replace(day=1)
        month_end = today

    result = await session.execute(
        text("""
            SELECT
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS income,
                SUM(CASE WHEN amount > 0 AND NOT is_excluded AND NOT pending THEN amount ELSE 0 END) AS expenses
            FROM transactions
            WHERE date >= :month_start
              AND date <= :month_end
              AND NOT is_transfer
        """),
        {"month_start": month_start, "month_end": month_end},
    )
    row = result.fetchone()
    income = float(row.income or 0)
    expenses = float(row.expenses or 0)
    savings = income - expenses
    savings_rate = (savings / income * 100) if income > 0 else 0

    return {
        "month": month or date.today().strftime("%Y-%m"),
        "income": round(income, 2),
        "expenses": round(expenses, 2),
        "net_savings": round(savings, 2),
        "savings_rate_pct": round(savings_rate, 1),
    }
```

Also add `HTTPException` to the fastapi import at the top if not already present:
```python
from fastapi import APIRouter, Depends, HTTPException
```

- [ ] **Step 2: Verify the endpoint works**

```bash
docker compose exec backend python -c "
import asyncio
from httpx import AsyncClient
async def test():
    async with AsyncClient(base_url='http://localhost:8000') as c:
        r = await c.get('/api/cash-flow/summary?month=2025-12')
        print(r.status_code, r.json())
asyncio.run(test())
"
```
Expected: 200 with JSON containing `month: '2025-12'` and numeric `income`, `expenses`, `net_savings`, `savings_rate_pct`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/cash_flow.py
git commit -m "feat: add optional month param to cash-flow summary endpoint"
```

---

## Task 2: Extend transaction category endpoint with sync points recalc

**Files:**
- Modify: `backend/app/api/transactions.py`

- [ ] **Step 1: Add points recalc logic to `update_category` in `backend/app/api/transactions.py`**

After `await db.commit()` (line ~157), add the sync points upsert. First add the necessary imports at the top of the file (if not present):

```python
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.models.account import Account
from app.models.points_ledger import PointsLedger
from app.points.tracker import compute_points_for_transaction
```

Then replace the `update_category` function body so it looks like this:

```python
@router.put("/{transaction_id}/category")
async def update_category(
    transaction_id: uuid.UUID,
    body: CategoryUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Manually override a transaction's category and sync-recompute points."""
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    tx = result.scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    tx.category = body.category
    tx.subcategory = body.subcategory
    tx.category_source = "manual"
    db.add(tx)
    await db.commit()

    # Sync points recalc — fetch card_slug from account
    acct_result = await db.execute(
        select(Account.card_slug).where(Account.id == tx.account_id)
    )
    card_slug = acct_result.scalar_one_or_none()

    if card_slug and not tx.is_excluded and not tx.pending:
        pts = compute_points_for_transaction(
            card_slug=card_slug,
            category=tx.category,
            subcategory=tx.subcategory,
            amount=float(tx.amount),
        )
        if pts:
            stmt = pg_insert(PointsLedger).values(
                transaction_id=tx.id,
                account_id=tx.account_id,
                card_slug=pts.card_slug,
                program=pts.program,
                points_earned=pts.points_earned,
                earn_rate=pts.earn_rate,
                category=tx.category,
                subcategory=tx.subcategory,
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_points_ledger_transaction",
                set_={
                    "card_slug": stmt.excluded.card_slug,
                    "program": stmt.excluded.program,
                    "points_earned": stmt.excluded.points_earned,
                    "earn_rate": stmt.excluded.earn_rate,
                    "category": stmt.excluded.category,
                    "subcategory": stmt.excluded.subcategory,
                },
            )
            await db.execute(stmt)
            await db.commit()

    logger.info(
        "Manual category override tx=%s → %s / %s",
        transaction_id, body.category, body.subcategory,
    )
    return {"id": str(transaction_id), "category": body.category, "subcategory": body.subcategory}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/transactions.py
git commit -m "feat: sync points recalc on manual category override"
```

---

## Task 3: Add bulk-recategorize endpoint and task-status endpoint

**Files:**
- Modify: `backend/app/api/merchants.py`
- Modify: `backend/app/tasks/points.py`

- [ ] **Step 1: Add `recalculate_points_for_merchant` task to `backend/app/tasks/points.py`**

Append to the end of the file:

```python
@app.task(
    name="app.tasks.points.recalculate_points_for_merchant",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def recalculate_points_for_merchant(self, merchant_name: str, category: str | None, subcategory: str | None) -> dict:
    """Recompute points for all transactions matching a merchant name."""
    db = get_sync_db()
    try:
        from app.models.account import Account
        txns = db.execute(
            select(Transaction, Account.card_slug)
            .join(Account, Transaction.account_id == Account.id)
            .where(
                func.coalesce(Transaction.merchant, Transaction.raw_description).ilike(f"%{merchant_name}%"),
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Account.card_slug.isnot(None),
            )
        ).all()

        rows = []
        for tx, card_slug in txns:
            pts = compute_points_for_transaction(
                card_slug=card_slug,
                category=tx.category,
                subcategory=tx.subcategory,
                amount=float(tx.amount),
            )
            if pts:
                rows.append({
                    "transaction_id": tx.id,
                    "account_id": tx.account_id,
                    "card_slug": pts.card_slug,
                    "program": pts.program,
                    "points_earned": pts.points_earned,
                    "earn_rate": pts.earn_rate,
                    "category": tx.category,
                    "subcategory": tx.subcategory,
                })

        if rows:
            from sqlalchemy.dialects.postgresql import insert as pg_insert
            stmt = pg_insert(PointsLedger).values(rows)
            stmt = stmt.on_conflict_do_update(
                constraint="uq_points_ledger_transaction",
                set_={k: getattr(stmt.excluded, k) for k in
                      ["card_slug", "program", "points_earned", "earn_rate", "category", "subcategory"]},
            )
            db.execute(stmt)
            db.commit()

        logger.info("recalculate_points_for_merchant: merchant=%s updated=%d", merchant_name, len(rows))
        return {"merchant": merchant_name, "updated": len(rows)}

    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()
```

Add missing import at top of `tasks/points.py`:
```python
from sqlalchemy import func, select
```

- [ ] **Step 2: Add `bulk-recategorize` and `task-status` routes to `backend/app/api/merchants.py`**

Add these imports at the top (if not present):
```python
from pydantic import BaseModel
from celery.result import AsyncResult
```

Then append to the end of `merchants.py`:

```python
class BulkRecategorizeRequest(BaseModel):
    category: str | None = None
    subcategory: str | None = None


@router.post("/{merchant_name}/bulk-recategorize")
async def bulk_recategorize(
    merchant_name: str,
    body: BulkRecategorizeRequest,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Update category/subcategory for ALL transactions from a merchant, then recompute points."""
    from app.models.transaction import Transaction

    # Update all matching transactions
    result = await session.execute(
        text("""
            UPDATE transactions
            SET category = :category,
                subcategory = :subcategory,
                category_source = 'manual'
            WHERE COALESCE(merchant, raw_description) ILIKE :merchant
        """),
        {"category": body.category, "subcategory": body.subcategory, "merchant": f"%{merchant_name}%"},
    )
    await session.commit()
    updated = result.rowcount

    # Fire Celery task for points recalc
    from app.tasks.points import recalculate_points_for_merchant
    task = recalculate_points_for_merchant.delay(merchant_name, body.category, body.subcategory)

    logger.info("bulk_recategorize: merchant=%s updated=%d task_id=%s", merchant_name, updated, task.id)
    return {"merchant": merchant_name, "transactions_updated": updated, "task_id": task.id}


@router.get("/tasks/{task_id}/status")
async def get_task_status(task_id: str) -> dict:
    """Poll status of a background Celery task."""
    result = AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": result.state,          # PENDING | STARTED | SUCCESS | FAILURE
        "result": result.result if result.ready() else None,
    }
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/merchants.py backend/app/tasks/points.py
git commit -m "feat: bulk merchant recategorize endpoint + points recalc task"
```

---

## Task 4: Add new API client methods to `frontend/src/lib/api.ts`

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add types and methods for new endpoints**

Find the `export const api = {` block and add to it. Also add the types above the `api` export object:

```typescript
export interface TaskStatus {
  task_id: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE";
  result: unknown | null;
}

export interface BulkRecategorizeResult {
  merchant: string;
  transactions_updated: number;
  task_id: string;
}
```

Inside the `api` object, find the `merchants` section and extend it (or add it if missing):

```typescript
merchants: {
  list: (params?: { days?: number; limit?: number }) =>
    get<MerchantSummary[]>("/api/merchants", params),
  history: (name: string) =>
    get<MerchantHistory>(`/api/merchants/${encodeURIComponent(name)}/history`),
  bulkRecategorize: (name: string, category: string | null, subcategory: string | null) =>
    post<BulkRecategorizeResult>(
      `/api/merchants/${encodeURIComponent(name)}/bulk-recategorize`,
      { category, subcategory }
    ),
},

tasks: {
  status: (taskId: string) => get<TaskStatus>(`/api/merchants/tasks/${taskId}/status`),
},
```

Also extend `cashFlow.summary` to accept an optional month:

```typescript
cashFlow: {
  monthly: (months?: number) => get<MonthlyCashFlow[]>("/api/cash-flow/monthly", { months }),
  summary: (month?: string) => get<CashFlowSummary>("/api/cash-flow/summary", month ? { month } : undefined),
  categoryTrend: (category: string, months?: number) =>
    get<{ month: string; total: number }[]>("/api/cash-flow/category-trend", { category, months }),
},
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add bulkRecategorize, taskStatus, and month-aware cashFlow.summary to API client"
```

---

## Task 5: Cash flow month picker UI

**Files:**
- Modify: `frontend/src/app/cash-flow/page.tsx`

- [ ] **Step 1: Replace the `CashFlowPage` component with the month-aware version**

Replace the entire `CashFlowPage` component. Key changes:
1. Add `selectedKpiMonth` state (YYYY-MM string, defaults to current month)
2. Load summary with `api.cashFlow.summary(selectedKpiMonth)` and re-fetch when `selectedKpiMonth` changes
3. When a bar is clicked, set `selectedKpiMonth` to that bar's `monthKey`
4. Add prev/next arrows beside the KPI title that shift `selectedKpiMonth` by one month

Add this helper at the top of the file (after existing helpers):

```typescript
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
```

Replace the state declarations at the top of `CashFlowPage`:

```typescript
const [monthly, setMonthly]             = useState<MonthlyCashFlow[]>([]);
const [summary, setSummary]             = useState<CashFlowSummary | null>(null);
const [loading, setLoading]             = useState(true);
const [summaryLoading, setSummaryLoading] = useState(false);
const [view, setView]                   = useState<"net" | "split">("split");
const [drillDown, setDrillDown]         = useState<DrillDownState | null>(null);
const [selectedKpiMonth, setSelectedKpiMonth] = useState<string>(currentYearMonth());
```

Replace the `useEffect` with:

```typescript
useEffect(() => {
  api.cashFlow.monthly(12).then(setMonthly).finally(() => setLoading(false));
}, []);

useEffect(() => {
  setSummaryLoading(true);
  api.cashFlow.summary(selectedKpiMonth)
    .then(setSummary)
    .finally(() => setSummaryLoading(false));
}, [selectedKpiMonth]);
```

Update `handleBarClick` to also set `selectedKpiMonth`:

```typescript
const handleBarClick = (data: any) => {
  const mk = data?.activePayload?.[0]?.payload?.monthKey;
  if (mk) {
    selectMonth(mk);
    setSelectedKpiMonth(mk);
  }
};
```

Replace the KPI row section with a month-aware version:

```tsx
{/* KPI row */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <button
        onClick={() => setSelectedKpiMonth(m => shiftMonth(m, -1))}
        className="p-1 rounded-md hover:bg-white/[0.05] text-ink-tertiary hover:text-ink-primary transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <p className="text-[13px] font-medium text-ink-primary w-24 text-center">
        {monthLabel(selectedKpiMonth)}
      </p>
      <button
        onClick={() => setSelectedKpiMonth(m => shiftMonth(m, 1))}
        className="p-1 rounded-md hover:bg-white/[0.05] text-ink-tertiary hover:text-ink-primary transition-colors"
        disabled={selectedKpiMonth >= currentYearMonth()}
        aria-label="Next month"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
    {summaryLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-tertiary" />}
  </div>

  {summary && (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Income",      value: fmt(summary.income),      color: "text-semantic-income" },
        { label: "Expenses",    value: fmt(summary.expenses),     color: "text-semantic-expense" },
        { label: "Net Savings", value: fmt(summary.net_savings),  color: summary.net_savings >= 0 ? "text-semantic-income" : "text-semantic-expense" },
        { label: "Savings Rate", value: `${(summary.savings_rate_pct ?? 0).toFixed(1)}%`, color: (summary.savings_rate_pct ?? 0) >= 20 ? "text-semantic-income" : (summary.savings_rate_pct ?? 0) >= 10 ? "text-honey" : "text-semantic-expense" },
      ].map(({ label, value, color }) => (
        <div key={label} className="hive-card p-4">
          <p className="hive-label mb-2">{label}</p>
          <p className={cn("text-[20px] font-semibold font-mono tabular-nums", color)}>{value}</p>
        </div>
      ))}
    </div>
  )}
</div>
```

Add the new imports at the top of the file:
```typescript
import { X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
```

Also update `selectedMonth` logic so the chart highlights the `selectedKpiMonth`:
```typescript
const selectedMonth = selectedKpiMonth;
```
And remove the `drillDown?.month ?? null` reference that set `selectedMonth`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/cash-flow/page.tsx
git commit -m "feat: cash flow month picker — KPI row responds to month selection"
```

---

## Task 6: Inline category editor and bulk recategorize UI on merchant detail page

**Files:**
- Modify: `frontend/src/app/merchants/page.tsx`

- [ ] **Step 1: Add the category taxonomy constant and inline editor**

Add this constant near the top of the file (after imports):

```typescript
const CATEGORY_TAXONOMY: Record<string, string[]> = {
  "Food & Drink": ["Restaurant", "Fast Food", "Coffee", "Delivery", "Bar", "Groceries"],
  "Groceries": ["In-Store", "Online"],
  "Travel": ["Flights", "SW Flights", "Hotel", "Car Rental", "Rideshare", "Cruise"],
  "Transportation": ["Gas", "EV Charging", "Parking", "Tolls", "Transit", "Auto Service"],
  "Entertainment": ["Streaming", "Movies", "Events", "Gaming", "Sports"],
  "Shopping": ["General", "Clothing", "Electronics", "Amazon", "Home Goods"],
  "Health": ["Medical", "Pharmacy", "Gym", "Dental", "Vision"],
  "Utilities": ["Electric", "Internet", "Phone", "Water", "Insurance"],
  "Home": ["Rent", "Mortgage", "Furniture", "Repairs", "Garden"],
  "Education": ["Tuition", "Books", "Courses"],
  "Personal Care": ["Haircut", "Spa", "Clothing"],
  "Transfers": ["P2P", "Payment", "Refund"],
  "Business": ["Office", "Software", "Advertising"],
};
```

- [ ] **Step 2: Add state for editing and bulk recategorize to the detail view**

In the `MerchantsPage` component, add:

```typescript
const [editingTxId, setEditingTxId]     = useState<string | null>(null);
const [editCategory, setEditCategory]   = useState<string>("");
const [editSubcategory, setEditSubcategory] = useState<string>("");
const [savingTxId, setSavingTxId]       = useState<string | null>(null);
const [bulkTaskId, setBulkTaskId]       = useState<string | null>(null);
const [bulkStatus, setBulkStatus]       = useState<"idle" | "running" | "done" | "error">("idle");

// Poll task status when bulkTaskId is set
useEffect(() => {
  if (!bulkTaskId) return;
  const interval = setInterval(async () => {
    try {
      const s = await api.tasks.status(bulkTaskId);
      if (s.status === "SUCCESS") {
        setBulkStatus("done");
        setBulkTaskId(null);
        clearInterval(interval);
        setTimeout(() => setBulkStatus("idle"), 3000);
      } else if (s.status === "FAILURE") {
        setBulkStatus("error");
        setBulkTaskId(null);
        clearInterval(interval);
      }
    } catch { clearInterval(interval); }
  }, 1500);
  return () => clearInterval(interval);
}, [bulkTaskId]);
```

- [ ] **Step 3: Add save handler for single-transaction category edit**

```typescript
async function handleSaveCategory(txId: string) {
  setSavingTxId(txId);
  try {
    await api.transactions.updateCategory(txId, editCategory || null, editSubcategory || null);
    // Refresh detail
    if (selected) {
      const d = await api.merchants.history(selected);
      setDetail(d);
    }
    setEditingTxId(null);
  } finally {
    setSavingTxId(null);
  }
}
```

Note: `api.transactions.updateCategory` already exists. Check `frontend/src/lib/api.ts` — if it doesn't, it should call `PUT /api/transactions/{id}/category` with `{ category, subcategory }`.

- [ ] **Step 4: Add bulk recategorize handler**

```typescript
async function handleBulkRecategorize() {
  if (!selected || !editCategory) return;
  setBulkStatus("running");
  try {
    const result = await api.merchants.bulkRecategorize(selected, editCategory, editSubcategory || null);
    setBulkTaskId(result.task_id);
    // Refresh detail immediately (categories updated in DB)
    const d = await api.merchants.history(selected);
    setDetail(d);
  } catch {
    setBulkStatus("error");
  }
}
```

- [ ] **Step 5: Update the transaction list render in the detail view**

Replace the transaction row `<div>` in the detail view with a version that includes an inline editor:

```tsx
{detail.transactions.map((t) => (
  <div key={t.id} className="flex items-center justify-between px-5 py-3 gap-4">
    <div className="min-w-0 flex-1">
      <p className="text-[12px] text-ink-secondary">{t.date}</p>

      {editingTxId === t.id ? (
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <select
            value={editCategory}
            onChange={e => { setEditCategory(e.target.value); setEditSubcategory(""); }}
            className="text-[11px] bg-elevated border border-white/[0.08] rounded px-2 py-0.5 text-ink-primary"
          >
            <option value="">— category —</option>
            {Object.keys(CATEGORY_TAXONOMY).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {editCategory && (
            <select
              value={editSubcategory}
              onChange={e => setEditSubcategory(e.target.value)}
              className="text-[11px] bg-elevated border border-white/[0.08] rounded px-2 py-0.5 text-ink-primary"
            >
              <option value="">— subcategory —</option>
              {(CATEGORY_TAXONOMY[editCategory] ?? []).map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => handleSaveCategory(t.id)}
            disabled={savingTxId === t.id}
            className="text-[10px] px-2 py-0.5 rounded bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40"
          >
            {savingTxId === t.id ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setEditingTxId(null)}
            className="text-[10px] px-2 py-0.5 rounded hover:bg-white/[0.05] text-ink-tertiary transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setEditingTxId(t.id);
            setEditCategory(t.category ?? "");
            setEditSubcategory(t.subcategory ?? "");
          }}
          className="text-[11px] text-ink-tertiary hover:text-ink-secondary transition-colors text-left"
        >
          {t.category ?? "—"}{t.subcategory ? ` · ${t.subcategory}` : ""}
          <span className="ml-1 opacity-0 group-hover:opacity-100 text-honey">✎</span>
        </button>
      )}
    </div>
    <p className="text-[13px] font-mono font-semibold text-ink-primary tabular-nums shrink-0">{fmt(t.amount)}</p>
  </div>
))}
```

- [ ] **Step 6: Add bulk recategorize section above the transaction list in the detail view**

Add this just before the `<div className="hive-card overflow-hidden">` that contains the transaction list:

```tsx
{/* Bulk recategorize */}
{detail.transactions.length > 1 && (
  <div className="hive-card p-4">
    <p className="text-[12px] font-medium text-ink-primary mb-3">
      Apply category to all {detail.transaction_count} transactions from this merchant
    </p>
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={editCategory}
        onChange={e => { setEditCategory(e.target.value); setEditSubcategory(""); }}
        className="text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-1.5 text-ink-primary"
      >
        <option value="">— category —</option>
        {Object.keys(CATEGORY_TAXONOMY).map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
      {editCategory && (
        <select
          value={editSubcategory}
          onChange={e => setEditSubcategory(e.target.value)}
          className="text-[12px] bg-elevated border border-white/[0.08] rounded-lg px-3 py-1.5 text-ink-primary"
        >
          <option value="">— subcategory —</option>
          {(CATEGORY_TAXONOMY[editCategory] ?? []).map(sub => (
            <option key={sub} value={sub}>{sub}</option>
          ))}
        </select>
      )}
      <button
        onClick={handleBulkRecategorize}
        disabled={!editCategory || bulkStatus === "running"}
        className="text-[12px] px-3 py-1.5 rounded-lg bg-honey/20 text-honey hover:bg-honey/30 transition-colors disabled:opacity-40 font-medium"
      >
        {bulkStatus === "running" ? "Applying…" : `Apply to All`}
      </button>
      {bulkStatus === "running" && (
        <span className="text-[11px] text-ink-tertiary flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Recalculating points…
        </span>
      )}
      {bulkStatus === "done" && (
        <span className="text-[11px] text-semantic-income">✓ Points recalculated</span>
      )}
      {bulkStatus === "error" && (
        <span className="text-[11px] text-semantic-expense">Error — try again</span>
      )}
    </div>
  </div>
)}
```

Add `Loader2` to the lucide-react import.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/merchants/page.tsx
git commit -m "feat: inline transaction categorization and bulk recategorize on merchant detail page"
```

---

## Final Verification

- [ ] Rebuild and restart

```bash
docker compose build backend frontend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d
docker compose logs backend --tail=30
```

Expected: No import errors, backend starts cleanly.

- [ ] Smoke test cash flow month picker — navigate to `/cash-flow`, click prev arrow, confirm KPI row updates to previous month.

- [ ] Smoke test merchant categorization — navigate to `/merchants`, click a merchant, click a category label on a transaction, change it, save. Confirm the row updates.

- [ ] Smoke test bulk recategorize — on merchant detail, pick a category and click "Apply to All". Confirm "Recalculating points…" badge appears and then resolves.
