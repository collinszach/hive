"""AI chat endpoint — Ollama (local) by default, Claude Sonnet as opt-in."""
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.account import Account
from app.models.anomaly import Anomaly
from app.models.budget import Budget
from app.models.goal import Goal
from app.models.points_balance import PointsBalance
from app.models.points_ledger import PointsLedger
from app.models.subscription import Subscription
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[list[dict]] = None  # [{role, content}]
    use_claude: bool = False


class ChatResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    response: str
    input_tokens: int
    output_tokens: int
    model_used: str


async def _build_financial_context(db: AsyncSession) -> str:
    """Build a comprehensive financial snapshot for the AI system prompt."""
    today = date.today()
    three_months_ago = today - timedelta(days=90)
    month_start = date(today.year, today.month, 1)
    month_end = (
        date(today.year + 1, 1, 1)
        if today.month == 12
        else date(today.year, today.month + 1, 1)
    )

    # --- Existing queries ---
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

    budget_result = await db.execute(
        select(Budget).where(Budget.month == month_start)
    )
    budgets = {b.category: float(b.budget_amount) for b in budget_result.scalars().all()}

    acct_result = await db.execute(
        select(Account).where(Account.is_active == True)  # noqa: E712
    )
    accounts = acct_result.scalars().all()

    anomaly_result = await db.execute(
        select(Anomaly).where(Anomaly.status == "unreviewed").limit(5)
    )
    anomalies = anomaly_result.scalars().all()

    # --- New queries ---

    # Points portfolio: latest balance per program
    points_result = await db.execute(
        select(PointsBalance.program, func.sum(PointsBalance.balance).label("total"))
        .group_by(PointsBalance.program)
    )
    points_balances = points_result.all()

    # Subscriptions: active, non-cancelled
    subs_result = await db.execute(
        select(Subscription).where(
            Subscription.is_active == True,  # noqa: E712
            Subscription.is_cancelled == False,  # noqa: E712
        ).order_by(Subscription.amount.desc())
    )
    subscriptions = subs_result.scalars().all()

    # Goals: active, non-archived
    goals_result = await db.execute(
        select(Goal).where(
            Goal.is_archived == False,  # noqa: E712
            Goal.is_completed == False,  # noqa: E712
        ).order_by(Goal.sort_order)
    )
    goals = goals_result.scalars().all()

    # Top merchants by spend (last 90 days)
    merchant_result = await db.execute(
        select(Transaction.merchant, func.sum(Transaction.amount).label("total"))
        .where(
            and_(
                Transaction.date >= three_months_ago,
                Transaction.is_excluded == False,  # noqa: E712
                Transaction.pending == False,  # noqa: E712
                Transaction.amount > 0,
                Transaction.merchant.isnot(None),
            )
        )
        .group_by(Transaction.merchant)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(15)
    )
    top_merchants = merchant_result.all()

    # --- Build context string ---
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
            budget_str = (
                f" / ${budget:,.0f} budget ({amount/budget*100:.0f}%)" if budget else ""
            )
            lines.append(f"- {cat}: ${amount:,.2f}{budget_str}")
    lines.append(f"Total this month: ${total_this_month:,.2f}")

    lines += [
        "",
        "=== LAST 3 MONTHS — CATEGORY TOTALS ===",
    ]
    for cat, total in category_spend:
        if cat:
            lines.append(f"- {cat}: ${float(total):,.2f}")

    if top_merchants:
        lines += [
            "",
            "=== TOP 15 MERCHANTS — LAST 90 DAYS ===",
        ]
        for merchant, total in top_merchants:
            lines.append(f"- {merchant}: ${float(total):,.2f}")

    if points_balances:
        from app.points.tracker import POINT_VALUES_CPP
        lines += [
            "",
            "=== POINTS & REWARDS PORTFOLIO ===",
        ]
        total_points_value = 0.0
        for program, balance in points_balances:
            cpp = POINT_VALUES_CPP.get(program, 1.0)
            est_value = float(balance) * cpp / 100.0
            total_points_value += est_value
            lines.append(f"- {program}: {int(balance):,} pts ≈ ${est_value:,.2f}")
        lines.append(f"Total estimated points value: ${total_points_value:,.2f}")

    if subscriptions:
        total_monthly = sum(
            float(s.amount) if s.frequency == "monthly"
            else float(s.amount) / 12 if s.frequency == "annual"
            else float(s.amount) / 3 if s.frequency == "quarterly"
            else float(s.amount)
            for s in subscriptions
        )
        lines += [
            "",
            f"=== SUBSCRIPTIONS ({len(subscriptions)} active, ~${total_monthly:,.2f}/mo) ===",
        ]
        for s in subscriptions[:15]:
            freq = s.frequency or "monthly"
            lines.append(f"- {s.merchant_name}: ${float(s.amount):,.2f}/{freq}")

    if goals:
        lines += [
            "",
            "=== FINANCIAL GOALS ===",
        ]
        for g in goals:
            target = float(g.target_amount) if g.target_amount else 0.0
            current = float(g.current_amount) if g.current_amount else 0.0
            pct = (current / target * 100) if target > 0 else 0.0
            on_track = " (on track)" if g.on_track else " (behind)" if g.on_track is False else ""
            target_str = f", target: ${target:,.2f}" if target else ""
            current_str = f", current: ${current:,.2f}" if current else ""
            lines.append(
                f"- {g.name} ({g.goal_type}): {pct:.0f}% complete{target_str}{current_str}{on_track}"
            )

    if anomalies:
        lines += [
            "",
            f"=== FLAGGED ANOMALIES ({len(anomalies)} unreviewed) ===",
        ]
        for anom in anomalies:
            lines.append(f"- {anom.reason}")

    return "\n".join(lines)


