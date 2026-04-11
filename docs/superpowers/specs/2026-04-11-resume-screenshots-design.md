# Resume Screenshots — Design Spec
**Date:** 2026-04-11

## Goal
Generate 12 portfolio-quality screenshots of the Hive finance platform for use on a personal resume/portfolio. All screenshots use realistic fake data (persona: "Alex Rivera") — no real personal finance information.

## Approach
Playwright with network-level route interception. Zero changes to the app. A self-contained Node.js script intercepts all `/api/*` calls and returns fixture data; the live frontend at `localhost:3000` renders normally and is screenshotted.

## Files

### `scripts/demo-fixtures.js`
All mock API responses. Exports a single `FIXTURES` object keyed by URL pattern. Covers every API endpoint the app's 12 pages call:

- `/api/auth/me` — fake user to bypass auth redirect
- `/api/dashboard/summary` — KPI data, top categories, budgets, anomalies, insights
- `/api/accounts` — 4 credit cards + 1 checking + 1 savings
- `/api/transactions` — 30 realistic transactions across categories
- `/api/budgets` — 6 budget categories with spend vs limit
- `/api/cash-flow/monthly` — 6 months of income/expense bars
- `/api/cash-flow/summary` — current month summary + savings rate
- `/api/points/summary` — balances per program
- `/api/points/ledger` — recent earn activity
- `/api/points/leakage` — missed points opportunities
- `/api/points/optimize` — card recommendations for a sample purchase
- `/api/net-worth/history` — 12 months of net worth snapshots
- `/api/anomalies` — 3 flagged transactions
- `/api/subscriptions` — 5 detected recurring charges
- `/api/goals` — 3 goals (emergency fund, vacation, pay off card)
- `/api/reports/spending-by-category` — category breakdown
- `/api/reports/monthly-summary` — 12 months of monthly summaries
- `/api/merchants` — top 8 merchants by spend
- `/api/insights` — 3 AI insight cards
- `/api/cash-flow/category-trend` — monthly trend for a category

### `scripts/take-screenshots.js`
Playwright script (Node.js, `playwright` package). Steps:
1. Launch Chromium at 1440×900 viewport
2. Install `page.route()` interceptors for all `/api/*` patterns using `FIXTURES`
3. For each of 12 pages: `page.goto()` → `waitForLoadState('networkidle')` → `page.waitForTimeout(500)` → `page.screenshot()`
4. Save PNGs to `screenshots/` at project root

## Demo Persona — "Alex Rivera"
Fictional young professional. Numbers are plausible but entirely fake.

| Metric | Value |
|---|---|
| Monthly income | $8,500 |
| Monthly spend | $3,240 |
| Savings rate | 38% |
| Net worth | $182,400 |
| Cards linked | Amex Gold, Chase Sapphire, Capital One Venture X, Bilt Blue |
| Bank accounts | Checking ($4,200), Savings ($18,500) |
| Total points | ~127,000 pts (~$2,400 estimated value) |

## Screenshots — 12 pages

| File | Route | Key content shown |
|---|---|---|
| `dashboard.png` | `/` | KPI tiles, budget bars, spending by category, AI insights, recent txns |
| `transactions.png` | `/transactions` | Searchable table, categories, card used, amounts |
| `cash-flow.png` | `/cash-flow` | Income/expense bars, savings rate, category trends |
| `points.png` | `/points` | Points per program, dollar value, earn activity, leakage |
| `optimize.png` | `/optimize` | Card recommender with ranked results |
| `net-worth.png` | `/net-worth` | Balance sheet chart over 12 months |
| `anomalies.png` | `/anomalies` | ML-flagged transactions for review |
| `subscriptions.png` | `/subscriptions` | Detected recurring charges, price change alerts |
| `goals.png` | `/goals` | Goal progress bars, ML projections |
| `reports.png` | `/reports` | Category breakdown, monthly summary |
| `merchants.png` | `/merchants` | Top merchants by spend |
| `chat.png` | `/chat` | AI chat interface with a sample Q&A exchange |

## Running the Script
```bash
# Install playwright if not already
cd /home/zach/hive
npm install playwright --save-dev

# Run (requires frontend running on localhost:3000)
node scripts/take-screenshots.js
```

Screenshots are saved to `screenshots/*.png`.

## Constraints
- Requires the frontend dev server running on `localhost:3000`
- Backend does NOT need to be running — all API calls are intercepted
- Chat page will show a pre-scripted conversation in fixture data (the real AI endpoint is not called)
