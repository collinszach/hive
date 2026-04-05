import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt

from app.api.accounts import router as accounts_router
from app.api.admin import router as admin_router
from app.api.anomalies import router as anomalies_router
from app.api.auth import router as auth_router
from app.api.budgets import router as budgets_router
from app.api.cash_flow import router as cash_flow_router
from app.api.chat import router as chat_router
from app.api.dashboard import router as dashboard_router
from app.api.forecast import router as forecast_router
from app.api.goals import router as goals_router
from app.api.insights import router as insights_router
from app.api.merchants import router as merchants_router
from app.api.net_worth import router as net_worth_router
from app.api.plan import router as plan_router
from app.api.plaid_link import router as plaid_router
from app.api.plaid_webhook import router as plaid_webhook_router
from app.api.points import router as points_router
from app.api.reports import router as reports_router
from app.api.rules import router as rules_router
from app.api.subscriptions import router as subscriptions_router
from app.api.snaptrade import router as snaptrade_router
from app.api.tax import router as tax_router
from app.api.transactions import router as transactions_router
from app.config import settings

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Hive Finance API",
    description="Self-hosted personal finance intelligence platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_PUBLIC_PREFIXES = ("/api/auth/login", "/api/auth/register", "/api/auth/setup-required", "/api/health", "/api/plaid/webhook")


@app.middleware("http")
async def require_auth(request: Request, call_next):
    """Require a valid JWT on all routes except auth and health endpoints."""
    if any(request.url.path.startswith(p) for p in _PUBLIC_PREFIXES):
        return await call_next(request)
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
    try:
        jwt.decode(auth[7:], settings.secret_key, algorithms=["HS256"])
    except JWTError:
        return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})
    return await call_next(request)


app.include_router(accounts_router)
app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(anomalies_router)
app.include_router(budgets_router)
app.include_router(cash_flow_router)
app.include_router(chat_router)
app.include_router(dashboard_router)
app.include_router(forecast_router)
app.include_router(goals_router)
app.include_router(insights_router)
app.include_router(merchants_router)
app.include_router(net_worth_router)
app.include_router(plan_router)
app.include_router(plaid_router)
app.include_router(plaid_webhook_router)
app.include_router(points_router)
app.include_router(reports_router)
app.include_router(rules_router)
app.include_router(snaptrade_router)
app.include_router(subscriptions_router)
app.include_router(tax_router)
app.include_router(transactions_router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "service": "finance-api"}
