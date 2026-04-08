# Graph Visualizations Design
**Date:** 2026-04-08
**Status:** Approved

## Overview

Two new graph components replacing existing visualizations:

1. **Income Flow** (`/cash-flow`) — Replace `SankeyFlow.tsx` with an n8n-style node graph where node size is proportional to spend amount.
2. **Dashboard Account Graph** (`/`) — Replace the account card list with an Obsidian-style layered graph showing the full financial picture, with a three-state drill-down into categories and transactions.

No new npm dependencies. Both are SVG-based, consistent with existing chart patterns in the codebase.

---

## 1. Income Flow — n8n Node Graph

### Replaces
`frontend/src/app/cash-flow/_components/SankeyFlow.tsx`

### Layout
Left-to-right. One source node (Income) on the left. Category destination nodes on the right. Bezier S-curve wires connecting them.

### Source Node (Income)
- Fixed size: ~100×64px rounded rectangle
- Dark fill (`#111118`), left accent bar in income green (`#32D583`)
- Shows: label "Income", total amount, month
- Output port: filled circle on right edge

### Destination Nodes (Categories)
- Size proportional to spend amount — the tallest category gets a max height of ~72px, others scale linearly down from there. Minimum height: 32px (so small categories remain readable).
- Same card style: dark fill, colored left accent bar + border, input port on left edge
- Shows: category name, dollar amount, percentage of income
- Inline progress bar inside the node showing % of income
- Savings node uses income green; each spend category uses a distinct color from `CAT_COLORS`

### Wires
- Bezier S-curves (cubic, control points at 40%/60% of width)
- Wire color matches the destination node's category color
- Wire stroke-width also scales proportionally to amount (range: 1px–16px)
- Translucent fill band behind the wire (same color, low opacity ~0.12) for a "flow" feel

### Data
Uses the existing `FlowData` type from `api.ts`. No backend changes needed.
`flowData.categories[]` → destination nodes. `flowData.savings` → Savings node if > 0.

---

## 2. Dashboard Account Graph

### Replaces
The account cards section in `frontend/src/app/page.tsx` (the `accounts` array currently rendered as `AccountCard` grid).

### New Component
`frontend/src/components/AccountGraph.tsx`

### Layout — Layered (Option C)
Three logical columns rendered as SVG:

```
[Income]  |  [Assets]   |  [Liabilities]
          |  Checking   |  Amex Gold
          |  Savings    |  Chase Sapphire
          |  Brokerage  |  Bilt
          |             |  WF Autograph
          |             |  Venture X
```

- Income node: far left, income green, shows payroll/deposit amount for the month
- Asset nodes (depository + investment accounts): center-left column
- Liability nodes (credit accounts): center-right column
- Net worth summary: floating text label at top — "Net Worth · $XX,XXX" with assets in green, liabilities in red
- Divider line between asset and liability columns (subtle, dashed)

### Node Sizing
- Node radius = `clamp(12, sqrt(balance / maxBalance) * 36, 36)` px
- This gives a natural spread where the largest account (e.g. brokerage at $48k) is the biggest node
- Credit card nodes scale by outstanding balance (absolute value)
- Income node is fixed at a medium size

### Node Style
- Circle nodes (not rectangles — cleaner for the Obsidian graph aesthetic)
- Fill: dark tinted by account type color
- Stroke: account type color, 1.5px
- Radial glow behind node (same color, low opacity radial gradient)
- Label: account type abbreviation inside, balance below

### Color Coding by Account Type
- Depository (checking/savings): `#38BDF8` sky blue
- Investment/brokerage: `#34D399` emerald
- Credit cards: each card gets its own color from `CAT_COLORS` (matches points page colors)
- Income source: `#32D583` green

### Edges
- Thin lines (1–1.5px) between related nodes
- Income → Checking: green, 0.4 opacity
- Checking → Savings: blue, 0.3 opacity (transfer flow)
- Checking → each credit card: red-tinted, 0.2 opacity (payment flow)
- Savings → Brokerage: emerald, 0.2 opacity

