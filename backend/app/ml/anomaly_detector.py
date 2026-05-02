"""
Anomaly detector using IsolationForest.

Runs on recent non-excluded, non-pending transactions and flags
statistical outliers. Results are written to the anomalies table.
"""
import logging
from datetime import date, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder

logger = logging.getLogger(__name__)

# Contamination: expected fraction of anomalies in the dataset
_CONTAMINATION = 0.05
# Minimum transactions needed to run detection
_MIN_TRANSACTIONS = 20
# Look-back window for anomaly detection
_LOOKBACK_DAYS = 180


def _build_reason(row: pd.Series, category_avg: dict[str, float]) -> str:
    """Generate a human-readable reason string for an anomaly."""
    amount = row["amount"]
    category = row.get("category", "Uncategorized") or "Uncategorized"
    avg = category_avg.get(category, 0.0)

    parts = []
    if avg > 0 and amount > avg * 2.5:
        parts.append(
            f"Amount ${amount:.2f} is {amount / avg:.1f}x the average "
            f"${avg:.2f} for {category}"
        )
    elif avg > 0 and amount > avg * 1.5:
        parts.append(
            f"Amount ${amount:.2f} is notably above the ${avg:.2f} "
            f"{category} average"
        )

    dow = int(row.get("day_of_week", -1))
    dow_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    if dow in (5, 6):
        parts.append(f"Unusual day of week ({dow_names[dow]})")

    if not parts:
        parts.append(
            f"Unusual spending pattern detected for ${amount:.2f} in {category}"
        )

    return "; ".join(parts)


def run_anomaly_detection(db) -> dict:
    """
    Run IsolationForest on recent transactions.

    Args:
        db: A synchronous SQLAlchemy session.

    Returns:
        dict with keys: scanned, flagged, errors
    """
    from sqlalchemy import select, text
    from app.models.transaction import Transaction
    from app.models.anomaly import Anomaly
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from datetime import datetime, timezone

    cutoff = date.today() - timedelta(days=_LOOKBACK_DAYS)

    rows = db.execute(
        select(
            Transaction.id,
            Transaction.amount,
            Transaction.category,
            Transaction.date,
            Transaction.account_id,
        )
        .where(
            Transaction.date >= cutoff,
            Transaction.is_excluded == False,  # noqa: E712
            Transaction.pending == False,  # noqa: E712
            Transaction.amount > 0,  # only charges, not credits
        )
    ).all()

    if len(rows) < _MIN_TRANSACTIONS:
        logger.info(
            "anomaly_detector: only %d transactions, need %d — skipping",
            len(rows),
            _MIN_TRANSACTIONS,
        )
        return {"scanned": len(rows), "flagged": 0, "errors": 0}

    df = pd.DataFrame(rows, columns=["id", "amount", "category", "date", "account_id"])
    df["amount"] = df["amount"].astype(float)
    df["day_of_week"] = pd.to_datetime(df["date"]).dt.dayofweek

    # Category average amount (for reason generation)
    category_avg: dict[str, float] = (
        df.groupby("category")["amount"].mean().to_dict()
    )

    # Feature: amount_vs_category_avg
    df["category_avg"] = df["category"].map(category_avg).fillna(df["amount"].mean())
    df["amount_ratio"] = df["amount"] / df["category_avg"].clip(lower=1.0)

    # Encode category as integer
    le = LabelEncoder()
    df["category_enc"] = le.fit_transform(df["category"].fillna("Uncategorized"))

    features = df[["amount", "category_enc", "day_of_week", "amount_ratio"]].values

    clf = IsolationForest(
        contamination=_CONTAMINATION,
        random_state=42,
        n_estimators=100,
    )
    clf.fit(features)
    scores = clf.score_samples(features)  # lower = more anomalous
    predictions = clf.predict(features)  # -1 = anomaly, 1 = normal

    anomalous_idx = np.where(predictions == -1)[0]
    logger.info(
        "anomaly_detector: scanned=%d flagged=%d", len(df), len(anomalous_idx)
    )

    flagged = 0
    errors = 0
    for idx in anomalous_idx:
        try:
            row = df.iloc[idx]
            reason = _build_reason(row, category_avg)
            anomaly_score = float(scores[idx])

            stmt = pg_insert(Anomaly).values(
                transaction_id=row["id"],
                anomaly_score=round(anomaly_score, 4),
                reason=reason,
                features={
                    "amount": float(row["amount"]),
                    "category": str(row.get("category", "")),
                    "day_of_week": int(row["day_of_week"]),
                    "amount_ratio": round(float(row["amount_ratio"]), 3),
                    "score": round(anomaly_score, 4),
                },
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_anomaly_transaction",
                set_={
                    "anomaly_score": stmt.excluded.anomaly_score,
                    "reason": stmt.excluded.reason,
                    "features": stmt.excluded.features,
                },
            )
            db.execute(stmt)
            flagged += 1
        except Exception as exc:
            logger.error("anomaly_detector: error on row %d: %s", idx, exc)
            errors += 1

    db.commit()
    return {"scanned": len(df), "flagged": flagged, "errors": errors}
