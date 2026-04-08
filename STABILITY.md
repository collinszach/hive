# STABILITY.md — Hive Finance Platform
Generated: 2026-04-08

## What Was Fixed

### P1: Custom categorization rules bypassed during sync
**File:** `backend/app/tasks/ingestion.py`
**Change:** `_upsert_transactions()` now loads active DB rules once per batch and passes them
to `_plaid_tx_to_dict()`. Custom rules are checked BEFORE the ML pipeline (regex/Ollama/Claude).
Previously, rules were only applied retroactively via the separate `apply_custom_rules_to_all`
task (triggered after settings edits). New transactions from Plaid sync bypassed them entirely.

## What Was Verified (No Changes Needed)

- **DB migrations:** 8 migration files, all consistent with the model definitions.
- **Plaid sync:** Cursor-based incremental sync. Upserts on `plaid_transaction_id` (unique
  constraint). Balances refreshed after each sync. Cursor persisted to `plaid_links.sync_cursor`.
- **Transfer detection:** `is_transfer` and `is_excluded` set at ingest time for Venmo/Zelle/
  autopayments. These transactions never appear in spend analytics.
- **Budget vs actual math:** `GET /api/budgets` filters correctly — excludes `is_excluded`,
  `is_transfer`, `pending`, and `amount <= 0`. Category-level subtotals are accurate.
- **Net worth snapshot:** `snapshot_net_worth` task upserts on today's date. `net_worth` is a
  PostgreSQL computed column (`total_assets - total_liabilities`). Math verified correct.
- **Dashboard summary:** Excludes pending, transfers, balance-only account subtypes (savings/CD/
  money market). Top categories and total spend are correctly computed.
- **Custom rules CRUD:** `GET/POST/PUT/DELETE /api/rules` all functional. Settings UI at
  `/settings → Categorization Rules` tab is functional with add/toggle/delete.
- **Anomaly model:** Uses `status` field (not `is_reviewed` bool). Dashboard query consistent
  with model. No mismatch.

## Running the Stack

```bash
# Always use the native-db override (postgres + redis are on the host, not in Docker)
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d

# After code changes: rebuild, then restart
docker compose build backend frontend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d

# Run migrations after any schema change
docker compose exec backend alembic upgrade head

# Trigger a manual sync (no need to wait for the 6 AM cron)
curl -X POST http://localhost:8005/api/admin/sync -H "Authorization: Bearer <token>"

# Recategorize Uncategorized transactions (separate task)
# Trigger from the admin endpoint or via Celery:
docker compose exec celery_worker celery -A app.celery_app call app.tasks.ingestion.recategorize_uncategorized
```

## Known Remaining Issues (Deferred — Non-blocking)

1. **Plaid webhook handler incomplete** (`backend/app/api/plaid_webhook.py`).
   The daily 6 AM cron sync is the fallback and works correctly. Real-time updates are not
   available, but this doesn't break the core loop.

2. **Modified transactions not recategorized on upsert conflict** (`ingestion.py:315`).
   Intentional design: category is excluded from the ON CONFLICT SET clause to preserve manual
   overrides. Plaid-corrected merchants won't get recategorized automatically. Workaround: run
   `recategorize_uncategorized` task or edit manually in the UI.

3. **SnapTrade integration partial.** Investment account balances may not sync correctly.
   Does not affect spending analytics or credit card tracking.

4. **Materialized view `mv_monthly_category_spend`** is refreshed daily at 8 AM by Celery beat.
   If beat is down, analytics may return stale data. The view is used for performance on
   historical reports; the transactions table is the source of truth.

5. **Anomaly detection / Prophet forecasting / Insights generation** — complex ML tasks
   scheduled in Celery beat. Edge cases may exist. These are additive features and do not
   affect the core sync/budget/points loop.

6. **Tax document file storage** — `TaxDocument` model has a `file_path` field but the upload
   endpoint's storage path is not clearly defined. Tax features are non-critical.

## Checklist — "What Done Looks Like"

- [x] Plaid syncs without errors (cursor-based, error logged to `plaid_links.last_sync_error`)
- [x] Every transaction has a non-null category (fallback: "Uncategorized")
- [x] Rules engine applies user-defined mappings at sync time (fixed in this session)
- [x] Budget vs actual is mathematically accurate
- [x] Net worth updates on sync (via daily `snapshot_net_worth` task)
- [x] Stack runs with `docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d`
