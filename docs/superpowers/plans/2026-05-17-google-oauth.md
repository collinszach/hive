# Google OAuth Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Sign in with Google" as an alternative login method alongside existing username/password, tying account access to a Google identity the user can never lose.

**Architecture:** Two new backend endpoints handle the OAuth Authorization Code flow (`/api/auth/google` redirects to Google, `/api/auth/google/callback` exchanges the code and issues the existing httpOnly JWT cookie). No new frontend pages — the callback redirects straight to `/dashboard`. `httpx` (already in requirements) handles the token exchange HTTP calls.

**Tech Stack:** FastAPI, httpx, SQLAlchemy async, Next.js 14, Google OAuth 2.0

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `backend/alembic/versions/s7t8u9v0w1x2_add_google_oauth_to_users.py` | DB migration: add `google_id` + `email` to `users` |
| Modify | `backend/app/config.py` | Add `google_client_id`, `google_client_secret`, `google_redirect_uri` |
| Create | `backend/app/api/auth_google.py` | Google OAuth endpoints + find-or-create logic |
| Modify | `backend/app/main.py` | Include `auth_google` router; add Google paths to public routes |
| Create | `backend/tests/test_google_auth.py` | Unit tests for find-or-create logic |
| Modify | `backend/requirements.txt` | No new deps needed (httpx already present) |
| Modify | `frontend/src/app/(marketing)/login/page.tsx` | Add "Continue with Google" button |
| Modify | `frontend/src/app/(marketing)/register/page.tsx` | Add "Continue with Google" button |
| Modify | `backend/.env.example` | Document the three new env vars |

---

## Task 1: DB Migration — add `google_id` and `email` to `users`

**Files:**
- Create: `backend/alembic/versions/s7t8u9v0w1x2_add_google_oauth_to_users.py`

- [ ] **Step 1: Create the migration file**

```python
# backend/alembic/versions/s7t8u9v0w1x2_add_google_oauth_to_users.py
"""add google_id and email to users

Revision ID: s7t8u9v0w1x2
Revises: r6s7t8u9v0w1
Branch Labels: None
Depends On: None
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = "s7t8u9v0w1x2"
down_revision = "r6s7t8u9v0w1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_id", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("email", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_users_google_id", "users", ["google_id"])


def downgrade() -> None:
    op.drop_constraint("uq_users_google_id", "users", type_="constraint")
    op.drop_column("users", "email")
    op.drop_column("users", "google_id")
```

- [ ] **Step 2: Apply the migration directly via SQL (image must be rebuilt to use alembic)**

```bash
source .env && psql "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost/${POSTGRES_DB}" -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD CONSTRAINT uq_users_google_id UNIQUE (google_id);
UPDATE alembic_version SET version_num = 's7t8u9v0w1x2';
"
```

Expected output:
```
ALTER TABLE
ALTER TABLE
ALTER TABLE
UPDATE 1
```

- [ ] **Step 3: Verify columns exist**

```bash
source .env && psql "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost/${POSTGRES_DB}" \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('google_id','email');"
```

Expected:
```
 column_name
-------------
 email
 google_id
(2 rows)
```

- [ ] **Step 4: Update the `User` model**

In `backend/app/models/user.py`, add two fields after the `snaptrade_user_secret` line:

```python
    snaptrade_user_secret: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    google_id: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
```

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/s7t8u9v0w1x2_add_google_oauth_to_users.py \
        backend/app/models/user.py
git commit -m "feat: add google_id and email columns to users"
```

---

## Task 2: Config — add Google OAuth settings

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 1: Add settings**

In `backend/app/config.py`, add these three fields after the `stripe_pro_price_id` line:

```python
    stripe_pro_price_id: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
