# PROMPTS.md — Copy-Paste Prompts for Each Claude Code Session

## How to Start Every Session
```
Read CLAUDE.md, BUILD_PLAN.md, and SPEC.md in full.
Tell me:
1. What phase we're currently on
2. Which tasks are complete (✅) vs remaining
3. Any blockers or issues from the last session

Then continue with the next incomplete task.
```

---

## Session 1 — Phase 1: Infrastructure Scaffold

```
Read CLAUDE.md, BUILD_PLAN.md, and SPEC.md in full before writing any code.

We're starting from scratch. Build Phase 1: the Docker Compose infrastructure scaffold.

Requirements:
- docker-compose.yml with 7 services: postgres, redis, backend, celery_worker, celery_beat, frontend, nginx
- docker-compose.dev.yml with volume mounts for hot reload and all ports exposed for debugging
- backend/Dockerfile: Python 3.11-slim, non-root user, pip install from requirements.txt
- frontend/Dockerfile: Node 20-alpine, multi-stage (deps → builder → runner)
- nginx/nginx.conf: proxy /api/* → backend:8000, /* → frontend:3000, WebSocket support
- backend/requirements.txt: all dependencies from SPEC.md
- backend/app/main.py: minimal FastAPI app with GET /health endpoint returning {"status": "ok", "service": "finance-api"}
- backend/app/config.py: pydantic-settings class loading all vars from .env.example
- backend/app/db.py: async SQLAlchemy engine + AsyncSession dependency + sync session for Celery
- backend/app/celery_app.py: Celery instance with Redis broker, beat schedule from CLAUDE.md

After creating all files, run:
  docker compose up --build

Fix any errors until all containers show as healthy. Then verify:
  curl http://localhost/api/health  # should return 200
  curl http://localhost            # should return Next.js page (even if blank)

Mark Phase 1 tasks complete in BUILD_PLAN.md as you finish them.
```

---

## Session 2 — Phase 2: Database Schema

```
Read CLAUDE.md, BUILD_PLAN.md, and SPEC.md. Phase 1 is complete.

Build Phase 2: all database models and Alembic migrations.

Use the exact schema from SPEC.md — do not invent column names.
Use SQLAlchemy 2.0 declarative style with type annotations.

Steps:
1. Initialize Alembic: alembic init alembic
2. Configure alembic/env.py for async SQLAlchemy using our db.py engine
3. Create all model files in app/models/ (one model per file, import all in __init__.py)
4. Generate initial migration: alembic revision --autogenerate -m "initial_schema"
5. Review the generated migration — fix any issues
6. Create a SEPARATE manual migration for the materialized view (autogenerate won't catch this)
   File: alembic/versions/002_materialized_view.py
   The view SQL is in SPEC.md
7. Run: docker compose exec backend alembic upgrade head
8. Seed the earn_rules table with ALL rules from CLAUDE.md
   Create: backend/app/seeds/earn_rules.py with a seed() function
   Run it after migration

Verify:
  docker compose exec postgres psql -U finance_user -d finance -c "\dt"
  # Should show all 9 tables + 1 materialized view

Mark Phase 2 tasks complete in BUILD_PLAN.md.
```

---

## Session 3 — Phase 3: Plaid Integration

```
Read CLAUDE.md, BUILD_PLAN.md, and SPEC.md. Phases 1-2 are complete.

Build Phase 3: Plaid integration and daily sync.

IMPORTANT CONSTRAINTS:
- ONLY use /transactions/sync endpoint (cursor-based). NEVER /transactions/get
- Always persist the cursor after each sync to plaid_links.sync_cursor
- Venmo/Zelle MUST be detected by transfer_detector and flagged is_excluded=TRUE

Files to create:
1. app/plaid/connector.py — PlaidConnector class with methods from SPEC.md
2. app/ml/transfer_detector.py — is_transfer(description, amount) → bool
   Patterns: /venmo|zelle|cash app|paypal transfer/i → True
3. app/api/plaid_link.py — two endpoints from SPEC.md (link-token, exchange-token)
4. app/tasks/ingestion.py — sync_all_accounts() Celery task with upsert logic
5. Add simple /connect page to frontend with react-plaid-link npm package
   The connect page just needs: a button that calls /api/plaid/link-token,
   opens Plaid Link, then POSTs the result to /api/plaid/exchange-token

After building, test the full flow:
- Navigate to http://localhost/connect
- Complete Plaid Link for one account using Development credentials
- Verify accounts appear in the accounts table
- Run sync manually: docker compose exec celery_worker celery -A app.celery_app call tasks.ingestion.sync_all_accounts
- Verify transactions appear in the transactions table
- Check that Venmo/Zelle (if any) have is_excluded=TRUE

Mark Phase 3 tasks complete in BUILD_PLAN.md.
```

