"""Merchant analytics API."""
import logging
from datetime import date, timedelta

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/merchants", tags=["merchants"])


@router.get("")
async def top_merchants(
    days: int = Query(default=90, ge=1, le=365),
    limit: int = Query(default=20, ge=1, le=100),
    category: str | None = None,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Top merchants by total spend over the given period."""
    cutoff = date.today() - timedelta(days=days)

    category_clause = "AND category = :category" if category else ""
    result = await session.execute(
        text("""
            SELECT
                COALESCE(merchant, raw_description) AS merchant_name,
                COUNT(*) AS transaction_count,
                SUM(amount) AS total_spent,
                AVG(amount) AS avg_amount,
                MAX(date) AS last_seen,
                category,
                subcategory
            FROM transactions
            WHERE date >= :cutoff
              AND amount > 0
              AND NOT is_excluded
              AND NOT is_transfer
              AND NOT pending
              """ + category_clause + """
            GROUP BY merchant_name, category, subcategory
            ORDER BY total_spent DESC
            LIMIT :limit
        """),
        {"cutoff": cutoff, "limit": limit, **({"category": category} if category else {})},
    )
    return [
        {
            "merchant_name": row.merchant_name,
            "transaction_count": row.transaction_count,
            "total_spent": round(float(row.total_spent or 0), 2),
            "avg_amount": round(float(row.avg_amount or 0), 2),
            "last_seen": row.last_seen.isoformat() if row.last_seen else None,
            "category": row.category,
            "subcategory": row.subcategory,
        }
        for row in result.fetchall()
    ]


@router.get("/{merchant_name}/history")
async def merchant_history(
    merchant_name: str,
    months: int = 12,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Full transaction history + monthly spend for a specific merchant."""
    cutoff = date.today() - timedelta(days=30 * months)

    txn_result = await session.execute(
        text("""
            SELECT id, date, amount, category, subcategory, raw_description, account_id
            FROM transactions
            WHERE (COALESCE(merchant, raw_description) ILIKE :merchant OR merchant ILIKE :merchant)
              AND date >= :cutoff
              AND NOT is_excluded
              AND amount > 0
            ORDER BY date DESC
            LIMIT 200
        """),
        {"merchant": f"%{merchant_name}%", "cutoff": cutoff},
    )

    monthly_result = await session.execute(
        text("""
            SELECT
                TO_CHAR(date, 'YYYY-MM') AS month,
                SUM(amount) AS total,
                COUNT(*) AS count
            FROM transactions
            WHERE (COALESCE(merchant, raw_description) ILIKE :merchant OR merchant ILIKE :merchant)
              AND date >= :cutoff
              AND NOT is_excluded
              AND amount > 0
            GROUP BY 1
            ORDER BY 1
        """),
        {"merchant": f"%{merchant_name}%", "cutoff": cutoff},
    )

    transactions = [
        {
            "id": str(row.id),
            "date": row.date.isoformat(),
            "amount": float(row.amount),
            "category": row.category,
            "subcategory": row.subcategory,
        }
        for row in txn_result.fetchall()
    ]

    monthly = [
        {"month": row.month, "total": round(float(row.total or 0), 2), "count": row.count}
        for row in monthly_result.fetchall()
    ]

    total = sum(t["amount"] for t in transactions)
    return {
        "merchant_name": merchant_name,
        "total_spent": round(total, 2),
        "transaction_count": len(transactions),
        "monthly": monthly,
        "transactions": transactions,
    }


class BulkRecategorizeRequest(BaseModel):
    category: str | None = None
    subcategory: str | None = None


@router.post("/{merchant_name}/bulk-recategorize")
async def bulk_recategorize(
    merchant_name: str,
    body: BulkRecategorizeRequest,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Update category/subcategory for ALL transactions from a merchant, then recompute points."""
    # Update all matching transactions
    result = await session.execute(
        text("""
            UPDATE transactions
            SET category = :category,
                subcategory = :subcategory,
                category_source = 'manual'
            WHERE COALESCE(merchant, raw_description) ILIKE :merchant
        """),
        {"category": body.category, "subcategory": body.subcategory, "merchant": f"%{merchant_name}%"},
    )
    await session.commit()
    updated = result.rowcount

    # Fire Celery task for points recalc
    from app.tasks.points import recalculate_points_for_merchant
    task = recalculate_points_for_merchant.delay(merchant_name, body.category, body.subcategory)

    logger.info("bulk_recategorize: merchant=%s updated=%d task_id=%s", merchant_name, updated, task.id)
    return {"merchant": merchant_name, "transactions_updated": updated, "task_id": task.id}


@router.get("/tasks/{task_id}/status")
async def get_task_status(task_id: str) -> dict:
    """Poll status of a background Celery task."""
    result = AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": result.state,          # PENDING | STARTED | SUCCESS | FAILURE
        "result": result.result if result.ready() else None,
    }