```

- [ ] **Step 2: Document in `.env.example`**

Add a section to `.env.example` (after the Stripe block):

```bash
# Google OAuth (free — https://console.cloud.google.com)
# 1. Create project → APIs & Services → OAuth consent screen → External
# 2. Credentials → Create OAuth 2.0 Client ID → Web application
# 3. Add authorized redirect URI: https://<your-domain>/api/auth/google/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://hive.zacharyjcollins.com/api/auth/google/callback
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/config.py backend/.env.example
git commit -m "feat: add Google OAuth config settings"
```

---

## Task 3: Backend — Google OAuth endpoints

**Files:**
- Create: `backend/app/api/auth_google.py`
- Create: `backend/tests/test_google_auth.py`

- [ ] **Step 1: Write failing tests for the find-or-create logic**

```python
# backend/tests/test_google_auth.py
"""Unit tests for Google OAuth find-or-create account logic."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.api.auth_google import _derive_username, _find_or_create_user


class TestDeriveUsername:
    def test_extracts_local_part_of_email(self):
        assert _derive_username("zach@gmail.com", set()) == "zach"

    def test_strips_non_alphanumeric(self):
        # dots and plus signs common in email local parts
        assert _derive_username("zach.collins+test@gmail.com", set()) == "zachcollinstest"

    def test_appends_number_on_collision(self):
        assert _derive_username("zach@gmail.com", {"zach"}) == "zach2"

    def test_appends_incrementing_number(self):
        assert _derive_username("zach@gmail.com", {"zach", "zach2"}) == "zach3"

    def test_falls_back_to_user_prefix(self):
        # Edge: empty local part after stripping
        result = _derive_username("@gmail.com", set())
        assert result.startswith("user")

    def test_truncates_to_32_chars(self):
        long_email = "averylongemaillocalpart123456789@example.com"
        result = _derive_username(long_email, set())
        assert len(result) <= 32
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && python -m pytest tests/test_google_auth.py -v 2>&1 | head -20
```

Expected: `ImportError` or `ModuleNotFoundError` — `auth_google` doesn't exist yet.

- [ ] **Step 3: Create `auth_google.py`**

```python
# backend/app/api/auth_google.py
"""Google OAuth 2.0 sign-in endpoints."""
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import _create_access_token
from app.config import settings
from app.db import get_db
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth/google", tags=["auth"])

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _derive_username(email: str, taken: set[str]) -> str:
    """Derive a unique username from an email address."""
    local = email.split("@")[0] if "@" in email else ""
    base = re.sub(r"[^a-zA-Z0-9_-]", "", local)[:32]
    if not base:
        base = "user"
    candidate = base[:32]
    n = 2
    while candidate in taken:
        suffix = str(n)
        candidate = base[: 32 - len(suffix)] + suffix
        n += 1
    return candidate


async def _find_or_create_user(
    db: AsyncSession,
    google_id: str,
    email: str,
    name: str,
) -> User:
    """Find existing user by google_id or email, or create a new one."""
    # 1. Match by google_id
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()
    if user:
        return user

    # 2. Match by email — link google_id to existing account
    if email:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.google_id = google_id
            db.add(user)
            await db.commit()
            await db.refresh(user)
            return user

    # 3. Create new account
    any_user = await db.execute(select(User).limit(1))
    role = UserRole.admin if any_user.scalar_one_or_none() is None else UserRole.viewer

    taken_result = await db.execute(select(User.username))
    taken = set(taken_result.scalars().all())
    username = _derive_username(email or name or "user", taken)

    user = User(
        username=username,
        password_hash="",  # Google-only account — password login not possible
        email=email,
        google_id=google_id,
        role=role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Created new user %s via Google OAuth (role=%s)", username, role)
    return user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def google_login(request: Request) -> RedirectResponse:
    """Redirect browser to Google's OAuth consent screen."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured")

    state = secrets.token_urlsafe(32)
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
    }
    url = _GOOGLE_AUTH_URL + "?" + "&".join(f"{k}={v}" for k, v in params.items())
    response = RedirectResponse(url=url)
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
        max_age=300,  # 5 minutes — must complete OAuth flow in this window
    )
    return response


