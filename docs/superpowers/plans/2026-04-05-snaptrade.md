# SnapTrade Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect brokerage accounts (e.g., Schwab Roth IRA) via SnapTrade OAuth, sync account balances daily, and display them alongside Plaid accounts on the dashboard.

**Architecture:** SnapTrade credentials (user_id + encrypted user_secret) are stored on the User model. A connector wraps the SnapTrade Python SDK. Two API endpoints handle the OAuth connect flow; a daily Celery task keeps balances fresh. SnapTrade accounts land in the existing `accounts` table.

**Tech Stack:** `snaptrade-python-sdk`, FastAPI, SQLAlchemy async, Celery, Next.js 14, Tailwind CSS, shadcn/ui design tokens.

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `backend/app/models/account.py` | Add `snaptrade_account_id` column |
| Modify | `backend/app/models/user.py` | Add `snaptrade_user_id`, `snaptrade_user_secret` columns |
| Create | `backend/alembic/versions/e1f2a3b4c5d6_add_snaptrade_fields.py` | Migration: 3 new columns |
| Create | `backend/app/snaptrade/__init__.py` | Package marker |
| Create | `backend/app/snaptrade/connector.py` | SnapTrade SDK wrapper |
| Create | `backend/app/api/snaptrade.py` | Connect + callback endpoints |
| Create | `backend/app/tasks/snaptrade_sync.py` | Daily balance sync task |
| Modify | `backend/app/celery_app.py` | Register task + beat schedule |
| Modify | `backend/app/main.py` | Register snaptrade router |
| Modify | `backend/requirements.txt` | Add `snaptrade-python-sdk` |
| Modify | `frontend/src/lib/api.ts` | Add snaptrade types + methods |
| Modify | `frontend/src/app/connect/page.tsx` | Add Connect Brokerage section |
| Modify | `frontend/src/app/page.tsx` | Rename "Bank Accounts" → "Accounts" |
| Create | `backend/tests/test_snaptrade_connector.py` | Unit tests for connector |

---

### Task 1: Schema migration

**Files:**
- Modify: `backend/app/models/account.py`
- Modify: `backend/app/models/user.py`
- Create: `backend/alembic/versions/e1f2a3b4c5d6_add_snaptrade_fields.py`

- [ ] **Step 1: Update Account model**

Open `backend/app/models/account.py`. After the `is_excluded` field, add:

```python
snaptrade_account_id: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
```

Full updated model (show only the new line in context):
```python
    is_manual: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    is_excluded: Mapped[bool] = mapped_column(Boolean, server_default="false")
    snaptrade_account_id: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Update User model**

Open `backend/app/models/user.py`. Add these imports and fields.

Add import at top:
```python
from app.encryption import EncryptedString
```

Add two fields after `last_login_at`:
```python
    snaptrade_user_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    snaptrade_user_secret: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
```

The `EncryptedString` type (already in `app/encryption.py`) transparently encrypts on write and decrypts on read using the `FERNET_KEY` env var.

- [ ] **Step 3: Write the migration file**

Create `backend/alembic/versions/e1f2a3b4c5d6_add_snaptrade_fields.py`:

```python
"""add snaptrade fields

Revision ID: e1f2a3b4c5d6
Revises:
Create Date: 2026-04-05

"""
from alembic import op
import sqlalchemy as sa

