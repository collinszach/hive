# RECON.md — Hive Finance Platform Stabilization Reconnaissance
Generated: 2026-04-08

## Summary
The platform is at roughly Phase 8 completion. Core infrastructure is solid. The critical gap is
that **custom categorization rules are not applied during sync** — they exist in the DB and can be
managed via the UI, but are only applied retroactively via a separate admin task, not inline during
Plaid ingestion. Everything else in the core loop is structurally sound.

---

## 1. Project Structure

### Docker Compose Services
File: `docker-compose.yml` — all services use `network_mode: host`

| Service | Port | Build/Image |
|---------|------|-------------|
| postgres | 5432 | postgres:16 |
| redis | 6379 | redis:7-alpine |
| backend | 8005 | ./backend |
| celery_worker | — | ./backend |
| celery_beat | — | ./backend |
| frontend | 3001 | ./frontend |
| nginx | 80/443 | nginx:alpine |

**Override required:** `docker-compose.native-db.yml` replaces postgres/redis with no-op
containers so the host-native services are used instead of Docker containers.

### Entry Points
- **Backend:** `backend/app/main.py` (FastAPI + Uvicorn on port 8005)
- **Frontend:** `frontend/src/app/` (Next.js 14 App Router on port 3001)
- **Task scheduler:** `backend/app/celery_app.py` (Celery beat + worker)

---

## 2. Database Schema (18 models)

All models are in `backend/app/models/`. Key tables for the core loop:

| Table | Purpose | Key Constraints |
|-------|---------|-----------------|
| transactions | Transaction storage | plaid_transaction_id UNIQUE (deduplication) |
| accounts | Linked bank/card accounts | plaid_account_id UNIQUE |
| budgets | Monthly budgets by category | UNIQUE(category, month) |
| categorization_rules | User-defined rules | — |
| net_worth_snapshots | Daily balance snapshots | snapshot_date UNIQUE |
| anomalies | ML-flagged transactions | UNIQUE(transaction_id) |

### Migrations
8 migration files, all in `backend/alembic/versions/`. All appear consistent with models.
`categorization_rules` was added in `d5e6f7a8b9c0_add_advanced_features.py`.

---

## 3. Plaid Sync Flow (end-to-end)

```
Celery beat (6:00 AM daily)
  └─ sync_all_accounts()         [ingestion.py:141]
       └─ sync_single_link.delay(item_id)  [fans out per active PlaidLink]
            ├─ plaid_connector.sync_transactions()  [connector.py — cursor-based]
            ├─ _upsert_transactions(db, account_map, added)
            │    └─ _plaid_tx_to_dict()  ← categorization happens here
            │         ├─ is_transfer(raw_desc)  [transfer_detector.py]
            │         └─ _run_categorizer(raw_desc, is_xfer)
            │              └─ categorize_transaction()  [categorizer.py]
            │                   ├─ Stage 1: hardcoded regex rules
            │                   ├─ Stage 2: Ollama llama3.2
            │                   └─ Stage 3: Claude Haiku 4.5 (API fallback)
            ├─ _upsert_transactions(db, account_map, modified)
            ├─ _remove_transactions(db, removed)
            ├─ plaid_connector.get_accounts()  → refresh balances
            └─ link.sync_cursor = next_cursor  → persisted

Manual trigger: POST /api/admin/sync → queues sync_all_accounts
Also triggered: immediately after PlaidLink exchange-token (new account connection)
```

**Upsert behavior** (ingestion.py:293):
- ON CONFLICT(plaid_transaction_id) DO UPDATE: amount, pending, merchant, raw_description,
  payment_channel, logo_url, is_transfer, is_excluded
- **Category NOT updated on conflict** — intentional to preserve manual overrides

---

## 4. Categorization Implementation

### Current Pipeline (categorizer.py)
Three-stage ML pipeline called for every new transaction:
1. **Hardcoded regex** (213 patterns in `_RAW_RULES`) — ~70% coverage, instant
2. **Ollama llama3.2** — HTTP call to host:11434, 60s timeout
3. **Claude Haiku 4.5** — Anthropic API, paid fallback
4. **Fallback:** ("Uncategorized", "Uncategorized", "uncategorized")

### Custom DB Rules (categorization_rules table)
- Fields: match_type (contains/starts_with/exact/regex), match_value, category, subcategory,
  priority, amount_min, amount_max, is_active
- Endpoint: GET/POST/PUT/DELETE /api/rules ✓
- UI: Settings page → Categorization Rules tab ✓
- `_apply_custom_rules()` function exists in ingestion.py ✓