@router.get("/callback")
async def google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle Google's redirect after user grants consent."""
    # CSRF check
    state_cookie = request.cookies.get("oauth_state")
    state_param = request.query_params.get("state")
    if not state_cookie or state_cookie != state_param:
        logger.warning("OAuth state mismatch — possible CSRF attempt")
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    code = request.query_params.get("code")
    if not code:
        error = request.query_params.get("error", "unknown")
        logger.warning("Google OAuth callback error: %s", error)
        raise HTTPException(status_code=400, detail=f"Google sign-in failed: {error}")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            _GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            logger.error("Google token exchange failed: %s", token_resp.text)
            raise HTTPException(status_code=502, detail="Failed to exchange Google token")
        token_data = token_resp.json()

        # Fetch user profile
        userinfo_resp = await client.get(
            _GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch Google profile")
        profile = userinfo_resp.json()

    google_id: str = profile["sub"]
    email: str = profile.get("email", "")
    name: str = profile.get("name", "")

    user = await _find_or_create_user(db, google_id, email, name)
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    token = _create_access_token(user.username, user.role)

    response = RedirectResponse(url="/dashboard", status_code=302)
    response.set_cookie(
        key="hive_auth",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
        max_age=60 * 60 * 12,
    )
    response.delete_cookie(key="oauth_state", path="/")
    return response
```

- [ ] **Step 4: Run tests — should pass now**

```bash
cd backend && python -m pytest tests/test_google_auth.py -v
```

Expected:
```
tests/test_google_auth.py::TestDeriveUsername::test_extracts_local_part_of_email PASSED
tests/test_google_auth.py::TestDeriveUsername::test_strips_non_alphanumeric PASSED
tests/test_google_auth.py::TestDeriveUsername::test_appends_number_on_collision PASSED
tests/test_google_auth.py::TestDeriveUsername::test_appends_incrementing_number PASSED
tests/test_google_auth.py::TestDeriveUsername::test_falls_back_to_user_prefix PASSED
tests/test_google_auth.py::TestDeriveUsername::test_truncates_to_32_chars PASSED
6 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/auth_google.py backend/tests/test_google_auth.py
git commit -m "feat: add Google OAuth endpoints and find-or-create logic"
```

---

## Task 4: Wire up router and public routes in `main.py`

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add import and include router**

At the top of `main.py`, add after the `from app.api.auth import router as auth_router` line:

```python
from app.api.auth_google import router as auth_google_router
```

In the `_PUBLIC_EXACT` set, add the two Google paths:

```python
_PUBLIC_EXACT = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/setup-required",
    "/api/auth/logout",
    "/api/auth/google",           # ← add
    "/api/auth/google/callback",  # ← add
    "/api/health",
    "/api/billing/webhook",
}
```

After `app.include_router(auth_router)`, add:

```python
app.include_router(auth_google_router)
```

- [ ] **Step 2: Verify the app still imports cleanly**

```bash
cd backend && python -c "from app.main import app; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
cd backend && python -m pytest tests/ -v --tb=short 2>&1 | tail -15
```

Expected: all existing tests pass plus the 6 new Google auth tests.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register Google OAuth router and public route exceptions"
```

---

## Task 5: Frontend — Google button on login page

**Files:**
- Modify: `frontend/src/app/(marketing)/login/page.tsx`

- [ ] **Step 1: Add the Google button**

In `login/page.tsx`, inside the `step === "credentials"` form block, add the Google button **above** the username field and a divider below it. Replace the opening of the credentials form:

```tsx
{step === "credentials" ? (
  <form onSubmit={handleCredentials}>
    {/* Google sign-in */}
    <a
      href="/api/auth/google"
      className="flex items-center justify-center gap-3 w-full py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 mb-6"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1.5px solid rgba(255,255,255,0.10)",
        color: "#EEEEF0",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.09)";
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.18)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)";
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.10)";
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
      Continue with Google
    </a>

    {/* Divider */}
    <div className="flex items-center gap-3 mb-5" style={{ color: "rgba(255,255,255,0.15)" }}>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      <span className="text-[11px] tracking-wider">or</span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
    </div>

    <Field
      label="Username"
      {/* ... rest unchanged ... */}
```

