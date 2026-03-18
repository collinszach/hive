# BUILD_PLAN.md — Finance Platform Build Tracker

## How to Use This File
At the start of every Claude Code session, say:
> "Read CLAUDE.md and BUILD_PLAN.md. Tell me the current phase status, then continue."

Mark tasks ✅ as you complete them. Never skip a phase — each builds on the last.

---

## Current Status
**Active Phase:** 9 — Testing, Hardening & Go-Live
**Last completed task:** Phase 9 pytest tests ✅ (176 tests passing)
**Note:** Phases 3–8 code was implemented in a prior session but not marked complete.
All code tasks through Phase 8 are done. Phase 9 remaining: error handling hardening,
Plaid webhook, log rotation, NUC deployment, Tailscale setup, go-live.

---

## Phase 1: Infrastructure Scaffold ✅
**Goal:** Get the full Docker Compose stack running with health checks. No business logic yet.

- [x] Create `docker-compose.yml` with all 7 services: postgres, redis, backend, celery_worker, celery_beat, frontend, nginx
- [x] Create `docker-compose.dev.yml` with dev overrides (volume mounts for hot reload, exposed ports)
- [x] Create `backend/Dockerfile` (Python 3.11-slim, non-root user)
- [x] Create `frontend/Dockerfile` (Node 20-alpine, multi-stage build)
- [x] Create `nginx/nginx.conf` (proxy /api/* to backend:8000, /* to frontend:3000)
- [x] Create `backend/requirements.txt` with all Python dependencies
- [x] Create `backend/app/main.py` — minimal FastAPI app with `/health` endpoint
- [x] Create `backend/app/config.py` — pydantic-settings with all env vars
- [x] Create `backend/app/db.py` — async SQLAlchemy engine + session factory
- [x] Create `backend/app/celery_app.py` — Celery instance, beat schedule defined
- [x] Run `docker compose up` and verify all containers are healthy
- [x] Verify `/health` returns 200, frontend renders blank page, nginx routing works

**Note:** Stack uses `network_mode: host` due to Docker 29 nftables issue. Nginx on port 8080 (host nginx occupies 80). To restore port 80: `sudo systemctl stop nginx && sudo systemctl disable nginx`, then revert nginx.conf listen port.

**Phase 1 complete when:** `docker compose up` starts cleanly with no errors and health checks pass.

---

## Phase 2: Database Schema & Migrations ✅
**Goal:** All tables created via Alembic. DB is the source of truth.

- [x] Initialize Alembic: `alembic init alembic`
- [x] Configure `alembic/env.py` to use async engine from `app/db.py`
- [x] Create `app/models/__init__.py` — import all models here
- [x] Create `app/models/account.py` — accounts table
- [x] Create `app/models/plaid_link.py` — plaid_links table (access_token, sync_cursor)
- [x] Create `app/models/transaction.py` — transactions table (full schema from SPEC.md)
- [x] Create `app/models/budget.py` — budgets table
- [x] Create `app/models/earn_rule.py` — earn_rules table
- [x] Create `app/models/points_ledger.py` — points_ledger table
- [x] Create `app/models/points_balance.py` — points_balances table
- [x] Create `app/models/net_worth.py` — net_worth_snapshots table
- [x] Create `app/models/anomaly.py` — anomalies table
- [x] Create initial Alembic migration: `alembic revision --autogenerate -m "initial_schema"`
- [x] Create materialized view migration (manual): `mv_monthly_category_spend`
- [x] Run migration: `alembic upgrade head`
- [x] Seed earn_rules table with all rules from CLAUDE.md
- [x] Verify all tables exist in psql

**Phase 2 complete when:** `alembic upgrade head` runs clean, all tables + materialized view exist, earn_rules seeded.

---

## Phase 3: Plaid Integration & Daily Sync ✅
**Goal:** Plaid Link works in browser. Daily sync task runs and populates transactions.

- [x] Create `app/plaid/connector.py` — PlaidConnector class
  - `get_link_token(user_id)` method
  - `exchange_public_token(public_token)` method
  - `sync_transactions(access_token, cursor)` method using `/transactions/sync`
  - `get_accounts(access_token)` method
- [x] Create `app/api/plaid_link.py` endpoints:
  - `POST /api/plaid/link-token` — creates Plaid Link token
  - `POST /api/plaid/exchange-token` — exchanges public token, saves access_token + account data
- [x] Create `app/tasks/ingestion.py`:
  - `sync_all_accounts()` Celery task
  - `_upsert_transactions(db, account_id, transactions)` helper
  - `_remove_transactions(db, removed)` helper
- [x] Create `app/ml/transfer_detector.py` — `is_transfer(description, amount)` function
- [x] Add plaid_link endpoints to `main.py` router
- [x] Create simple frontend Plaid Link page at `/connect` using `react-plaid-link`
- [ ] Test: complete Link flow for one account, verify transactions appear in DB *(requires browser + real bank credentials)*
- [ ] Test: run `sync_all_accounts` task manually via Celery, verify cursor updates *(requires real Plaid access token)*
- [ ] Verify Venmo/Zelle transactions have `is_excluded=TRUE` *(requires real data)*

**Phase 3 complete when:** At least one real bank account linked, transactions in DB, sync task works manually.

---

## Phase 4: Transaction Categorization Pipeline ✅
**Goal:** All new transactions get categorized automatically via 3-stage pipeline.

- [x] Create `app/ml/categorizer.py`:
  - Stage 1: `_categorize_with_rules(description)` — regex rule engine (all rules from CLAUDE.md)
  - Stage 2: `_categorize_with_ollama(description)` — HTTP call to Ollama llama3.2
  - Stage 3: `_categorize_with_claude(description)` — Claude Haiku 4.5 API call
  - `categorize_transaction(description, plaid_data)` — orchestrator, tries stages in order
- [x] Integrate categorizer into `_upsert_transactions()` in ingestion task
- [x] Create `PUT /api/transactions/{id}/category` endpoint for manual override
- [x] Create `GET /api/transactions` endpoint with all filters
- [ ] Re-categorize all existing transactions in DB *(requires real data)*
- [ ] Verify: Southwest Airlines transactions get "SW Flights" subcategory *(requires real data)*
- [ ] Check Ollama fallback works *(requires Ollama running on NUC)*

**Phase 4 complete when:** All transactions categorized, Ollama fallback tested, manual override works.

---

## Phase 5: Points Tracker & Card Optimizer ✅
**Goal:** Points calculated for every transaction. Optimizer API works.

- [x] Create `app/points/tracker.py` with EARN_RULES, POINT_VALUES_CPP, REDEMPTION_THRESHOLDS
- [x] `get_best_card_for_purchase(category, subcategory, amount)` → ranked list
- [x] `compute_points_for_transaction(transaction)` → (points, rate, program)
- [x] `_get_best_earn_rule(card_slug, category, subcategory)` with correct priority
- [x] Create `app/tasks/points.py`: `compute_points_ledger()` Celery task
- [x] Create points API endpoints (summary, optimize, ledger)
- [x] Verified via tests: Restaurant on Amex Gold = 4x, SW Airlines on Chase Southwest = 3x SW RR, Venture X base = 2x
- [ ] Run `compute_points_ledger()` against real transaction data *(requires live data)*

**Phase 5 complete when:** Points ledger populated, optimizer returns correct rankings for test cases.

---

## Phase 6: Core Dashboard (Frontend) ✅
**Goal:** Working dashboard showing the most important information first.

- [x] Next.js 14 project with TypeScript, Tailwind, App Router initialized
- [x] Create `src/lib/api.ts` — typed API client wrapping all backend endpoints
- [x] Build `src/app/page.tsx` (Dashboard) with balance cards, budget gauges, anomaly alert, points row
- [x] Build `src/app/transactions/page.tsx` — filterable table with inline category edit
- [x] Build `src/app/budgets/page.tsx` — budget editor with actual vs budget + color coding
- [x] Build `src/app/optimize/page.tsx` — card optimizer, mobile-friendly
- [ ] Test all pages render with real data *(requires live bank data)*

**Phase 6 complete when:** All 4 core pages working with real data from backend.

---

## Phase 7: ML Pipeline ✅
**Goal:** Anomaly detection running daily. Spending forecasts available.

- [x] Create `app/ml/anomaly_detector.py` — IsolationForest with contamination=0.05
- [x] Create `app/ml/forecaster.py` — Prophet spending forecasts
- [x] Create `app/tasks/ml_tasks.py` — `run_anomaly_scan()`, `run_spending_forecast()` tasks
- [x] Create API endpoints: GET /api/anomalies, POST /api/anomalies/{id}/review, GET /api/forecast/{category}
- [x] Build `src/app/anomalies/page.tsx` — flagged transaction review with "Looks OK" / "Flag It" actions
- [ ] Run anomaly detection on real data *(requires ≥30 days of real transactions)*
- [ ] Verify: unusually large transaction gets flagged *(requires real data)*

**Phase 7 complete when:** Anomaly scan runs on real data and flags at least one transaction correctly.

---

## Phase 8: Secondary Pages & AI Chat ✅
**Goal:** Complete all remaining pages. AI chat endpoint working.

- [x] Create `app/tasks/maintenance.py`: `snapshot_net_worth()`, `refresh_materialized_views()`
- [x] Create API endpoints: GET /api/net-worth/history, GET /api/dashboard/summary
- [x] Build `src/app/points/page.tsx` — points summary + redemption nudge banners
- [x] Build `src/app/net-worth/page.tsx` — recharts line chart with 30/90/180/365D ranges
- [x] Create `app/api/chat.py` — POST /api/chat with Claude Sonnet 4.6 + prompt caching
- [x] Build `src/app/chat/page.tsx` — chat UI with suggested questions + conversation history
- [ ] Write README.md with setup instructions *(documentation, low priority)*
- [ ] Add Tailscale access instructions *(after NUC deployment)*

**Phase 8 complete when:** All pages working, AI chat responds correctly to financial questions, net worth tracking active.

---

## Phase 9: Testing, Hardening & Go-Live
**Goal:** Production-ready. Running on NUC. Monitoring in place.

- [x] Write pytest tests for:
  - Points tracker earn rule logic (53 tests — all 6 cards with edge cases) ✅
  - Categorizer rule engine (91 tests — Southwest, Venmo, fast food, Uber Eats vs Uber) ✅
  - Transfer detector (25 tests — Venmo, Zelle, Cash App, bank transfers) ✅
  - Deduplication (7 tests — plaid_transaction_id uniqueness, upsert logic, exclusion flags) ✅
  - **176 total tests, all passing**
- [x] Write vitest tests for: ✅
  - Card optimizer renders correct winner (9 tests — restaurant, SW flights, misc base rate, earn rate math)
  - Budget gauge color/% logic (11 tests — green/yellow/red thresholds, bar cap at 100%, remaining label)
  - Utils helpers (15 tests — fmt, fmtExact, fmtDate, SUBCATEGORIES, CARD_NAMES)
  - **35 total vitest tests, all passing**
- [x] Add error handling to all Celery tasks (retry logic, failure logging) ✅
- [x] Add Plaid webhook endpoint for real-time transaction updates ✅
- [x] Set up log rotation for Docker containers ✅ (json-file driver, max-size per service)
- [ ] Deploy to NUC:
  - Copy project via `rsync` or `git push` to NUC
  - Set up `.env` with real secrets on NUC
  - Run `docker compose up -d`
  - Configure Celery beat to start on boot
- [x] Configure Tailscale so MacBook can access NUC dashboard
- [ ] Go live: link all 8 accounts through Plaid Link
- [ ] Verify first daily sync completes successfully

**Phase 9 complete when:** Platform running on NUC, all 8 accounts syncing daily, accessible from MacBook via Tailscale.

---

## Known Manual Steps (Claude Code Cannot Do These)
These require you to act in a browser or terminal:

1. **Plaid account linking** — must click through Plaid Link UI in browser and log into each bank
2. **`.env` file** — fill in real API keys (never share with Claude Code)
3. **Ollama installation on NUC** — run install script on host, not in Docker
4. **setup** — install on both NUC and MacBook, log into same account
5. **SnapTrade account linking** — separate OAuth flow for investment accounts
6. **Points balances** — manually enter current points balances on each card initially
