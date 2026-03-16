"""
Spending forecaster using Facebook Prophet.

Forecasts daily spending per category for the next N days based on
historical transaction data.
"""
import logging
from datetime import date, timedelta
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

_MIN_HISTORY_DAYS = 30
_LOOKBACK_DAYS = 365


def forecast_category_spending(
    db,
    category: str,
    periods: int = 30,
) -> Optional[dict]:
    """
    Forecast spending for a category using Prophet.

    Args:
        db: Synchronous SQLAlchemy session.
        category: Category name (e.g. "Food & Drink").
        periods: Number of days to forecast.

    Returns:
        dict with keys: category, projected_total, daily_forecast, history_days
        or None if insufficient data.
    """
    from sqlalchemy import select, func
    from app.models.transaction import Transaction

    cutoff = date.today() - timedelta(days=_LOOKBACK_DAYS)

    rows = db.execute(
        select(Transaction.date, func.sum(Transaction.amount))
        .where(
            Transaction.category == category,
            Transaction.date >= cutoff,
            Transaction.is_excluded == False,  # noqa: E712
            Transaction.pending == False,  # noqa: E712
            Transaction.amount > 0,
        )
        .group_by(Transaction.date)
        .order_by(Transaction.date)
    ).all()

    if not rows or len(rows) < _MIN_HISTORY_DAYS:
        logger.info(
            "forecaster: insufficient data for %s (%d days)", category, len(rows)
        )
        return None

    df = pd.DataFrame(rows, columns=["ds", "y"])
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = df["y"].astype(float)

    # Fill missing days with 0
    full_range = pd.date_range(df["ds"].min(), df["ds"].max(), freq="D")
    df = df.set_index("ds").reindex(full_range, fill_value=0.0).reset_index()
    df.columns = ["ds", "y"]

    try:
        from prophet import Prophet  # lazy import (Prophet startup is slow)

        m = Prophet(
            weekly_seasonality=True,
            yearly_seasonality=len(df) > 90,
            daily_seasonality=False,
            interval_width=0.80,
        )
        m.fit(df, iter=300)

        future = m.make_future_dataframe(periods=periods)
        forecast = m.predict(future)

        future_rows = forecast.tail(periods)
        daily: list[dict] = []
        for _, row in future_rows.iterrows():
            daily.append(
                {
                    "date": row["ds"].strftime("%Y-%m-%d"),
                    "predicted": round(max(float(row["yhat"]), 0.0), 2),
                    "lower": round(max(float(row["yhat_lower"]), 0.0), 2),
                    "upper": round(max(float(row["yhat_upper"]), 0.0), 2),
                }
            )

        projected_total = round(sum(d["predicted"] for d in daily), 2)

        return {
            "category": category,
            "projected_total": projected_total,
            "daily_forecast": daily,
            "history_days": len(rows),
            "periods": periods,
        }

    except Exception as exc:
        logger.error("forecaster: Prophet failed for %s: %s", category, exc)
        return None