- [ ] **Step 2: Verify the dev build compiles**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/(marketing)/login/page.tsx
git commit -m "feat: add Google sign-in button to login page"
```

---

## Task 6: Frontend — Google button on register page

**Files:**
- Modify: `frontend/src/app/(marketing)/register/page.tsx`

- [ ] **Step 1: Add Google button to register form**

In `register/page.tsx`, find the `<form onSubmit={handleSubmit} className="space-y-4">` line and add the Google button + divider **before** the username field. Insert this before the username `<div>`:

```tsx
{/* Google sign-in */}
<a
  href="/api/auth/google"
  className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-[14px] font-medium transition-colors"
  style={{
    background: "rgba(255,255,255,0.04)",
    border: "1.5px solid rgba(255,255,255,0.08)",
    color: "#EEEEF0",
  }}
  onMouseEnter={(e) => {
    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)";
  }}
  onMouseLeave={(e) => {
    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
  }}
>
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
  Continue with Google
</a>

{/* Divider */}
<div className="flex items-center gap-3" style={{ color: "rgba(255,255,255,0.15)" }}>
  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
  <span className="text-[11px] tracking-wider">or</span>
  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
</div>

{/* Username */}
<div>
  <label className="hive-label">Username</label>
  ...
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/(marketing)/register/page.tsx
git commit -m "feat: add Google sign-in button to register page"
```

---

## Task 7: Rebuild Docker image and deploy

**Files:** None — rebuild only

- [ ] **Step 1: Rebuild backend image**

```bash
docker compose build backend
```

Expected: `Image hive-backend Built`

- [ ] **Step 2: Rebuild frontend image**

```bash
docker compose build frontend
```

Expected: `Image hive-frontend Built`

- [ ] **Step 3: Restart services**

```bash
docker compose restart backend frontend nginx
```

If permission denied on any container, use:
```bash
docker stop <container_id> && docker compose up -d backend frontend nginx
```

- [ ] **Step 4: Verify backend is healthy**

```bash
curl -s http://127.0.0.1:8005/api/health
```

Expected: `{"status":"ok","service":"finance-api"}`

- [ ] **Step 5: Verify Google routes are public (no 401)**

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8005/api/auth/google
```

Expected: `302` (redirect to Google — not 401)

---

## Task 8: Google Cloud credential setup (one-time, manual)

These steps require a browser — Claude cannot do them.

- [ ] **Step 1:** Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or reuse an existing one)

- [ ] **Step 2:** APIs & Services → OAuth consent screen → External → fill in:
  - App name: `Hive`
  - User support email: your Gmail
  - Developer contact: your Gmail
  - Save and continue through scopes (no extra scopes needed — just default)
  - Add yourself as a test user

- [ ] **Step 3:** APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web application
  - Add authorized redirect URI: `https://hive.zacharyjcollins.com/api/auth/google/callback`

- [ ] **Step 4:** Copy Client ID and Client Secret into `.env`:

```bash
GOOGLE_CLIENT_ID=<paste here>
GOOGLE_CLIENT_SECRET=<paste here>
GOOGLE_REDIRECT_URI=https://hive.zacharyjcollins.com/api/auth/google/callback
```

- [ ] **Step 5:** Restart backend to pick up new env vars:

```bash
docker compose restart backend
```

- [ ] **Step 6:** Test end-to-end — visit `https://hive.zacharyjcollins.com/login`, click "Continue with Google", sign in with your Google account, confirm you land on `/dashboard` and are logged in as the admin user.

---

## Self-Review

**Spec coverage:**
- ✅ `google_id` + `email` columns — Task 1
- ✅ Account linking: google_id → email → create new — Task 3 (`_find_or_create_user`)
- ✅ First Google sign-in links existing account by email — Task 3
- ✅ `GET /api/auth/google` redirect with CSRF state — Task 3
- ✅ `GET /api/auth/google/callback` exchange + cookie — Task 3
- ✅ Public route exceptions for both Google paths — Task 4
- ✅ Google button on login page — Task 5
- ✅ Google button on register page — Task 6
- ✅ `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` config — Task 2
- ✅ `.env.example` documentation — Task 2
- ✅ Google-only accounts have empty `password_hash` — Task 3 (`_find_or_create_user`)
- ✅ `state` cookie CSRF protection — Task 3

**Type consistency:** `_derive_username` defined and tested in Task 3, `_find_or_create_user` defined in Task 3, `_create_access_token` imported from `app.api.auth` (already exists).

**No placeholders detected.**
