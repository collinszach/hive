"""Forecast API — Prophet spending forecasts per category."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_sync_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


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


@router.get("/{category}", response_model=ForecastResponse)
async def get_forecast(category: str, periods: int = 30) -> ForecastResponse:
    """
    Return a Prophet spending forecast for the given category.
    Runs synchronously (Prophet is CPU-bound). Periods: 1–90.
    """
    if periods < 1 or periods > 90:
        raise HTTPException(status_code=400, detail="periods must be between 1 and 90")

    from app.ml.forecaster import forecast_category_spending

    db = get_sync_db()
    try:
        result = forecast_category_spending(db, category, periods=periods)
    finally:
        db.close()

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
