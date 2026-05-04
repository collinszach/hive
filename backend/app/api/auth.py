"""Authentication API — login, TOTP MFA setup/verify, session management."""
import io
import logging
from datetime import datetime, timedelta, timezone

import bcrypt
import pyotp
import qrcode
import qrcode.image.svg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12  # 12 hours


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_access_token(username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": username, "role": role, "exp": expire},
        settings.secret_key,
        algorithm=JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc


async def require_admin(request: Request) -> dict:
    """FastAPI dependency that enforces admin role."""
    token = _get_bearer_token(request)
    payload = decode_token(token)
    if payload.get("role") != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


async def _write_audit(
    db: AsyncSession,
    event: str,
    username: str | None = None,
    request: Request | None = None,
    detail: str | None = None,
) -> None:
    ip = None
    ua = None
    if request:
        ip = request.client.host if request.client else None
        ua = request.headers.get("User-Agent")
    db.add(AuditLog(event=event, username=username, ip_address=ip, user_agent=ua, detail=detail))
    await db.commit()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str
    totp_code: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    totp_required: bool = False
    username: str
    role: str


class MeResponse(BaseModel):
    username: str
    role: str
    totp_enabled: bool
    last_login_at: datetime | None


class SetupTotpResponse(BaseModel):
    secret: str
    provisioning_uri: str


class VerifyTotpRequest(BaseModel):
    totp_code: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/setup-required")
async def setup_required(db: AsyncSession = Depends(get_db)) -> dict:
    """Public — returns whether the initial account has been created yet."""
    result = await db.execute(select(User).limit(1))
    return {"setup_required": result.scalar_one_or_none() is None}


@router.post("/register", response_model=LoginResponse)
async def register(body: RegisterRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    """
    Create a new user account. First user gets admin role; subsequent users get viewer role.
    """
    # Username: 3–32 chars, letters/digits/underscore/hyphen only
    import re
    if not re.fullmatch(r"[A-Za-z0-9_\-]{3,32}", body.username):
        raise HTTPException(
            status_code=422,
            detail="Username must be 3–32 characters and contain only letters, digits, underscores, or hyphens.",
        )

    # Check for duplicate username
    existing_user = await db.execute(select(User).where(User.username == body.username))
    if existing_user.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Username already taken.")

    # Password: minimum 10 characters
    if len(body.password) < 10:
        raise HTTPException(status_code=422, detail="Password must be at least 10 characters.")

    # First user is admin, subsequent users are viewers on the free plan
    any_user = await db.execute(select(User).limit(1))
    role = UserRole.admin if any_user.scalar_one_or_none() is None else UserRole.viewer

    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user = User(username=body.username, password_hash=password_hash, role=role)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await _write_audit(db, "account_created", user.username, request)
    token = _create_access_token(user.username, user.role)
    response.set_cookie(
        key="hive_auth",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
        max_age=60 * 60 * 12,  # 12 hours — matches ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return LoginResponse(access_token="", totp_required=False, username=user.username, role=user.role)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    result = await db.execute(select(User).where(User.username == body.username, User.is_active == True))  # noqa: E712
    user = result.scalar_one_or_none()

    if not user or not bcrypt.checkpw(body.password.encode(), user.password_hash.encode()):
        await _write_audit(db, "login_failed", body.username, request, "bad credentials")
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # If TOTP is enabled, require the code
    if user.totp_enabled:
        if not body.totp_code:
            await _write_audit(db, "login_mfa_pending", user.username, request)
            # Return partial — frontend should prompt for code
            return LoginResponse(
                access_token="",
                totp_required=True,
                username=user.username,
                role=user.role,
            )
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(body.totp_code, valid_window=1):
            await _write_audit(db, "login_mfa_failed", user.username, request, "bad TOTP code")
            raise HTTPException(status_code=401, detail="Invalid MFA code")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    await _write_audit(db, "login_success", user.username, request)
    token = _create_access_token(user.username, user.role)
    response.set_cookie(
        key="hive_auth",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
        max_age=60 * 60 * 12,  # 12 hours — matches ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return LoginResponse(access_token="", totp_required=False, username=user.username, role=user.role)


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(key="hive_auth", path="/")
    return {"status": "ok"}


@router.get("/me", response_model=MeResponse)
async def get_me(request: Request, db: AsyncSession = Depends(get_db)) -> MeResponse:
    token = _get_bearer_token(request)
    payload = decode_token(token)
    result = await db.execute(select(User).where(User.username == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return MeResponse(
        username=user.username,
        role=user.role,
        totp_enabled=user.totp_enabled,
        last_login_at=user.last_login_at,
    )


@router.post("/setup-totp", response_model=SetupTotpResponse)
async def setup_totp(request: Request, db: AsyncSession = Depends(get_db)) -> SetupTotpResponse:
    """Generate a new TOTP secret for the current user. User must verify before it's activated."""
    token = _get_bearer_token(request)
    payload = decode_token(token)
    result = await db.execute(select(User).where(User.username == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    secret = pyotp.random_base32()
    user.totp_secret = secret
    # Not yet enabled — user must verify first
    await db.commit()

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.username, issuer_name="Hive Finance")
    return SetupTotpResponse(secret=secret, provisioning_uri=uri)


@router.get("/setup-totp/qr")
async def setup_totp_qr(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    """Return the TOTP provisioning QR code as an SVG image."""
    token = _get_bearer_token(request)
    payload = decode_token(token)
    result = await db.execute(select(User).where(User.username == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /setup-totp first")

    totp = pyotp.TOTP(user.totp_secret)
    uri = totp.provisioning_uri(name=user.username, issuer_name="Hive Finance")

    img = qrcode.make(uri, image_factory=qrcode.image.svg.SvgImage)
    buf = io.BytesIO()
    img.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/svg+xml")


@router.post("/verify-totp")
async def verify_and_enable_totp(
    body: VerifyTotpRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> dict:
    """Verify a TOTP code and activate MFA for the account."""
    token = _get_bearer_token(request)
    payload = decode_token(token)
    result = await db.execute(select(User).where(User.username == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /setup-totp first")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(body.totp_code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code — check your authenticator app")

    user.totp_enabled = True
    await db.commit()
    await _write_audit(db, "mfa_enabled", user.username, request)
    return {"status": "ok", "message": "MFA enabled successfully"}


@router.post("/disable-totp")
async def disable_totp(
    body: VerifyTotpRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> dict:
    """Disable MFA — requires current TOTP code to confirm."""
    token = _get_bearer_token(request)
    payload = decode_token(token)
    result = await db.execute(select(User).where(User.username == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if user.totp_enabled:
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(body.totp_code, valid_window=1):
            raise HTTPException(status_code=400, detail="Invalid code")

    user.totp_enabled = False
    user.totp_secret = None
    await db.commit()
    await _write_audit(db, "mfa_disabled", user.username, request)
    return {"status": "ok", "message": "MFA disabled"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> dict:
    token = _get_bearer_token(request)
    payload = decode_token(token)
    result = await db.execute(select(User).where(User.username == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not bcrypt.checkpw(body.current_password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.password_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await db.commit()
    await _write_audit(db, "password_changed", user.username, request)
    return {"status": "ok"}


@router.get("/audit-log")
async def get_audit_log(
    request: Request,
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return recent audit log entries (admin only)."""
    token = _get_bearer_token(request)
    payload = decode_token(token)
    if payload.get("role") != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin required")

    from sqlalchemy import desc
    result = await db.execute(
        select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "event": log.event,
            "username": log.username,
            "ip_address": log.ip_address,
            "detail": log.detail,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _get_bearer_token(request: Request) -> str:
    # Try cookie first
    token = request.cookies.get("hive_auth")
    if token:
        return token
    # Fall back to Bearer header
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")
    return auth[7:]