### State Machine (three states)

**State 1 — Full graph** (default)
All account nodes visible in layered layout. Net worth label at top.

**State 2 — Account detail** (click any account node)
- The clicked node stays centered and enlarges slightly
- Other account nodes fade to 0.2 opacity
- Category nodes radiate out from the selected account (positioned in a semi-circle to the right)
- Category node size = spend amount for that account/month (same sizing formula as income flow)
- Category node color = `CAT_COLORS[i]`
- "← All accounts" back button appears
- Month selector (prev/next chevrons) visible

**State 3 — Transaction panel** (click any category node)
- The graph stays visible but shrinks to ~40% height
- A transaction list panel slides up below the graph
- Panel header: account name · category name · total · transaction count
- Filter chips pre-applied: account, category, current month
- Additional filters: date range picker, amount range, search input
- Transaction rows: merchant logo placeholder, merchant name, subcategory, date, amount
- "← Back to categories" link in panel header

### Back Navigation
- State 3 → State 2: click "← back to categories" in panel header
- State 2 → State 1: click "← All accounts" button
- Also: clicking the background (non-node area) exits drill-down

### Data Sources
- Account nodes: `GET /api/accounts` (existing)
- Net worth label: `GET /api/net-worth/history?days=7` → latest snapshot
- State 2 categories: `GET /api/reports/spending-by-category?start=...&end=...` filtered by account (needs account_id filter — see Backend section)
- State 3 transactions: `GET /api/transactions?account_id=...&category=...&month=...` (existing — `account_id`, `category`, `month`, and `search` filters already implemented at line 72 of `transactions.py`)
- Income node: `GET /api/cash-flow/summary` → `summary.income`

---

## 3. Backend — One Small Addition

The spending-by-category report needs an optional `account_id` filter so State 2 can show spend for one account.

**File:** `backend/app/api/reports.py`
**Change:** Add optional `account_id: Optional[str] = Query(None)` parameter to `GET /api/reports/spending-by-category`. If provided, add `Transaction.account_id == account_id` to the WHERE clause.

**File:** `frontend/src/lib/api.ts`
**Change:** Add `account_id?: string` to the `spendingByCategory` call params.

---

## 4. Component Breakdown

### New files
- `frontend/src/components/AccountGraph.tsx` — layered account graph with drill-down state machine
- `frontend/src/app/cash-flow/_components/NodeFlow.tsx` — n8n node graph (replaces SankeyFlow)

### Modified files
- `frontend/src/app/cash-flow/page.tsx` — swap `<SankeyFlow>` for `<NodeFlow>`
- `frontend/src/app/page.tsx` — swap account cards section for `<AccountGraph>`
- `frontend/src/lib/api.ts` — add `account_id` param to `spendingByCategory`
- `backend/app/api/reports.py` — add `account_id` filter

### Unchanged
- All other dashboard sections (budget gauges, anomaly alerts, points summary)
- The `SankeyFlow.tsx` file is deleted after `NodeFlow.tsx` is verified

---

## 5. Error & Loading States

- **Graph loading:** Show skeleton circles in approximate layout positions
- **No data:** If no accounts linked, show empty state with "Connect an account to see your financial graph"
- **Category nodes empty:** If account has no spend this month, show message in State 2
- **Transaction panel empty:** Standard "No transactions" empty state

---

## 6. Animation

- State transitions use CSS opacity transitions (150ms) — no physics/spring library needed
- Node hover: scale(1.05) via CSS transform on the `<g>` element
- Wire draw-on: not animated (SVG path animation would require JS; skip for now)

---

## What's Out of Scope

- Drag-to-reposition nodes (static layout only)
- Real-time graph updates while visible
- The `/net-worth` page (unchanged)
- Mobile layout optimization (the graph will scroll horizontally on small screens)
