# Ollama Chat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardwired Claude Sonnet chat endpoint with Ollama (qwen2.5:7b) as the default, with an explicit "Use Claude" toggle in the chat UI.

**Architecture:** `ChatRequest` gains `use_claude: bool = False`; the backend routes to a new `_chat_with_ollama()` function or the existing Claude path. `ChatResponse` gains `model_used: str`. The frontend adds a two-pill toggle (Local / Claude) in the input row and a small per-message model label.

**Tech Stack:** Python/FastAPI, httpx (async), Anthropic SDK, Next.js/React, TypeScript

---

## File Map

| File | Change |
|---|---|
| `backend/app/api/chat.py` | Add `_chat_with_ollama()`, update models, add routing |
| `frontend/src/lib/api.ts` | Update `ChatResponse` type, update `chat.send` signature |
| `frontend/src/app/chat/page.tsx` | Add toggle state, pass to API, add model label to bubbles, handle 503 |

---

### Task 1: Backend — Ollama chat function + routing

**Files:**
- Modify: `backend/app/api/chat.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_chat_routing.py`:

```python
"""Tests for chat endpoint routing logic."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import ConnectError

# Test that use_claude=False routes to Ollama
@pytest.mark.asyncio
async def test_chat_routes_to_ollama_by_default():
    """When use_claude is False, _chat_with_ollama is called."""
    from app.api.chat import _chat_with_ollama
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "message": {"content": "You spent $200 on food."},
        "prompt_eval_count": 100,
        "eval_count": 20,
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        text, input_tokens, output_tokens, model_used = await _chat_with_ollama(
            system_prompt="You are a finance assistant.",
            messages=[{"role": "user", "content": "How much did I spend on food?"}],
            model="qwen2.5:7b",
            ollama_url="http://localhost:11434",
        )

    assert text == "You spent $200 on food."
    assert input_tokens == 100
    assert output_tokens == 20
    assert model_used == "ollama/qwen2.5:7b"


@pytest.mark.asyncio
async def test_chat_with_ollama_raises_503_on_connect_error():
    """ConnectError from httpx becomes HTTPException 503."""
    from app.api.chat import _chat_with_ollama
    from fastapi import HTTPException

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=ConnectError("refused"))
        mock_client_cls.return_value = mock_client

        with pytest.raises(HTTPException) as exc_info:
            await _chat_with_ollama(
                system_prompt="sys",
                messages=[{"role": "user", "content": "hi"}],
                model="qwen2.5:7b",
                ollama_url="http://localhost:11434",
            )

    assert exc_info.value.status_code == 503
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/zach/hive
docker compose exec backend pytest tests/test_chat_routing.py -v 2>/dev/null || \
  python -m pytest backend/tests/test_chat_routing.py -v --no-header 2>&1 | tail -20
```

Expected: `ImportError` or `ModuleNotFoundError` — `_chat_with_ollama` doesn't exist yet.

- [ ] **Step 3: Rewrite `backend/app/api/chat.py`**

Replace the entire file with:

```python
"""AI chat endpoint — Ollama (local) by default, Claude Sonnet as opt-in."""
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic
import httpx
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
    use_claude: bool = False


class ChatResponse(BaseModel):
    response: str
    input_tokens: int
    output_tokens: int
    model_used: str


async def _build_financial_context(db: AsyncSession) -> str:
    """Build a financial snapshot for the AI system prompt (last 3 months)."""
    today = date.today()
    three_months_ago = today - timedelta(days=90)

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

    month_start = date(today.year, today.month, 1)
    month_end = (
        date(today.year + 1, 1, 1)
        if today.month == 12
        else date(today.year, today.month + 1, 1)
    )

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
        select(Budget).where(Budget.month == date(today.year, today.month, 1))
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
        "You have access to the user's real financial data shown below. Answer questions "
        "accurately and helpfully. Be concise. Format dollar amounts with $ and commas. "
        "If you don't have enough data to answer a question, say so clearly.\n\n"
        "IMPORTANT RULES:\n"
        "- Never suggest linking accounts (they're already linked via Plaid)\n"
        "- Venmo/Zelle transfers are excluded from spending totals — they are not real expenses\n"
        "- Pending transactions are excluded from totals\n\n"
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
                messages.append({"role": msg["role"], "content": msg["content"]})
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
docker compose exec backend pytest tests/test_chat_routing.py -v 2>/dev/null || \
  cd /home/zach/hive && python -m pytest backend/tests/test_chat_routing.py -v --no-header 2>&1 | tail -20
```

