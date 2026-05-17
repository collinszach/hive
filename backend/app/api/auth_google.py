"""Google OAuth 2.0 sign-in endpoints."""
import logging
import re
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode

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
        user = result.scalars().first()
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


@router.get("")
async def google_login(request: Request) -> RedirectResponse:
    """Redirect browser to Google's OAuth consent screen."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured")

    state = secrets.token_urlsafe(32)
    params = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
    })
    url = f"{_GOOGLE_AUTH_URL}?{params}"
    response = RedirectResponse(url=url)
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
        max_age=300,
    )
    return response


@router.get("/callback")
async def google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle Google's redirect after user grants consent."""
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
