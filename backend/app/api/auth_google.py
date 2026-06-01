"""Google OAuth 2.0 sign-in endpoints."""
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import JWT_ALGORITHM, _create_access_token
from app.config import settings
from app.db import get_db
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth/google", tags=["auth"])

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
_GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
_GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

# --- Native (iOS Capacitor) sign-in bridge -------------------------------------
# Google refuses OAuth inside an embedded WKWebView (`disallowed_useragent`), so
# the native app opens the consent flow in a system browser (SFSafariViewController).
# That browser has its own cookie jar, so the `hive_auth` cookie set during the
# callback never reaches the WKWebView. We bridge the gap with a short-lived,
# single-purpose handoff token: the callback redirects to a custom scheme deep
# link carrying the handoff token, the app catches it and navigates the WKWebView
# to /exchange, and /exchange (now running inside the WKWebView's cookie jar)
# mints the real session cookie. The long-lived session JWT never transits a URL.
_MOBILE_STATE_PREFIX = "m."
_MOBILE_CALLBACK_URL = "hive://auth/callback"
_HANDOFF_EXPIRE_SECONDS = 60


def _create_handoff_token(username: str, role: str) -> str:
    """Mint a 60-second single-purpose token to hand a session to the WKWebView."""
    expire = datetime.now(timezone.utc) + timedelta(seconds=_HANDOFF_EXPIRE_SECONDS)
    return jwt.encode(
        {"sub": username, "role": role, "typ": "handoff", "exp": expire},
        settings.secret_key,
        algorithm=JWT_ALGORITHM,
    )


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
    # Native (iOS) clients pass ?platform=ios so the callback returns via deep link
    # rather than setting a cookie the WKWebView can't see. We carry the marker in
    # the OAuth state itself, which round-trips through Google untouched.
    if request.query_params.get("platform") == "ios":
        state = _MOBILE_STATE_PREFIX + state
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
            # Never log token_resp.text — it contains access/refresh/id tokens.
            logger.error("Google token exchange failed (status=%s)", token_resp.status_code)
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

    # Native (iOS) flow: the system browser's cookie jar is invisible to the
    # WKWebView, so hand the session over via a short-lived deep-link token that
    # the app exchanges for the real cookie from inside the WebView.
    if (state_param or "").startswith(_MOBILE_STATE_PREFIX):
        handoff = _create_handoff_token(user.username, user.role)
        params = urlencode({"ht": handoff})
        response = RedirectResponse(url=f"{_MOBILE_CALLBACK_URL}?{params}", status_code=302)
        response.delete_cookie(key="oauth_state", path="/")
        return response

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


@router.get("/exchange")
async def google_exchange(request: Request) -> RedirectResponse:
    """Exchange a one-time handoff token for the real session cookie.

    Called by the native app navigating the WKWebView to this URL after it
    catches the `hive://auth/callback?ht=…` deep link. Because the request now
    originates from the WKWebView, the cookie set here lands in the WebView's
    own cookie jar (unlike the system-browser callback).
    """
    handoff = request.query_params.get("ht")
    if not handoff:
        raise HTTPException(status_code=400, detail="Missing handoff token")

    try:
        payload = jwt.decode(handoff, settings.secret_key, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        logger.warning("Handoff token rejected: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired handoff token") from exc

    if payload.get("typ") != "handoff":
        raise HTTPException(status_code=401, detail="Invalid handoff token")

    username = payload.get("sub")
    role = payload.get("role")
    if not username or not role:
        raise HTTPException(status_code=401, detail="Invalid handoff token")

    token = _create_access_token(username, role)

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
    return response


class NativeAuthRequest(BaseModel):
    """Body for the native iOS sign-in bridge."""

    id_token: str


class NativeAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/native", response_model=NativeAuthResponse)
async def google_native(
    payload: NativeAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> NativeAuthResponse:
    """Native (SwiftUI) Google sign-in.

    The iOS app authenticates with the GoogleSignIn SDK and posts the resulting
    Google **ID token** here. We verify it against Google, confirm the audience
    is one of our OAuth clients, then mint our own session JWT and return it as
    JSON for the app to store in the Keychain. No cookie, no redirect, and the
    token is never written to a log or URL.
    """
    if not payload.id_token:
        raise HTTPException(status_code=400, detail="Missing id_token")

    # Verify signature + expiry with Google, and read back the validated claims.
    async with httpx.AsyncClient(timeout=10.0) as client:
        # POST (form body), not GET — keeps the ID token out of request URLs/access logs.
        resp = await client.post(
            _GOOGLE_TOKENINFO_URL, data={"id_token": payload.id_token}
        )
    if resp.status_code != 200:
        logger.warning("Google ID token verification failed (status=%s)", resp.status_code)
        raise HTTPException(status_code=401, detail="Invalid Google token")
    claims = resp.json()

    # Audience must be one of our own OAuth clients (iOS or web), never another app's.
    allowed_aud = {
        a for a in (settings.google_ios_client_id, settings.google_client_id) if a
    }
    if claims.get("aud") not in allowed_aud:
        logger.warning("Google ID token audience mismatch")
        raise HTTPException(status_code=401, detail="Invalid Google token audience")

    if claims.get("iss") not in _GOOGLE_ISSUERS:
        raise HTTPException(status_code=401, detail="Invalid Google token issuer")

    google_id = claims.get("sub")
    if not google_id:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    email = claims.get("email", "")
    name = claims.get("name", "")

    user = await _find_or_create_user(db, google_id, email, name)
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    token = _create_access_token(user.username, user.role)
    return NativeAuthResponse(access_token=token)