---

## Session 4 — Phase 4: Categorization Pipeline

```
Read CLAUDE.md, BUILD_PLAN.md, and SPEC.md. Phases 1-3 are complete.

Build Phase 4: the three-stage transaction categorization pipeline.

CRITICAL: Southwest Airlines must ALWAYS categorize as "SW Flights", never generic "Flights".
Venmo/Zelle must ALWAYS produce is_excluded=TRUE.

Create app/ml/categorizer.py with:
- ALL regex rules from CLAUDE.md in exact order (high-specificity first)
- Ollama stage using the exact prompt from SPEC.md
- Claude Haiku 4.5 stage (use anthropic Python SDK, model="claude-haiku-4-5-20251001")
- Timeout handling: Ollama must timeout after 8 seconds (asyncio.wait_for)
- categorize_transaction() orchestrator

Integrate into ingestion task:
- Every new transaction must be categorized before insert
- category_source must be set correctly ('sql_rule', 'ollama', 'claude', 'pending')

Create GET /api/transactions endpoint:
- Filters: month (YYYY-MM), category, account_id, search (ilike on merchant/raw_description)
- Pagination: page, page_size (default 50)
- Exclude: is_excluded=TRUE transactions (but include them if ?include_excluded=true)
- Sort: date DESC

Create PUT /api/transactions/{id}/category endpoint:
- Body: {"category": "...", "subcategory": "..."}
- Sets category_source="manual"

After building, re-categorize all existing transactions:
  docker compose exec backend python -c "
  from app.tasks.ingestion import recategorize_all
  recategorize_all()
  "

Write tests (pytest):
  - test_categorizer_southwest() — ensures SW Airlines → "SW Flights"
  - test_categorizer_venmo() — ensures Venmo → Transfers/P2P + is_excluded hint
  - test_categorizer_costco() — Costco → Groceries/In-Store (not Shopping)
  - test_categorizer_uber_eats() — "Uber Eats" → Food/Delivery, "Uber" → Travel/Rideshare

Mark Phase 4 tasks complete in BUILD_PLAN.md.
```

---

## Session 5 — Phase 5: Points Tracker

```
Read CLAUDE.md, BUILD_PLAN.md, and SPEC.md. Phases 1-4 are complete.

Build Phase 5: points tracking and card optimizer.

Create app/points/tracker.py with:
- CardEarnRule dataclass
- EARN_RULES list with ALL rules from CLAUDE.md (copy exactly)
- POINT_VALUES_CPP dict from CLAUDE.md
- REDEMPTION_THRESHOLDS dict from CLAUDE.md
- get_best_card_for_purchase(category, subcategory, amount) → List[dict]
  Each dict: {card_slug, card_name, multiplier, points_earned, program, effective_cpp, dollar_value}
  Sorted by effective_cpp DESC
- compute_points_for_transaction(transaction) → {points, rate, program} | None
  Returns None for non-credit-card accounts or excluded transactions
- _get_best_earn_rule(card_slug, category, subcategory) → best rule
  Priority: exact subcategory match > category match > base rate (category IS NULL)

Create app/tasks/points.py:
- compute_points_ledger() task: for each credit card transaction in last 90 days,
  compute points and upsert into points_ledger (UNIQUE on transaction_id)

Create app/api/points.py endpoints:
- GET /api/points/summary → [{program, total_points, estimated_dollar_value, card_slug}]
- GET /api/points/optimize?category=&subcategory=&amount= → ranked card list
- GET /api/points/ledger?account_id=&month= → transaction-level points with totals

Write tests:
- test_optimizer_restaurant() — Amex Gold wins (4x = $0.08/dollar), Sapphire 2nd (3x UR = $0.0615)
- test_optimizer_sw_flights() — Chase Southwest wins (3x RR at checkout, not general Travel)
- test_optimizer_everywhere() — Venture X wins base rate anywhere (2x Capital One Miles)
- test_optimizer_ev_charging() — WF Autograph wins (3x WF Rewards, $0.03/dollar)
- test_points_excluded_transactions() — Venmo transactions earn 0 points

Run compute_points_ledger() and verify points_ledger table is populated.

Mark Phase 5 tasks complete in BUILD_PLAN.md.
```