def _build_system_prompt(financial_context: str) -> str:
    return (
        "You are a personal finance assistant for a self-hosted finance platform called Hive. "
        "You have access to the user's complete financial picture shown below, including: "
        "account balances, spending by category, top merchants, points/rewards portfolio, "
        "active subscriptions, financial goals, and anomalies. "
        "Answer questions accurately and helpfully. Be concise but thorough. "
        "Format dollar amounts with $ and commas. "
        "If you don't have enough data to answer, say so clearly.\n\n"
        "IMPORTANT RULES:\n"
        "- Never suggest linking accounts (they're already linked via Plaid)\n"
        "- Venmo/Zelle transfers are excluded from spending totals — they are not real expenses\n"
        "- Pending transactions are excluded from totals\n"
        "- Points values are estimates based on typical transfer partner redemptions\n\n"
        f"{financial_context}"
    )


async def _chat_with_ollama(
    system_prompt: str,
    messages: list[dict],
    model: str,
    ollama_url: str,
) -> tuple[str, int, int, str]:
    """
    Call Ollama /api/chat. Returns (text, input_tokens, output_tokens, model_used).
    Raises HTTPException(503) if Ollama is unreachable or times out.
    """
    payload = {
        "model": model,
        "stream": False,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{ollama_url}/api/chat", json=payload)
            resp.raise_for_status()
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        logger.warning("Ollama unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Local AI (Ollama) is unavailable. Try switching to Claude.")
    except httpx.HTTPStatusError as exc:
        logger.error("Ollama HTTP error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Ollama returned an error: {exc.response.status_code}")

    data = resp.json()
    text = data.get("message", {}).get("content", "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="Ollama returned an empty response.")

    input_tokens = data.get("prompt_eval_count", 0)
    output_tokens = data.get("eval_count", 0)
    return text, input_tokens, output_tokens, f"ollama/{model}"


async def _chat_with_claude(
    system_prompt: str,
    messages: list[dict],
) -> tuple[str, int, int, str]:
    """
    Call Claude Sonnet. Returns (text, input_tokens, output_tokens, model_used).
    Raises HTTPException(502) on API error.
    """
    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
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
        raise HTTPException(status_code=502, detail=f"Claude API error: {exc}")

    text = response.content[0].text if response.content else ""
    if not text:
        raise HTTPException(status_code=502, detail="Claude returned an empty response.")

    return (
        text,
        response.usage.input_tokens,
        response.usage.output_tokens,
        "claude-sonnet-4-6",
    )


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)) -> ChatResponse:
    """
    AI financial Q&A. Routes to Ollama (local) by default; Claude Sonnet when use_claude=True.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        financial_context = await _build_financial_context(db)
    except Exception as exc:
        logger.error("Failed to build financial context: %s", exc)
        financial_context = "Financial data temporarily unavailable."

    system_prompt = _build_system_prompt(financial_context)

    messages: list[dict] = []
    if body.conversation_history:
        for msg in body.conversation_history[-10:]:
            if msg.get("role") in ("user", "assistant") and msg.get("content"):
                content = str(msg["content"])[:4000]  # cap per-message length
                messages.append({"role": msg["role"], "content": content})
    messages.append({"role": "user", "content": body.message})

    if body.use_claude:
        answer, input_tokens, output_tokens, model_used = await _chat_with_claude(
            system_prompt=system_prompt,
            messages=messages,
        )
    else:
        answer, input_tokens, output_tokens, model_used = await _chat_with_ollama(
            system_prompt=system_prompt,
            messages=messages,
            model=settings.ollama_chat_model,
            ollama_url=settings.ollama_url,
        )

    return ChatResponse(
        response=answer,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        model_used=model_used,
    )