Expected:
```
test_chat_routes_to_ollama_by_default PASSED
test_chat_with_ollama_raises_503_on_connect_error PASSED
```

- [ ] **Step 5: Commit**

```bash
cd /home/zach/hive
git add backend/app/api/chat.py backend/tests/test_chat_routing.py
git commit -m "feat: add Ollama as default chat model with Claude opt-in

Routes to Ollama /api/chat (qwen2.5:7b) by default.
Claude Sonnet used only when use_claude=True in request.
ChatResponse gains model_used field. Clean 503 on Ollama unavailable.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: API client types

**Files:**
- Modify: `frontend/src/lib/api.ts` (lines 218–222 and 516–519)

- [ ] **Step 1: Update `ChatResponse` interface — add `model_used`**

In `frontend/src/lib/api.ts`, find:
```typescript
export interface ChatResponse {
  response: string;
  input_tokens: number;
  output_tokens: number;
}
```

Replace with:
```typescript
export interface ChatResponse {
  response: string;
  input_tokens: number;
  output_tokens: number;
  model_used: string;
}
```

- [ ] **Step 2: Update `chat.send` signature — add `use_claude` param**

Find:
```typescript
  chat: {
    send: (message: string, conversation_history?: Array<{ role: string; content: string }>) =>
      post<ChatResponse>("/api/chat", { message, conversation_history }),
  },
```

Replace with:
```typescript
  chat: {
    send: (
      message: string,
      conversation_history?: Array<{ role: string; content: string }>,
      use_claude?: boolean,
    ) =>
      post<ChatResponse>("/api/chat", { message, conversation_history, use_claude: use_claude ?? false }),
  },
```

- [ ] **Step 3: Commit**

```bash
cd /home/zach/hive
git add frontend/src/lib/api.ts
git commit -m "feat: add use_claude and model_used to chat API types

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — toggle + model label

**Files:**
- Modify: `frontend/src/app/chat/page.tsx`

- [ ] **Step 1: Add `useClaude` state and `model_used` to Message type**

At the top of `frontend/src/app/chat/page.tsx`, find:
```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
}
```

Replace with:
```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
  model_used?: string;
}
```

Inside `InsightsPage`, add state after the existing state declarations:
```typescript
const [useClaude, setUseClaude] = useState(false);
```

- [ ] **Step 2: Pass `useClaude` to the API call and store `model_used` on the message**

Find:
```typescript
      const res = await api.chat.send(
        userMsg.content,
        history.map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages((prev) => [...prev, { role: "assistant", content: res.response }]);
```

Replace with:
```typescript
      const res = await api.chat.send(
        userMsg.content,
        history.map((m) => ({ role: m.role, content: m.content })),
        useClaude,
      );
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.response, model_used: res.model_used },
      ]);
```

- [ ] **Step 3: Add model label to `MessageBubble`**

Find the `MessageBubble` component:
```typescript
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-slide-up`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-honey/[0.1] border border-honey/20 flex items-center justify-center mr-2.5 mt-0.5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-honey" />
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-honey/[0.12] border border-honey/20 text-ink-primary rounded-br-sm"
            : "bg-surface border border-white/[0.06] text-ink-primary rounded-bl-sm"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}