---

## Session 6 — Phase 6: Frontend Dashboard

```
Read CLAUDE.md, BUILD_PLAN.md, and SPEC.md. Phases 1-5 are complete.

Build Phase 6: the Next.js frontend dashboard.

Initialize Next.js in the /frontend directory (if not done):
  npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
  npx shadcn@latest init
  npx shadcn@latest add button card badge progress table dialog input select separator

Install additional deps:
  npm install recharts react-plaid-link lucide-react

Create src/lib/api.ts with typed functions for all backend endpoints.
Use fetch with error handling. Base URL from NEXT_PUBLIC_API_URL env var.

Build these pages in priority order:

1. src/app/page.tsx (Dashboard) — 4 sections:
   - Account balances: card for each account (name, balance, last synced)
   - Budget gauges: BudgetGauge component for each category with spend this month
   - Anomaly alert: banner if unreviewed anomalies exist (links to /anomalies)
   - Points summary: row of cards showing each program total + dollar value estimate

2. src/app/optimize/page.tsx (Card Optimizer):
   - MOBILE-FIRST DESIGN — this is used at checkout on phone
   - Inputs: Category dropdown, Subcategory dropdown (dynamic), Amount input
   - Results: ranked card list (winner highlighted in green)
   - No login required — this page works immediately

3. src/app/transactions/page.tsx:
   - Table with filters: month picker, category dropdown, account dropdown, search box
   - Editable category column (click → dropdown)
   - Color coding: transfers gray, amounts > $200 bold

4. src/app/budgets/page.tsx:
   - Edit monthly budgets: category + dollar amount
   - Current month status with progress bars
   - Color coding from SPEC.md (green/yellow/orange/red)

Use BudgetGauge, CardOptimizer, TransactionTable components per SPEC.md descriptions.
Use shadcn Card, Badge, Progress, Table components throughout.
Dark mode support (Tailwind dark: prefix).

Mark Phase 6 tasks complete in BUILD_PLAN.md.
```

---

## Session 7 — Phase 7: ML Pipeline

```
Read CLAUDE.md, BUILD_PLAN.md, and SPEC.md. Phases 1-6 are complete.

Build Phase 7: anomaly detection and spending forecasting.

Create app/ml/anomaly_detector.py:
- run_anomaly_detection() function
- Pull last 90 days of non-excluded, non-pending transactions
- Features: amount, category_encoded (LabelEncoder), day_of_week, amount_vs_category_avg
  amount_vs_category_avg = transaction amount / average amount for that category (last 90d)
- IsolationForest: contamination=0.05, n_estimators=200, random_state=42
- Generate reason string: "Unusual Food & Drink charge: $234.56 (4.2x your typical restaurant spend)"
- Upsert to anomalies table (UNIQUE on transaction_id, update if score changed)
- Skip if fewer than 50 transactions in dataset (not enough data)

Create app/ml/forecaster.py:
- forecast_category_spending(category, periods=30) function
- Prophet with weekly_seasonality=True, yearly_seasonality=True, daily_seasonality=False
- Requires 30+ days of data for that category, else return {"error": "insufficient data"}
- Returns: {category, projected_30d_spend, confidence_interval, daily_forecast: [...]}

Create app/tasks/ml_tasks.py:
- run_anomaly_scan() Celery task
- run_spending_forecast() Celery task (weekly, runs all categories with 30+ days data)

Create API endpoints:
- GET /api/anomalies?status=unreviewed — with transaction details joined
- POST /api/anomalies/{id}/review — body: {"status": "ok" | "confirmed"}
- GET /api/forecast/{category} — returns Prophet forecast

Build src/app/anomalies/page.tsx:
- Table of flagged transactions
- Each row: date, merchant, amount, category, reason, "Mark OK" + "Confirm Issue" buttons

Run anomaly detection on existing data:
  docker compose exec celery_worker celery -A app.celery_app call tasks.ml_tasks.run_anomaly_scan

Mark Phase 7 tasks complete in BUILD_PLAN.md.
```

