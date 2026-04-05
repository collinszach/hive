# SnapTrade Integration — Design Spec
**Date:** 2026-04-05
**Status:** Approved

## Goal

Connect Charles Schwab (and other brokerages) via SnapTrade to pull investment account balances into the platform. Accounts appear alongside Plaid-linked accounts on the dashboard and contribute to net worth tracking.

---

## Scope

**In scope:**
- SnapTrade OAuth connect flow (user links their brokerage)
- Daily sync of investment account balances into the existing `accounts` table
- Account appears on dashboard with its current value like any other account
- Encrypted storage of SnapTrade credentials

**Out of scope:**
- Holdings / individual positions
- Day change % / total return %
- Investment transactions
- A dedicated portfolio or holdings page

---

## Architecture

```
User clicks "Connect Brokerage"
        │
        ▼
POST /api/snaptrade/connect
  → registers SnapTrade user (if not already registered)
  → returns { redirect_url } pointing to SnapTrade OAuth
        │
        ▼
User completes OAuth at SnapTrade (selects Schwab, authenticates)
        │
        ▼
SnapTrade redirects to GET /api/snaptrade/callback?...
  → fetches accounts from SnapTrade
  → upserts each into `accounts` table (type="investment")
  → stores snaptrade_user_id + snaptrade_user_secret (encrypted) on User
        │
        ▼
Daily Celery task: snaptrade_sync
  → loads all accounts with snaptrade_account_id set
  → fetches current balance from SnapTrade
  → updates current_balance + last_synced on each account
```

---

## Schema Changes

### `accounts` table — one new column

```sql
ALTER TABLE accounts ADD COLUMN snaptrade_account_id TEXT UNIQUE;
```

Nullable. Set only for SnapTrade-connected accounts. Used to identify which accounts to sync.

### `users` table — two new columns

```sql
ALTER TABLE users ADD COLUMN snaptrade_user_id TEXT;
ALTER TABLE users ADD COLUMN snaptrade_user_secret TEXT;  -- encrypted
```

`snaptrade_user_secret` is encrypted using the existing `encrypt()` / `decrypt()` helpers in `app/encryption.py` before being stored.

---

## Backend

### `backend/app/snaptrade/connector.py`

Thin wrapper around the `snaptrade` Python SDK (`snaptrade-python-sdk` on PyPI).

```python
from snaptrade_client import SnapTrade

def get_client() -> SnapTrade:
    return SnapTrade(
        consumer_key=settings.snaptrade_consumer_key,
        client_id=settings.snaptrade_client_id,
    )
```

Functions:
- `register_user(user_id: str) -> tuple[str, str]` — registers a new SnapTrade user, returns `(snaptrade_user_id, user_secret)`
- `get_connect_url(snaptrade_user_id: str, user_secret: str, redirect_uri: str) -> str` — returns brokerage OAuth redirect URL
- `get_accounts(snaptrade_user_id: str, user_secret: str) -> list[dict]` — returns list of `{id, name, institution, balance}` dicts
- `delete_user(snaptrade_user_id: str, user_secret: str) -> None` — cleanup on disconnect

### `backend/app/api/snaptrade.py`

```
POST /api/snaptrade/connect
```
- If `current_user.snaptrade_user_id` is None, calls `register_user()`, encrypts and stores `user_secret` on the user record
- Calls `get_connect_url()` with `redirect_uri = settings.app_base_url + "/connect"`
- Returns `{ "redirect_url": "..." }`

```
GET /api/snaptrade/callback
```
- Called after SnapTrade OAuth redirect (frontend makes this call on page load if `snaptrade_connected=1` is in query params)
- Calls `get_accounts()` to fetch all newly-linked accounts
- For each account: upserts into `accounts` table with `snaptrade_account_id`, `type="investment"`, `subtype="brokerage"` (or `"roth"` if detectable), `is_manual=False`, `institution` from SnapTrade response
- Returns `{ "accounts_added": N }`

### `backend/app/tasks/snaptrade_sync.py`

Celery task `snaptrade_sync_balances`:
- Loads all users with `snaptrade_user_id` set
- For each user, calls `get_accounts()` (decrypting `user_secret` first)
- For each returned account, finds the matching row in `accounts` by `snaptrade_account_id` and updates `current_balance` and `last_synced`
- Added to Celery beat schedule at `hour=6, minute=45` (after Plaid sync at 6:00)

### `backend/app/config.py`

Already has `snaptrade_client_id` and `snaptrade_consumer_key`. No changes needed.

### `backend/requirements.txt`

Add: `snaptrade-python-sdk`

---

## Frontend

### `frontend/src/app/connect/page.tsx`

Add a "Connect Brokerage" section below the existing Plaid section.

**Connect button flow:**
1. Button calls `POST /api/snaptrade/connect`
2. On success, `window.location.href = data.redirect_url` (full redirect to SnapTrade OAuth)
3. After SnapTrade OAuth, user is redirected back to `/connect?snaptrade_connected=1`
4. Page detects `snaptrade_connected=1` in URL params on mount, calls `GET /api/snaptrade/callback`
5. Shows success message: "Connected N investment account(s)"

**Connected state:** List SnapTrade-connected accounts the same way Plaid-linked accounts are listed (name, institution, balance). No special UI — same `AccountOut` shape from the existing `GET /api/accounts` endpoint.

### Dashboard (`frontend/src/app/page.tsx`)

No changes required. SnapTrade accounts appear in the existing accounts list (returned by `GET /api/accounts`) and are split into "Bank Accounts" or "Credit Cards" sections by the existing type-based logic. Investment accounts (`type="investment"`) will fall into the "Bank Accounts" group — that group should be renamed to "Accounts" to be inclusive.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| SnapTrade credentials not set in `.env` | `POST /api/snaptrade/connect` returns 503 with "SnapTrade not configured" |
| SnapTrade API unreachable | 503; frontend shows generic error |
| User cancels OAuth at SnapTrade | Redirect returns without `snaptrade_connected=1`; no action taken |
| Account already connected (duplicate `snaptrade_account_id`) | Upsert on conflict — update balance, no duplicate row |

---

## Alembic Migration

One migration file covering both table changes:
```python
op.add_column("accounts", sa.Column("snaptrade_account_id", sa.Text(), nullable=True))
op.create_unique_constraint("uq_accounts_snaptrade_id", "accounts", ["snaptrade_account_id"])
op.add_column("users", sa.Column("snaptrade_user_id", sa.Text(), nullable=True))
op.add_column("users", sa.Column("snaptrade_user_secret", sa.Text(), nullable=True))
```

---

## Pre-flight Checklist

- [ ] Create SnapTrade account at dashboard.snaptrade.com
- [ ] Set `SNAPTRADE_CLIENT_ID` and `SNAPTRADE_CONSUMER_KEY` in `.env`
- [ ] Set `APP_BASE_URL` in `.env` (e.g., `http://nuc.tailnet-xyz.ts.net`) — used for OAuth redirect URI
- [ ] Rebuild backend container after changes
- [ ] Run `alembic upgrade head`