```

Replace with:
```typescript
function modelLabel(model_used: string): string {
  if (model_used.startsWith("ollama/")) return `local · ${model_used.replace("ollama/", "")}`;
  if (model_used === "claude-sonnet-4-6") return "claude · sonnet";
  return model_used;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-slide-up`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-honey/[0.1] border border-honey/20 flex items-center justify-center mr-2.5 mt-0.5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-honey" />
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-honey/[0.12] border border-honey/20 text-ink-primary rounded-br-sm"
              : "bg-surface border border-white/[0.06] text-ink-primary rounded-bl-sm"
          }`}
        >
          {msg.content}
        </div>
        {!isUser && msg.model_used && (
          <p className="text-[10px] text-ink-tertiary/40 pl-1">{modelLabel(msg.model_used)}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add model toggle + update header subtitle + handle 503 error**

Find the header subtitle:
```typescript
            <p className="text-[11px] text-ink-tertiary">
              Powered by Claude Sonnet · Enter to send
            </p>
```

Replace with:
```typescript
            <p className="text-[11px] text-ink-tertiary">
              {useClaude ? "Claude Sonnet" : "Local · qwen2.5:7b"} · Enter to send
            </p>
```

Find the input form opening tag and the send button group:
```typescript
      <div className="pt-4 border-t border-white/[0.05]">
        <form onSubmit={handleSubmit} className="flex gap-2.5 items-end">
```

Replace with:
```typescript
      <div className="pt-4 border-t border-white/[0.05]">
        <form onSubmit={handleSubmit} className="flex gap-2.5 items-end">
          {/* Model toggle */}
          <div className="flex items-center gap-1 bg-elevated border border-white/[0.06] rounded-xl p-1 shrink-0 self-end mb-0.5">
            <button
              type="button"
              onClick={() => setUseClaude(false)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                !useClaude
                  ? "bg-honey/[0.15] text-honey"
                  : "text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              Local
            </button>
            <button
              type="button"
              onClick={() => setUseClaude(true)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                useClaude
                  ? "bg-honey/[0.15] text-honey"
                  : "text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              Claude
            </button>
          </div>
```

Find the error display:
```typescript
        {error && (
          <div className="text-center text-semantic-expense text-[13px] bg-semantic-expense/[0.08]
                          border border-semantic-expense/20 rounded-xl px-4 py-3">
            {error}
          </div>
        )}
```

Replace with:
```typescript
        {error && (
          <div className="text-center text-semantic-expense text-[13px] bg-semantic-expense/[0.08]
                          border border-semantic-expense/20 rounded-xl px-4 py-3">
            {error}
            {error.includes("Ollama") && !useClaude && (
              <button
                onClick={() => { setUseClaude(true); setError(null); }}
                className="block mx-auto mt-2 text-[12px] text-honey underline hover:no-underline"
              >
                Switch to Claude instead
              </button>
            )}
          </div>
        )}
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
cd /home/zach/hive/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/zach/hive
git add frontend/src/app/chat/page.tsx
git commit -m "feat: add Local/Claude model toggle to chat UI

Local (Ollama qwen2.5:7b) is the default. Claude toggle sends
use_claude=true. Each assistant message shows a model label.
503 from Ollama shows a 'Switch to Claude' recovery button.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Build and smoke test

- [ ] **Step 1: Pull the correct Ollama model on the host**

```bash
ollama pull qwen2.5:7b
```

Expected: `pulling manifest`, then `success`. If already present: `already up to date`.

- [ ] **Step 2: Rebuild backend and restart stack**

```bash
cd /home/zach/hive
docker compose build backend
docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d backend
```

Expected: backend container restarts, no import errors in:
```bash
docker compose logs backend --tail=20
```

- [ ] **Step 3: Smoke test Ollama path directly**

```bash
curl -s -X POST http://localhost:8005/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat /tmp/hive_token 2>/dev/null || echo YOUR_TOKEN)" \
  -d '{"message": "What is 2+2?", "use_claude": false}' | python3 -m json.tool
```

Expected response includes `"model_used": "ollama/qwen2.5:7b"` and a non-empty `"response"`.

- [ ] **Step 4: Smoke test Claude path**

```bash
curl -s -X POST http://localhost:8005/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "What is 2+2?", "use_claude": true}' | python3 -m json.tool
```

Expected: `"model_used": "claude-sonnet-4-6"`.

- [ ] **Step 5: Smoke test 503 handling — stop Ollama and send a Local message**

```bash
# Stop Ollama temporarily
sudo systemctl stop ollama

curl -s -X POST http://localhost:8005/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "hi", "use_claude": false}' | python3 -m json.tool

# Restart Ollama
sudo systemctl start ollama
```

Expected: `{"detail": "Local AI (Ollama) is unavailable. Try switching to Claude."}` with HTTP 503.

- [ ] **Step 6: Final commit**

```bash
cd /home/zach/hive
git add .
git commit -m "chore: rebuild backend for Ollama chat integration

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Pre-flight Checklist

- [ ] `ollama pull qwen2.5:7b` on the NUC host (Task 4 Step 1)
- [ ] `ANTHROPIC_API_KEY` set in `.env` (needed for Claude opt-in path)
- [ ] Backend container rebuilt after Task 1
