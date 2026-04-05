# Design: Financial Planning Hub, Tax Calculator, Merchant Categorization & Cash Flow Enhancements

**Date:** 2026-04-05
**Status:** Approved

---

## Overview

Three parallel sub-projects that extend the Hive finance platform:

- **Sub-A** — Merchant inline categorization + cash flow KPI month picker (quick wins)
- **Sub-B** — Financial Planning Hub (`/plan`): net worth projection, major expense scenarios, goals, budget trimming
- **Sub-C** — Tax Calculator (`/tax`): document upload → Claude Vision extraction → deterministic Python tax engine → federal + all-50-states results

---

## Sub-Project A: Merchant Categorization + Cash Flow Month Picker

### Merchant Detail Page — Inline Categorization

Each transaction row in the merchant detail view gains an inline category/subcategory editor. Clicking the category label opens a dropdown using the same taxonomy already defined in CLAUDE.md. Changes are submitted to the existing `PUT /api/transactions/{id}/category` endpoint, which will be extended to also synchronously recompute and persist the points ledger entry for that transaction.

A **"Apply to all [Merchant] transactions"** button appears at the top of the transaction list when the merchant has > 1 transaction. This sends a new `POST /api/merchants/{merchant_name}/bulk-recategorize` request with `{category, subcategory}`. The backend updates **all transactions for that merchant across all time** (not just the current window) and fires a Celery task (`recalculate_points_for_merchant`). The endpoint returns a `task_id`.

**Points integration:**
- Single-transaction edit: synchronous — points ledger entry recomputed and saved before response returns
- Bulk "apply to all": Celery task. Frontend polls `GET /api/tasks/{task_id}/status` (generic task status endpoint) and shows a "Recalculating points…" badge until complete.

### Cash Flow Page — Month Picker

The current KPI summary row hardcodes to the current month. Change it to respond to a selected month:

- Add prev/next arrow buttons alongside the KPI row title ("April 2026 ◀ ▶")
- When the user clicks a bar in the chart, the KPI row switches to that month
- When the user uses the arrows, the KPI row switches to that month and the chart highlights the selected bar
- The `GET /api/cash-flow/summary` endpoint gains an optional `month=YYYY-MM` query param; if omitted it defaults to current month

---

## Sub-Project B: Financial Planning Hub (`/plan`)

### Page Layout

Three vertically stacked panels with a tab switcher at the top: **Projection** | **Goals** | **Trim the Fat**

### Panel 1: Net Worth Projection

A line chart showing:
- **Historical line** — actual net worth snapshots from `net_worth_snapshots` table (last 12 months)
- **Projected line** — computed forward 12–36 months using average monthly net savings (rolling 3-month average income − expenses)
- **Major Expense markers** — vertical drops on the projected line at the date of each planned expense

User can add Major Expense events via a form: name, amount, date. Stored in a new `plan_events` table. Events toggle on/off with a checkbox list below the chart so users can compare scenarios.

**Backend:**
- `GET /api/plan/projection?months=24` — returns historical snapshots + projected net worth with event impact
- `POST/PUT/DELETE /api/plan/events` — CRUD for major expense events

### Panel 2: Goals

User states a goal:
- Type: savings target, debt payoff, or net worth milestone
- Target amount
- Target date
- (Optional) linked account (e.g., savings account balance tracks toward this goal)

For each goal, the UI shows:
- Progress bar (current value / target)
- Projected completion date based on current trajectory
- Required monthly savings delta to hit the goal on time
- A Claude-generated plain-English status: "At your current savings rate of $1,240/month you'll reach this goal in March 2028 — 4 months late. You need an extra $340/month."

Goals use the existing `goals` model (already in schema). The `GET /api/goals` endpoint is already present; add a `GET /api/goals/{id}/projection` endpoint that returns trajectory data.

### Panel 3: Trim the Fat

A Claude call (`claude-sonnet-4-6` with prompt caching) that receives:
- Last 3 months of category-level spend averages
- All stated goals and their gaps
- Current monthly surplus/deficit

Returns a ranked list of **actionable budget cuts**, each with:
- Category + subcategory
- Current monthly spend
- Suggested target spend
- Monthly savings unlocked
- Impact on goal timeline (e.g., "saves $280/month → hits house goal 3 months earlier")

Presented as cards with a "Set as budget" button that creates/updates a budget entry for that category.

**Backend:** `POST /api/plan/trim-recommendations` — takes optional goal IDs, calls Claude, returns structured JSON list.

---

## Sub-Project C: Tax Calculator (`/tax`)

### Flow

Upload → Extract → Review → Calculate → Results

### Step 1: Document Upload

Drag-and-drop upload zone. Accepted types: W-2, 1099-NEC, 1099-DIV, 1099-INT, 1099-B, 1099-G. Files stored in a local Docker volume (`/data/tax-docs/`). Each upload creates a `tax_document` DB record:

