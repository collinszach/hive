"""AI chat endpoint — natural language financial Q&A using Claude Sonnet 4.6."""
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.account import Account
from app.models.anomaly import Anomaly
from app.models.budget import Budget
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[list[dict]] = None  # [{role, content}]


class ChatResponse(BaseModel):
    response: str
    input_tokens: int
    output_tokens: int


async def _build_financial_context(db: AsyncSession) -> str:
    """Build a financial snapshot for the AI system prompt (last 3 months)."""
    today = date.today()
    three_months_ago = today - timedelta(days=90)

    # Spending by category (last 3 months)
    spend_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .where(
            and_(
                Transaction.date >= three_months_ago,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.amount > 0,
            )
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    )
    category_spend = spend_result.all()

    # Current month spend vs budget
    month_start = date(today.year, today.month, 1)
    month_end = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)

    current_month_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .where(
            and_(
                Transaction.date >= month_start,
                Transaction.date < month_end,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.amount > 0,
            )
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    )
    current_month_spend = current_month_result.all()

    # Budgets
    budget_result = await db.execute(
        select(Budget).where(Budget.month == date(today.year, today.month, 1))
    )
    budgets = {b.category: float(b.budget_amount) for b in budget_result.scalars().all()}

    # Account balances
    acct_result = await db.execute(
        select(Account).where(Account.is_active == True)  # noqa: E712
    )
    accounts = acct_result.scalars().all()

    # Unreviewed anomalies
    anomaly_result = await db.execute(
        select(Anomaly).where(Anomaly.status == "unreviewed").limit(5)
    )
    anomalies = anomaly_result.scalars().all()

    # Build context string
    lines = [
        f"Today's date: {today.isoformat()}",
        "",
        "=== ACCOUNT BALANCES ===",
    ]
    for a in accounts:
        balance = f"${float(a.current_balance):,.2f}" if a.current_balance is not None else "N/A"
        lines.append(f"- {a.name} ({a.type}): {balance}")

    lines += [
        "",
        f"=== CURRENT MONTH SPENDING ({today.strftime('%B %Y')}) ===",
    ]
    total_this_month = 0.0
    for cat, total in current_month_spend:
        if cat:
            amount = float(total)
            total_this_month += amount
            budget = budgets.get(cat)
            budget_str = f" / ${budget:,.0f} budget ({amount/budget*100:.0f}%)" if budget else ""
            lines.append(f"- {cat}: ${amount:,.2f}{budget_str}")
    lines.append(f"Total this month: ${total_this_month:,.2f}")

    lines += [
        "",
        "=== LAST 3 MONTHS — CATEGORY TOTALS ===",
    ]
    for cat, total in category_spend:
        if cat:
            lines.append(f"- {cat}: ${float(total):,.2f}")

    if anomalies:
        lines += [
            "",
            f"=== FLAGGED ANOMALIES ({len(anomalies)} unreviewed) ===",
        ]
        for anom in anomalies:
            lines.append(f"- {anom.reason}")

    return "\n".join(lines)


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)) -> ChatResponse:
    """
    AI financial Q&A using Claude Sonnet 4.6 with prompt caching.
    Financial context is injected into the system prompt.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        financial_context = await _build_financial_context(db)
    except Exception as exc:
        logger.error("Failed to build financial context: %s", exc)
        financial_context = "Financial data temporarily unavailable."

    system_prompt = (
        "You are a personal finance assistant for a self-hosted finance platform called Hive. "
        "You have access to the user's real financial data shown below. Answer questions "
        "accurately and helpfully. Be concise. Format dollar amounts with $ and commas. "
        "If you don't have enough data to answer a question, say so clearly.\n\n"
        "IMPORTANT RULES:\n"
        "- Never suggest linking accounts (they're already linked via Plaid)\n"
        "- Venmo/Zelle transfers are excluded from spending totals — they are not real expenses\n"
        "- Pending transactions are excluded from totals\n\n"
        f"{financial_context}"
    )

    # Build messages for Claude
    messages = []
    if body.conversation_history:
        for msg in body.conversation_history[-10:]:
            if msg.get("role") in ("user", "assistant") and msg.get("content"):
                messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": body.message})

    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=messages,
        )
    except anthropic.APIError as exc:
        logger.error("Claude chat request failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")

    answer = response.content[0].text if response.content else ""
    if not answer:
        raise HTTPException(status_code=502, detail="AI returned an empty response.")

    return ChatResponse(
        response=answer,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
    )