---

## Session 8 — Phase 8: Final Pages & AI Chat

```
Read CLAUDE.md, BUILD_PLAN.md, and SPEC.md. Phases 1-7 are complete. Final phase.

Build Phase 8: remaining pages, maintenance tasks, and AI chat.

1. Create app/tasks/maintenance.py:
   - snapshot_net_worth(): sum all account balances, save to net_worth_snapshots
     assets = SUM(balance) for depository + investment accounts
     liabilities = ABS(SUM(balance)) for credit accounts with negative balance
     breakdown = {card_slug: balance} JSON
   - refresh_materialized_views(): REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_category_spend

2. Create GET /api/net-worth/history?days=365 endpoint

3. Create GET /api/dashboard/summary endpoint combining:
   - Current month spending by category vs budget (from materialized view)
   - All account balances
   - Last 5 unreviewed anomalies
   - Points summary per program

4. Create app/api/chat.py:
   POST /api/chat — body: {"message": "...", "history": [...]}
   - Build financial context from DB (last 3 months, all accounts, points, anomalies)
   - Use prompt caching: cache_control on system message (context doesn't change per-message)
   - Model: claude-sonnet-4-6
   - Stream response back to frontend
   - Context template from SPEC.md

5. Build src/app/points/page.tsx:
   - Points balance per program (editable — user enters current balance manually)
   - Redemption nudge banners when REDEMPTION_THRESHOLDS exceeded (from CLAUDE.md)
   - Points earned this month: breakdown by card, top categories

6. Build src/app/net-worth/page.tsx:
   - Recharts LineChart of net worth over time
   - Toggle between 30d / 90d / 1y / all time
   - Asset vs liability stacked area chart

7. Build src/app/chat/page.tsx:
   - Chat UI with message history
   - Suggested questions as clickable chips:
     "Am I on track with my budget this month?"
     "Which card should I use for restaurants?"
     "How much did I spend on food last month?"
     "When should I redeem my Chase points?"
     "What's my biggest spending category this year?"
   - Streaming response (use EventSource or fetch with ReadableStream)

8. Write README.md covering:
   - Prerequisites (Docker, Ollama, Tailscale)
   - Initial setup steps
   - How to link accounts (Plaid Link flow)
   - Daily operations (sync is automatic)
   - How to access from MacBook via Tailscale

Mark all Phase 8 tasks complete in BUILD_PLAN.md. Congratulations — platform is done.
```

---

## Debugging Prompts (Use When Stuck)

### Docker Issues
```
Check the logs for [service_name] and fix any startup errors:
  docker compose logs --tail=50 [service_name]
The error I'm seeing is: [paste error]
```

### Database Issues
```
I'm getting a database error. Check:
1. That alembic upgrade head has been run
2. That all models are imported in app/models/__init__.py  
3. That the DATABASE_URL in .env matches the postgres service config
Error: [paste error]
```

### Plaid Issues
```
Plaid is returning an error. The PLAID_ENV is 'development'.
The error code is: [paste error]
Check the connector.py and verify the API call format matches the plaid-python SDK docs.
```

### Ollama Not Responding
```
Ollama calls are failing from inside Docker. 
Test with: docker compose exec backend curl http://host.docker.internal:11434/api/tags
If that fails, check that Ollama is running on the host: curl http://localhost:11434/api/tags
Fix the networking issue.
```

### Points Calculation Wrong
```
The points calculation is wrong for [card] on [category] transactions.
Expected: [X]x multiplier = [Y] points
Got: [Z] points
Check tracker.py earn rules and the _get_best_earn_rule() matching logic.
The matching priority must be: exact subcategory > category only > base rate.
```