```
tax_documents
  id            UUID PK
  tax_year      INT
  doc_type      VARCHAR  -- W2, 1099NEC, 1099DIV, 1099INT, 1099B, 1099G
  filename      VARCHAR
  file_path     VARCHAR
  extracted_json JSONB   -- populated after Claude extraction
  extraction_status VARCHAR -- pending, done, failed
  created_at    TIMESTAMP
```

### Step 2: Claude Vision Extraction

Each uploaded document is processed by `claude-sonnet-4-6` with vision. Document-type-specific prompts extract typed fields:

| Doc Type | Key Fields Extracted |
|---|---|
| W-2 | Box 1 (wages), Box 2 (fed withheld), Box 12 codes, Box 16 (state wages), Box 17 (state withheld), state abbreviation |
| 1099-NEC | Box 1 (nonemployee comp), Box 4 (fed withheld), payer name |
| 1099-DIV | Box 1a (ordinary divs), Box 1b (qualified divs), Box 2a (total cap gain), Box 4 (fed withheld) |
| 1099-INT | Box 1 (interest income), Box 4 (fed withheld), Box 8 (tax-exempt interest) |
| 1099-B | Per-row: description, proceeds, cost basis, holding period (S/L), wash sale adj, Box 4 (fed withheld) |
| 1099-G | Box 1 (unemployment comp), Box 4 (fed withheld), Box 11 (state/local refunds) |

Extracted JSON stored in `tax_documents.extracted_json`. Status set to `done` or `failed`.

**Endpoint:** `POST /api/tax/documents/upload` (multipart), `POST /api/tax/documents/{id}/extract` (triggers Claude)

### Step 3: Review & Edit

Frontend renders each document's extracted fields as an editable form. User can correct any misread values before calculation. Manual edits saved back to `extracted_json`.

User also inputs:
- Filing status: Single / MFJ / MFS / HOH / QSS
- Number of dependents (for child tax credit)
- State of residence
- Whether to pull deductible business expenses from transaction data (checkbox)

### Step 4: Federal Tax Engine (Deterministic Python)

Tax year: 2024 (default; dropdown for 2023 also supported).

```
GROSS INCOME
  W-2 wages (sum all W-2 Box 1)
  + Self-employment income (sum all 1099-NEC Box 1)
  + Ordinary dividends (1099-DIV Box 1a)
  + Taxable interest (1099-INT Box 1)
  + Short-term capital gains (1099-B short-term net)
  + Unemployment compensation (1099-G Box 1)

ABOVE-THE-LINE DEDUCTIONS
  - ½ self-employment tax (computed: SE income × 0.9235 × 0.153 / 2)
  - SE health insurance (if applicable — manual entry)
  - Student loan interest (manual entry)
  = AGI

STANDARD vs. ITEMIZED (auto-selects higher)
  Standard 2024:
    Single: $14,600
    MFJ:    $29,200
    HOH:    $21,900
    MFS:    $14,600
  Itemized (manual entries + transaction pull):
    - Mortgage interest (manual)
    - State/local taxes paid — SALT cap $10,000
    - Charitable contributions (from transaction data: category=Transfers subcategory=Charitable, or manual)
    = Itemized total

  = TAXABLE INCOME (ordinary)

QUALIFIED DIVIDENDS & LONG-TERM CAP GAINS (separate rate schedule)
  LTCG + qualified divs taxed at 0% / 15% / 20% based on taxable income thresholds (2024)

FEDERAL TAX
  Apply 2024 brackets to ordinary taxable income
  + LTCG/qualified div tax (separate calculation)
  + Self-employment tax (net SE income × 0.9235 × 0.153)
  + Net investment income tax (3.8% on investment income if AGI > $200k/$250k MFJ)
  - Child tax credit ($2,000/child, phaseout at $200k/$400k MFJ)
  - Child/dependent care credit (manual entry)
  - Education credits (manual entry)
  = TOTAL FEDERAL TAX

FEDERAL WITHHOLDING
  Sum W-2 Box 2 + all 1099 Box 4 values
  = FEDERAL OWED (positive) or REFUND (negative)

ESTIMATED QUARTERLY PAYMENTS (if SE income > $1,000)
  (Federal tax owed + SE tax) / 4, due Apr 15 / Jun 15 / Sep 15 / Jan 15
```

### Step 5: State Tax Engine

All 50 states supported. Approach:
- **No-income-tax states** (TX, FL, WA, NV, SD, WY, AK, TN, NH): state tax = $0
- **Flat-rate states** (CO 4.4%, IL 4.95%, MA 5.0%, MI 4.25%, NC 4.75%, PA 3.07%, UT 4.85%): flat rate × state AGI
- **Progressive states** (CA, NY, NJ, etc.): state-specific brackets stored as a Python dict keyed by state code + filing status + year
- State AGI: generally federal AGI with state-specific adjustments (stored as a small config dict per state — e.g., NY adds back federal bonus depreciation, CA disallows federal student loan deduction)

