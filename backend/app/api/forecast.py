"""Forecast API — Prophet spending forecasts per category."""
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import get_sync_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/forecast", tags=["forecast"])

# Dedicated thread pool for CPU-bound Prophet fitting — keeps the async event loop unblocked
_forecast_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="prophet")


class DayForecast(BaseModel):
    date: str
    predicted: float
    lower: float
    upper: float


class ForecastResponse(BaseModel):
    category: str
    projected_total: float
    daily_forecast: list[DayForecast]
    history_days: int
    periods: int


def _run_forecast(category: str, periods: int) -> Optional[dict]:
    """Run Prophet forecast in a sync thread (CPU-bound; must not run on the event loop)."""
    from app.ml.forecaster import forecast_category_spending

    db = get_sync_db()
    try:
        return forecast_category_spending(db, category, periods=periods)
    finally:
        db.close()


@router.get("/{category}", response_model=ForecastResponse)
async def get_forecast(category: str, periods: int = 30) -> ForecastResponse:
    """
    Return a Prophet spending forecast for the given category.
    Prophet fitting is CPU-bound (~5–10s); runs in a thread pool so the event loop stays free.
    Periods: 1–90.
    """
    if periods < 1 or periods > 90:
        raise HTTPException(status_code=400, detail="periods must be between 1 and 90")

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(_forecast_executor, _run_forecast, category, periods)

    if result is None:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient historical data for category '{category}' (need at least 30 days)",
        )

    return ForecastResponse(
        category=result["category"],
        projected_total=result["projected_total"],
        daily_forecast=[DayForecast(**d) for d in result["daily_forecast"]],
        history_days=result["history_days"],
        periods=result["periods"],
    )