revision = "e1f2a3b4c5d6"
down_revision = None  # set to current head before running
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("snaptrade_account_id", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_accounts_snaptrade_id", "accounts", ["snaptrade_account_id"])
    op.add_column("users", sa.Column("snaptrade_user_id", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("snaptrade_user_secret", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "snaptrade_user_secret")
    op.drop_column("users", "snaptrade_user_id")
    op.drop_constraint("uq_accounts_snaptrade_id", "accounts", type_="unique")
    op.drop_column("accounts", "snaptrade_account_id")
```

**IMPORTANT:** Before running, get the current Alembic head and set `down_revision`:
```bash
cd /home/zach/hive
docker compose exec backend alembic heads
```
Set `down_revision` to whatever hash that prints.

- [ ] **Step 4: Run the migration**

```bash
docker compose exec backend alembic upgrade head
```

Expected output: `Running upgrade <prev> -> e1f2a3b4c5d6, add snaptrade fields`

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/account.py backend/app/models/user.py backend/alembic/versions/e1f2a3b4c5d6_add_snaptrade_fields.py
git commit -m "feat: add snaptrade_account_id to accounts, snaptrade credentials to users"
```

---

### Task 2: SnapTrade connector + dependency

**Files:**
- Create: `backend/app/snaptrade/__init__.py`
- Create: `backend/app/snaptrade/connector.py`
- Modify: `backend/requirements.txt`
- Create: `backend/tests/test_snaptrade_connector.py`

- [ ] **Step 1: Add dependency**

Open `backend/requirements.txt`. Add at the end:
```
snaptrade-python-sdk
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_snaptrade_connector.py`:

```python
"""Unit tests for SnapTrade connector — mocks the SDK, tests wrapper logic."""
from unittest.mock import MagicMock, patch

import pytest

from app.snaptrade.connector import SnapTradeConnector


@pytest.fixture
def connector():
    with patch("app.snaptrade.connector.SnapTrade") as mock_cls:
        mock_client = MagicMock()
        mock_cls.return_value = mock_client
        yield SnapTradeConnector(client_id="test-id", consumer_key="test-key"), mock_client


def test_register_user_returns_user_id_and_secret(connector):
    conn, mock_client = connector
    mock_client.authentication.register_snap_trade_user.return_value = MagicMock(
        body={"userId": "snap-uid-123", "userSecret": "secret-abc"}
    )
    uid, secret = conn.register_user("my-local-user-id")
    assert uid == "snap-uid-123"
    assert secret == "secret-abc"
    mock_client.authentication.register_snap_trade_user.assert_called_once_with(
        body={"userId": "my-local-user-id"}
    )


def test_get_connect_url_returns_redirect_uri(connector):
    conn, mock_client = connector
    mock_client.authentication.login_snap_trade_user.return_value = MagicMock(
        body="https://app.snaptrade.com/snapTrade/connect?token=abc"
    )
    url = conn.get_connect_url(
        snaptrade_user_id="snap-uid",
        user_secret="secret",
        redirect_uri="https://example.com/connect",
    )
    assert url == "https://app.snaptrade.com/snapTrade/connect?token=abc"


def test_get_accounts_returns_normalized_list(connector):
    conn, mock_client = connector
    mock_client.account_information.list_user_accounts.return_value = MagicMock(
        body=[
            {
                "id": "acct-1",
                "name": "Schwab Roth IRA",
                "institution_name": "Charles Schwab",
                "balance": {"total": {"amount": 42000.50, "currency": "USD"}},
            }
        ]
    )
    accounts = conn.get_accounts(snaptrade_user_id="snap-uid", user_secret="secret")
    assert len(accounts) == 1
    assert accounts[0]["id"] == "acct-1"
    assert accounts[0]["name"] == "Schwab Roth IRA"
    assert accounts[0]["institution"] == "Charles Schwab"
    assert accounts[0]["balance"] == 42000.50
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
docker compose exec backend pytest tests/test_snaptrade_connector.py -v
```

Expected: `ModuleNotFoundError` or `ImportError` — connector doesn't exist yet.

- [ ] **Step 4: Create the package marker**

Create `backend/app/snaptrade/__init__.py` (empty file):
```python
```

- [ ] **Step 5: Write the connector**

Create `backend/app/snaptrade/connector.py`:

```python
"""SnapTrade SDK wrapper — register users, get connect URLs, fetch account balances."""
import logging
from typing import Optional

from snaptrade_client import SnapTrade

logger = logging.getLogger(__name__)


class SnapTradeConnector:
    def __init__(self, client_id: str, consumer_key: str) -> None:
        self._client = SnapTrade(consumer_key=consumer_key, client_id=client_id)

    def register_user(self, local_user_id: str) -> tuple[str, str]:
        """Register a new SnapTrade user. Returns (snaptrade_user_id, user_secret)."""
        resp = self._client.authentication.register_snap_trade_user(
            body={"userId": local_user_id}
        )
        return resp.body["userId"], resp.body["userSecret"]

    def get_connect_url(
        self,
        snaptrade_user_id: str,
        user_secret: str,
        redirect_uri: str,
    ) -> str:
        """Return the SnapTrade OAuth URL to redirect the user to."""
        resp = self._client.authentication.login_snap_trade_user(
            query_params={
                "userId": snaptrade_user_id,
                "userSecret": user_secret,
                "redirectURI": redirect_uri,
            }
        )
        # SDK returns the URL string directly in .body
        return resp.body if isinstance(resp.body, str) else resp.body.get("redirectURI", str(resp.body))

    def get_accounts(self, snaptrade_user_id: str, user_secret: str) -> list[dict]:
        """Return normalized account dicts: {id, name, institution, balance}."""
        resp = self._client.account_information.list_user_accounts(
            user_id=snaptrade_user_id,
            user_secret=user_secret,
        )
        accounts = []
        for acct in resp.body:
            # Balance may be nested: {"total": {"amount": 123.45, "currency": "USD"}}
            # or a flat float depending on SDK version
            balance_raw = acct.get("balance", {})
            if isinstance(balance_raw, dict):
                total = balance_raw.get("total", {})
                balance = float(total.get("amount", 0)) if isinstance(total, dict) else float(total or 0)
            else:
                balance = float(balance_raw or 0)

            accounts.append({
                "id": acct["id"],
                "name": acct.get("name", "Investment Account"),
                "institution": acct.get("institution_name", "Unknown"),
                "balance": balance,
            })
        return accounts

    def delete_user(self, snaptrade_user_id: str) -> None:
        """Remove a SnapTrade user (cleanup on disconnect)."""
        try:
            self._client.authentication.delete_snap_trade_user(
                query_params={"userId": snaptrade_user_id}
            )
        except Exception as exc:
            logger.warning("SnapTrade delete_user failed (non-fatal): %s", exc)


def get_connector() -> Optional[SnapTradeConnector]:
    """Return a configured connector, or None if credentials are not set."""
    from app.config import settings
    if not settings.snaptrade_client_id or not settings.snaptrade_consumer_key:
        return None
    return SnapTradeConnector(
        client_id=settings.snaptrade_client_id,
        consumer_key=settings.snaptrade_consumer_key,
    )
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
docker compose exec backend pytest tests/test_snaptrade_connector.py -v
```

Expected: `3 passed`

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/app/snaptrade/ backend/tests/test_snaptrade_connector.py
git commit -m "feat: add SnapTrade connector wrapper"
```

---

### Task 3: API endpoints

**Files:**
- Create: `backend/app/api/snaptrade.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the API router**

Create `backend/app/api/snaptrade.py`:

```python
"""SnapTrade API — connect flow and callback handling."""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.account import Account
from app.models.user import User
from app.snaptrade.connector import get_connector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/snaptrade", tags=["snaptrade"])


async def _get_user(db: AsyncSession) -> User:
    """Load the single active user (single-user self-hosted setup)."""
    result = await db.execute(select(User).where(User.is_active == True).limit(1))  # noqa: E712
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=500, detail="No active user found")
    return user


class ConnectResponse(BaseModel):
    redirect_url: str


class CallbackResponse(BaseModel):
    accounts_added: int


@router.post("/connect", response_model=ConnectResponse)
async def snaptrade_connect(db: AsyncSession = Depends(get_db)) -> ConnectResponse:
    """
    Register this user with SnapTrade (if needed) and return an OAuth redirect URL.
    The frontend redirects the browser to this URL so the user can connect their brokerage.
    """
    connector = get_connector()
    if connector is None:
        raise HTTPException(status_code=503, detail="SnapTrade not configured")

    from app.config import settings
    user = await _get_user(db)

    # Register with SnapTrade if first time
    if not user.snaptrade_user_id:
        snap_uid, snap_secret = connector.register_user(str(user.id))
        user.snaptrade_user_id = snap_uid
        user.snaptrade_user_secret = snap_secret  # EncryptedString handles encryption
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("Registered SnapTrade user: %s", snap_uid)

    redirect_uri = f"{settings.app_base_url}/connect"
    url = connector.get_connect_url(
        snaptrade_user_id=user.snaptrade_user_id,
        user_secret=user.snaptrade_user_secret,
        redirect_uri=redirect_uri,
    )
    return ConnectResponse(redirect_url=url)


@router.get("/callback", response_model=CallbackResponse)
async def snaptrade_callback(db: AsyncSession = Depends(get_db)) -> CallbackResponse:
    """
    Called by the frontend after SnapTrade redirects back with ?snaptrade_connected=1.
    Fetches all accounts from SnapTrade and upserts them into the accounts table.
    """
    connector = get_connector()
    if connector is None:
        raise HTTPException(status_code=503, detail="SnapTrade not configured")

    user = await _get_user(db)
    if not user.snaptrade_user_id:
        raise HTTPException(status_code=400, detail="SnapTrade not connected for this user")

    snaptrade_accounts = connector.get_accounts(
        snaptrade_user_id=user.snaptrade_user_id,
        user_secret=user.snaptrade_user_secret,
    )

    added = 0
    for acct in snaptrade_accounts:
        # Upsert: find existing or create new
        result = await db.execute(
            select(Account).where(Account.snaptrade_account_id == acct["id"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.current_balance = acct["balance"]
            existing.last_synced = datetime.now(timezone.utc)
            db.add(existing)
        else:
            new_acct = Account(
                snaptrade_account_id=acct["id"],
                name=acct["name"],
                official_name=acct["name"],
                institution=acct["institution"],
                type="investment",
                subtype="brokerage",
                current_balance=acct["balance"],
                available_balance=acct["balance"],
                currency="USD",
                is_manual=False,
                is_active=True,
                last_synced=datetime.now(timezone.utc),
            )
            db.add(new_acct)
            added += 1

    await db.commit()
    logger.info("snaptrade_callback: added=%d total=%d", added, len(snaptrade_accounts))
    return CallbackResponse(accounts_added=added)
```

- [ ] **Step 2: Register the router in main.py**

Open `backend/app/main.py`. Add the import with the others:
```python
from app.api.snaptrade import router as snaptrade_router
```

Add the router registration after the other `app.include_router` calls:
```python
app.include_router(snaptrade_router)
```

- [ ] **Step 3: Verify the app starts**

```bash
docker compose build backend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d backend
docker compose logs backend --tail=20
```

Expected: no import errors, `Application startup complete` in logs.

Check the new endpoints exist:
```bash
curl -s http://localhost:8000/openapi.json | python3 -c "import sys,json; paths=json.load(sys.stdin)['paths']; print([p for p in paths if 'snaptrade' in p])"
```

Expected: `['/api/snaptrade/connect', '/api/snaptrade/callback']`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/snaptrade.py backend/app/main.py
git commit -m "feat: add SnapTrade connect and callback API endpoints"
```

---

### Task 4: Celery sync task

**Files:**
- Create: `backend/app/tasks/snaptrade_sync.py`
- Modify: `backend/app/celery_app.py`

- [ ] **Step 1: Create the sync task**

Create `backend/app/tasks/snaptrade_sync.py`:

```python
"""Celery task: sync SnapTrade investment account balances daily."""
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.celery_app import app
from app.db import get_sync_db
from app.models.account import Account
from app.models.user import User
from app.snaptrade.connector import get_connector

logger = logging.getLogger(__name__)


@app.task(
    name="app.tasks.snaptrade_sync.sync_snaptrade_balances",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def sync_snaptrade_balances(self) -> dict:
    """
    Fetch current balances for all SnapTrade-connected accounts.
    Runs daily after Plaid sync. Skips gracefully if SnapTrade is not configured.
    """
    connector = get_connector()
    if connector is None:
        logger.info("sync_snaptrade_balances: SnapTrade not configured, skipping")
        return {"updated": 0, "skipped": "not configured"}

    db = get_sync_db()
    try:
        # Load all users with SnapTrade credentials
        users = db.execute(
            select(User).where(
                User.snaptrade_user_id.isnot(None),
                User.is_active == True,  # noqa: E712
            )
        ).scalars().all()

        total_updated = 0
        for user in users:
            try:
                snaptrade_accounts = connector.get_accounts(
                    snaptrade_user_id=user.snaptrade_user_id,
                    user_secret=user.snaptrade_user_secret,
                )
            except Exception as exc:
                logger.error("SnapTrade fetch failed for user %s: %s", user.id, exc)
                continue

            for acct_data in snaptrade_accounts:
                acct = db.execute(
                    select(Account).where(
                        Account.snaptrade_account_id == acct_data["id"]
                    )
                ).scalar_one_or_none()

                if acct:
                    acct.current_balance = acct_data["balance"]
                    acct.available_balance = acct_data["balance"]
                    acct.last_synced = datetime.now(timezone.utc)
                    db.add(acct)
                    total_updated += 1

        db.commit()
        logger.info("sync_snaptrade_balances: updated=%d", total_updated)
        return {"updated": total_updated}

    except Exception as exc:
        logger.error("sync_snaptrade_balances failed: %s", exc)
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()
```

- [ ] **Step 2: Register task + beat schedule in celery_app.py**

Open `backend/app/celery_app.py`.

Add `"app.tasks.snaptrade_sync"` to the `include` list:
```python
app = Celery(
    "hive",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.ingestion",
        "app.tasks.points",
        "app.tasks.ml_tasks",
        "app.tasks.maintenance",
        "app.tasks.intelligence",
        "app.tasks.snaptrade_sync",
    ],
)
```

Add the beat schedule entry after `"daily-sync"`:
```python
    "daily-snaptrade-sync": {
        "task": "app.tasks.snaptrade_sync.sync_snaptrade_balances",
        "schedule": crontab(hour=6, minute=45),
        "options": {"queue": "default"},
    },
```

- [ ] **Step 3: Rebuild worker and verify task is registered**

```bash
docker compose build backend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d backend celery_worker celery_beat
docker compose logs celery_worker --tail=20
```

Expected: no import errors. Verify task is registered:
```bash
docker compose exec celery_worker celery -A app.celery_app inspect registered
```

Expected output includes: `app.tasks.snaptrade_sync.sync_snaptrade_balances`

- [ ] **Step 4: Commit**

```bash
git add backend/app/tasks/snaptrade_sync.py backend/app/celery_app.py
git commit -m "feat: add daily SnapTrade balance sync Celery task"
```

---

### Task 5: Frontend — API client + connect page

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/connect/page.tsx`

- [ ] **Step 1: Add snaptrade methods to API client**

Open `frontend/src/lib/api.ts`. Find the `api` object. Add a `snaptrade` namespace alongside the existing ones:

```typescript
snaptrade: {
  connect: () => post<{ redirect_url: string }>("/api/snaptrade/connect", {}),
  callback: () => get<{ accounts_added: number }>("/api/snaptrade/callback"),
},
```

(Use the same `post` and `get` helper functions already present in that file.)

- [ ] **Step 2: Add Connect Brokerage section to connect page**

Open `frontend/src/app/connect/page.tsx`.

Add this state near the other state declarations:
```tsx
const [snaptradeLoading, setSnaptradeLoading] = useState(false);
const [snaptradeMessage, setSnaptradeMessage] = useState<string>("");
```

Add this handler function inside the component, before the return:
```tsx
async function handleSnaptradeConnect() {
  setSnaptradeLoading(true);
  setSnaptradeMessage("");
  try {
    const data = await api.snaptrade.connect();
    window.location.href = data.redirect_url;
  } catch (e) {
    setSnaptradeMessage("Failed to connect to SnapTrade. Check server configuration.");
    setSnaptradeLoading(false);
  }
}
```

Add this effect to detect the OAuth return (add alongside the other `useEffect` calls):
```tsx
useEffect(() => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("snaptrade_connected") !== "1") return;
  // Clear the query param
  window.history.replaceState({}, "", "/connect");
  api.snaptrade.callback()
    .then((data) => {
      setSnaptradeMessage(`Connected ${data.accounts_added} investment account(s). Balances will sync shortly.`);
      // Refresh the accounts list so the new account appears
      fetchLinked();
    })
    .catch(() => {
      setSnaptradeMessage("SnapTrade connection completed but failed to fetch accounts. Try refreshing.");
    });
}, [fetchLinked]);
```

Add the UI section. Find the closing section of the page (before the final `</div>`) and insert a new card for SnapTrade:

```tsx
{/* ── SnapTrade / Brokerage ───────────────────────────────────────────── */}
<div className="hive-card p-5 space-y-4">
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-lg bg-sky-400/10 flex items-center justify-center">
      <TrendingUp className="w-4 h-4 text-sky-400" />
    </div>
    <div>
      <p className="text-[14px] font-semibold text-ink-primary">Investment Accounts</p>
      <p className="text-[12px] text-ink-tertiary">Connect brokerage &amp; retirement accounts via SnapTrade</p>
    </div>
  </div>

  {snaptradeMessage && (
    <p className="text-[12px] text-semantic-income">{snaptradeMessage}</p>
  )}

  <button
    onClick={handleSnaptradeConnect}
    disabled={snaptradeLoading}
    className="hive-btn-secondary w-full"
  >
    {snaptradeLoading ? "Redirecting…" : "Connect Brokerage"}
  </button>

  <p className="text-[11px] text-ink-tertiary/50">
    Supports Schwab, Fidelity, Vanguard, TD Ameritrade, and 10,000+ other institutions.
    You'll be redirected to SnapTrade to authenticate securely.
  </p>
</div>
```

Add `TrendingUp` to the lucide-react import at the top of the file.

- [ ] **Step 3: Rebuild frontend and verify**

```bash
docker compose build frontend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d frontend
```

Navigate to `/connect` in the browser. Verify:
- "Investment Accounts" section appears below the Plaid section
- "Connect Brokerage" button is visible and styled correctly
- No TypeScript errors in the browser console

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/app/connect/page.tsx
git commit -m "feat: add Connect Brokerage section to connect page (SnapTrade OAuth flow)"
```

---

### Task 6: Dashboard rename + final wiring

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Rename "Bank Accounts" label to "Accounts"**

Open `frontend/src/app/page.tsx`. Find the text `"Bank Accounts"` in the accounts card section and replace it with `"Accounts"`. This label appears as a section header above the bank accounts grid. Investment accounts (type="investment") will now fall into this group naturally since the split logic sends non-credit accounts there.

The label element looks like:
```tsx
<span className="text-[10px] font-semibold tracking-[0.10em] uppercase text-ink-tertiary">Bank Accounts</span>
```

Change to:
```tsx
<span className="text-[10px] font-semibold tracking-[0.10em] uppercase text-ink-tertiary">Accounts</span>
```

- [ ] **Step 2: Verify dashboard shows SnapTrade accounts (after connecting)**

If SnapTrade credentials are configured and an account has been connected:
- `GET /api/accounts` should return the SnapTrade account alongside Plaid accounts
- The dashboard "Accounts" section should show the investment account with its balance
- No special UI changes needed — it uses `a.official_name ?? a.name` already

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "fix: rename 'Bank Accounts' to 'Accounts' to include investment accounts"
```

---

## Pre-flight Checklist

Before testing end-to-end:

- [ ] Create SnapTrade account at `dashboard.snaptrade.com` → get `CLIENT_ID` and `CONSUMER_KEY`
- [ ] Add to `.env`:
  ```
  SNAPTRADE_CLIENT_ID=your-client-id
  SNAPTRADE_CONSUMER_KEY=your-consumer-key
  APP_BASE_URL=http://nuc.tailnet-xyz.ts.net  (your actual NUC address)
  ```
- [ ] Check `APP_BASE_URL` is in `backend/app/config.py` as a settings field. If not, add:
  ```python
  app_base_url: str = "http://localhost:3000"
  ```
- [ ] Rebuild: `docker compose build backend frontend`
- [ ] Run migration: `docker compose exec backend alembic upgrade head`
- [ ] Restart: `docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d`