State withholding pulled from W-2 Box 17 for the matching state.

Result: state owed or refund.

**Endpoint:** `POST /api/tax/calculate` — takes `{tax_year, filing_status, dependents, state, pull_transactions: bool}`, returns full calculation breakdown.

### Step 6: Results Page

Summary panel:
- Federal: owed / refund, effective rate, marginal rate
- State: owed / refund
- Combined total

Detail accordion:
- Income breakdown
- Deductions used (standard vs. itemized comparison shown)
- Credits applied
- LTCG/qualified dividend tax breakdown
- Estimated quarterly payments schedule (if applicable)

Claude "Key Insights" card: 3–5 sentences explaining the biggest drivers of the tax bill and the top 1–2 levers (e.g., "Contributing $X more to your 401k before Dec 31 would save $Y in federal tax").

**Transaction integration:** If `pull_transactions=true`, the backend queries transactions with deductible categories (Business, Home > Home Office) and adds them to the itemized deduction calculation, showing them as a line item.

---

## New Database Objects

### `plan_events` table (Sub-B)
```sql
CREATE TABLE plan_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  event_date  DATE NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### `tax_documents` table (Sub-C)
```sql
CREATE TABLE tax_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year          INT NOT NULL,
  doc_type          VARCHAR NOT NULL,
  filename          VARCHAR NOT NULL,
  file_path         VARCHAR NOT NULL,
  extracted_json    JSONB,
  extraction_status VARCHAR DEFAULT 'pending',
  created_at        TIMESTAMP DEFAULT NOW()
);
```

### `tax_calculations` table (Sub-C)
```sql
CREATE TABLE tax_calculations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year        INT NOT NULL,
  filing_status   VARCHAR NOT NULL,
  state           VARCHAR(2) NOT NULL,
  inputs_json     JSONB NOT NULL,   -- full extracted + manual inputs
  results_json    JSONB NOT NULL,   -- full calculation breakdown
  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## New API Endpoints

### Sub-A
```
PUT  /api/transactions/{id}/category                   (already exists)
POST /api/merchants/{merchant_name}/bulk-recategorize  NEW  → returns {task_id}
GET  /api/tasks/{task_id}/status                       NEW  (generic Celery task status)
GET  /api/cash-flow/summary?month=YYYY-MM              (extend existing)
```

### Sub-B
```
GET  /api/plan/projection?months=24
GET  /api/plan/events
POST /api/plan/events
PUT  /api/plan/events/{id}
DELETE /api/plan/events/{id}
GET  /api/goals                    (already exists)
POST /api/goals                    (already exists)
PUT  /api/goals/{id}               (already exists)
GET  /api/goals/{id}/projection    NEW
POST /api/plan/trim-recommendations
```

### Sub-C
```
POST /api/tax/documents/upload
GET  /api/tax/documents
POST /api/tax/documents/{id}/extract
PUT  /api/tax/documents/{id}
DELETE /api/tax/documents/{id}
POST /api/tax/calculate
GET  /api/tax/calculations
GET  /api/tax/calculations/{id}
```

---

## New Frontend Pages & Components

| Route | Agent | Key Components |
|---|---|---|
| `/merchants` (updated) | A | Inline category editor, bulk recategorize button, points recalc status badge |
| `/cash-flow` (updated) | A | Month picker arrows on KPI row, unified bar selection |
| `/plan` | B | `ProjectionChart`, `EventPlanner`, `GoalCard`, `TrimCard` |
| `/tax` | C | `DocUploadZone`, `DocReviewForm`, `TaxResultsSummary`, `EstimatedPaymentsTable` |

---

## Build Order & Parallelism

All three sub-projects are independent and can be built in parallel by separate agents.

| Agent | Sub-Project | Dependencies |
|---|---|---|
| Agent 1 | Sub-A (merchant + cash flow) | None — modifies existing pages/endpoints |
| Agent 2 | Sub-B (planning hub) | None — new page + new endpoints |
| Agent 3 | Sub-C (tax calculator) | None — new page + new endpoints + new DB tables |

Each agent runs an Alembic migration for its own schema changes before implementing the API. Frontend agents use existing shadcn/ui components and the Hive design system (slate/honey palette, `hive-card`, `hive-label` classes).

---

## Constraints & Rules (from CLAUDE.md)
- All secrets via `config.py` / env vars — no hardcoded values
- All DB access through SQLAlchemy ORM
- No raw SQL in business logic (analytics queries only)
- TypeScript strict mode, no `any`
- Tax document files stored in Docker volume, never committed
- Points recalculation must never double-count — always recompute from earn rules, never add to existing ledger
