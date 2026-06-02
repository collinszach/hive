import logging
from contextlib import asynccontextmanager

import bcrypt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import select

from app.api.accounts import router as accounts_router
from app.api.billing import router as billing_router
from app.api.admin import router as admin_router
from app.api.anomalies import router as anomalies_router
from app.api.auth import router as auth_router
from app.api.auth_google import router as auth_google_router
from app.api.budgets import router as budgets_router
from app.api.cash_flow import router as cash_flow_router
from app.api.chat import router as chat_router
from app.api.dashboard import router as dashboard_router
from app.api.forecast import router as forecast_router
from app.api.goals import router as goals_router
from app.api.iap import router as iap_router
from app.api.income import router as income_router
from app.api.insights import router as insights_router
from app.api.merchants import router as merchants_router
from app.api.net_worth import router as net_worth_router
from app.api.notifications import router as notifications_router
from app.api.plan import router as plan_router
from app.api.plaid_link import router as plaid_router
from app.api.plaid_webhook import router as plaid_webhook_router
from app.api.contacts import router as contacts_router
from app.api.points import router as points_router
from app.api.position import router as position_router
from app.api.reports import router as reports_router
from app.api.review import router as review_router
from app.api.rules import router as rules_router
from app.api.subscriptions import router as subscriptions_router
from app.api.shares import router as shares_router
from app.api.snaptrade import router as snaptrade_router
from app.api.splits import router as splits_router
from app.api.tags import router as tags_router
from app.api.transactions import router as transactions_router
from app.api.chat import limiter
from app.config import settings
from app.db import AsyncSessionLocal
from app.models.user import User, UserRole

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


async def _seed_admin() -> None:
    """Create the admin account from env vars if no users exist yet.

    This runs on every startup — safe to call repeatedly (no-op when users exist).
    Ensures the account survives DB resets, volume issues, or fresh installs.
    """
    if not settings.admin_password:
        return
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).limit(1))
        if existing.scalar_one_or_none() is not None:
            return
        password_hash = bcrypt.hashpw(
            settings.admin_password.encode(), bcrypt.gensalt()
        ).decode()
        db.add(User(
            username=settings.admin_username,
            password_hash=password_hash,
            role=UserRole.admin,
            is_active=True,
        ))
        await db.commit()
        logger.info("Seeded admin account: %s", settings.admin_username)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _seed_admin()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Hive API",
    description="Self-hosted personal finance intelligence platform",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Exact-match paths that are intentionally public (no auth required)
_PUBLIC_EXACT = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/setup-required",
    "/api/auth/logout",   # just clears a cookie — no data returned
    "/api/auth/google",
    "/api/auth/google/callback",
    "/api/auth/google/exchange",   # native handoff-token exchange (self-validates the ht token)
    "/api/auth/google/native",     # native iOS sign-in (self-validates the Google ID token)
    "/api/health",
    "/api/billing/webhook",   # Stripe webhook — no user auth
}
# Prefix-match paths (webhooks have sub-paths like /api/plaid/webhook/...)
_PUBLIC_PREFIXES = ("/api/plaid/webhook",)


@app.middleware("http")
async def require_auth(request: Request, call_next):
    """Require a valid JWT on all routes except auth and health endpoints."""
    path = request.url.path
    if path in _PUBLIC_EXACT or any(path.startswith(p) for p in _PUBLIC_PREFIXES):
        return await call_next(request)

    # Try cookie first, then Bearer header
    token = request.cookies.get("hive_auth")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]

    if not token:
        return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
    try:
        jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError:
        return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})
    return await call_next(request)


app.include_router(accounts_router)
app.include_router(billing_router)
app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(auth_google_router)
app.include_router(anomalies_router)
app.include_router(budgets_router)
app.include_router(cash_flow_router)
app.include_router(chat_router)
app.include_router(dashboard_router)
app.include_router(forecast_router)
app.include_router(goals_router)
app.include_router(iap_router)
app.include_router(income_router)
app.include_router(insights_router)
app.include_router(merchants_router)
app.include_router(net_worth_router)
app.include_router(notifications_router)
app.include_router(plan_router)
app.include_router(plaid_router)
app.include_router(plaid_webhook_router)
app.include_router(contacts_router)
app.include_router(points_router)
app.include_router(position_router)
app.include_router(reports_router)
app.include_router(review_router)
app.include_router(rules_router)
app.include_router(shares_router)
app.include_router(snaptrade_router)
app.include_router(subscriptions_router)
app.include_router(splits_router)
app.include_router(tags_router)
app.include_router(transactions_router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "service": "finance-api"}