### ⚠️ CRITICAL GAP: Rules not applied during sync
`_apply_custom_rules()` is only called from `apply_custom_rules_to_all()` (a separate Celery task,
triggered after rule edits in settings). It is **NOT** called from `_plaid_tx_to_dict()` during
sync. This means:
- New transactions from Plaid sync bypass DB custom rules entirely
- Rules are only applied retroactively when user edits a rule in settings
- A transaction from a merchant with a custom rule will be miscategorized until the task runs

**File:** `backend/app/tasks/ingestion.py`
**Lines:** `_plaid_tx_to_dict()` at line 219, `_apply_custom_rules()` at line 22

---

## 5. API Endpoints

20+ routers registered in main.py. All core CRUD endpoints implemented. Notable:

| Status | Endpoint | Issue |
|--------|----------|-------|
| ✓ | GET /api/dashboard/summary | Looks correct |
| ✓ | GET/POST/PUT/DELETE /api/budgets | Looks correct |
| ✓ | GET /api/transactions | Paginated, filterable |
| ✓ | GET/POST/PUT/DELETE /api/rules | Custom rules CRUD |
| ✓ | GET /api/accounts | Active accounts |
| ✓ | GET /api/net-worth/history | Reads from snapshots table |
| ✓ | POST /api/admin/sync | Manual sync trigger |
| ⚠ | POST /api/plaid/webhook | Handler registered, logic may be incomplete |

---

## 6. Frontend Pages

All 21 routes exist under `frontend/src/app/`. API client at `frontend/src/lib/api.ts`.

Key pages for core loop:
- `/` — Dashboard (calls /api/dashboard/summary)
- `/transactions` — Transaction table
- `/budgets` — Budget manager
- `/settings` — Categorization rules editor (functional)
- `/net-worth` — Balance history chart

---

## 7. Environment Variables

All sourced from `.env` via pydantic-settings (`backend/app/config.py`).
Critical: POSTGRES_PASSWORD, PLAID_CLIENT_ID, PLAID_SECRET, ANTHROPIC_API_KEY, SECRET_KEY.

**Docker networking:** REDIS_URL and CELERY_*_URL use `redis://redis:6379` by default.
With `docker-compose.native-db.yml`, postgres/redis point to 127.0.0.1 (host).

---

## 8. Core Loop Health Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| DB schema | ✓ Solid | 8 migrations, models consistent |
| Plaid sync | ✓ Solid | Cursor-based, idempotent upsert |
| Transfer detection | ✓ Correct | is_excluded=TRUE applied at ingest |
| Categorization pipeline | ⚠ Gap | DB rules not applied during sync |
| Budget vs actual | ✓ Correct | Excludes pending, transfers, balance-only accts |
| Net worth snapshot | ✓ Correct | Upserts on today's date, computed column |
| Custom rules CRUD | ✓ Exists | API + UI both functional |
| Custom rules at sync | ✗ Missing | Rules only applied retroactively |

---

## 9. Issues Found

### P1 — Must Fix (breaks core loop)

**[P1-CAT] Custom rules bypassed during sync**
- File: `backend/app/tasks/ingestion.py`
- Fix: Load active rules at start of `_upsert_transactions()` and run `_apply_custom_rules()`
  BEFORE calling `_run_categorizer()` in `_plaid_tx_to_dict()`
- Estimated effort: ~15 lines in ingestion.py

### P2 — Should Fix (correctness/stability)

**[P2-PLAID-CAT] Plaid personal_finance_category not used as fallback**
- `_plaid_tx_to_dict()` stores `plaid_category` (the generic array) but never uses
  `personal_finance_category.primary` as a categorization fallback
- Currently falls through to Ollama/Claude if hardcoded regex misses
- This is acceptable given the existing pipeline covers most cases; defer unless Ollama is down

**[P2-UPSERT-CAT] Modified transactions not recategorized on conflict**
- Intentional (preserves manual overrides), but means a transaction corrected by Plaid
  (e.g., wrong merchant name initially) won't get recategorized
- Acceptable trade-off; document and defer

### P3 — Deferred (non-blocking)

- Plaid webhook handler incomplete (daily cron fallback works)
- SnapTrade integration partial
- Anomaly detection / Prophet forecast / insights: complex tasks, likely edge cases
- Tax document file storage path not clearly defined

---

## 10. What To Fix (Phase 2 → Phase 3 sequence)

1. **[P1-CAT]** Wire `_apply_custom_rules()` into sync at ingest time (Phase 2)
2. Verify stack starts clean with `docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d`
3. Write STABILITY.md

No schema changes required. No new dependencies required.
