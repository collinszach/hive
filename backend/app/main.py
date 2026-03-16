import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.accounts import router as accounts_router
from app.api.anomalies import router as anomalies_router
from app.api.budgets import router as budgets_router
from app.api.chat import router as chat_router
from app.api.dashboard import router as dashboard_router
from app.api.deps import verify_auth
from app.api.forecast import router as forecast_router
from app.api.net_worth import router as net_worth_router
from app.api.plaid_link import router as plaid_router
from app.api.plaid_webhook import router as plaid_webhook_router
from app.api.points import router as points_router
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
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routers below require the internal API token (sent by the Next.js proxy).
# Plaid webhook and /api/health are intentionally excluded — they are called by
# external systems that cannot carry the internal token.
_auth = [Depends(verify_auth)]

app.include_router(accounts_router, dependencies=_auth)
app.include_router(anomalies_router, dependencies=_auth)
app.include_router(budgets_router, dependencies=_auth)
app.include_router(chat_router, dependencies=_auth)
app.include_router(dashboard_router, dependencies=_auth)
app.include_router(forecast_router, dependencies=_auth)
app.include_router(net_worth_router, dependencies=_auth)
app.include_router(plaid_router, dependencies=_auth)
app.include_router(points_router, dependencies=_auth)
app.include_router(transactions_router, dependencies=_auth)

# Webhook is exempt — Plaid calls this directly with its own signature verification
app.include_router(plaid_webhook_router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "service": "finance-api"}
