# Ollama Chat Integration — Design Spec
**Date:** 2026-04-05
**Status:** Approved

## Goal

Replace the hardwired Claude Sonnet chat endpoint with Ollama (local `qwen2.5:7b`) as the default, while keeping Claude Sonnet available as an explicit opt-in per message. Cost drops to ~$0 for routine financial Q&A; Claude remains available for deeper analysis on demand.

---

## Architecture

### Request Flow

```
User sends message
       │
       ▼
ChatRequest { message, conversation_history, use_claude: bool = false }
       │
       ├─ use_claude=false ──▶ Ollama /api/chat @ 127.0.0.1:11434
       │                        model: settings.ollama_chat_model
       │                        timeout: 120s
       │                        on connection error → 503 (clean, not 500)
       │
       └─ use_claude=true ───▶ Anthropic claude-sonnet-4-6
                                (existing path, unchanged)
       │
       ▼
ChatResponse { response, input_tokens, output_tokens, model_used }
```

`_build_financial_context()` is shared by both paths — no duplication.

---

## Backend Changes (`backend/app/api/chat.py`)

### `ChatRequest` — add one field
```python
use_claude: bool = False
```

### `ChatResponse` — add one field
```python
model_used: str   # e.g. "ollama/qwen2.5:7b" or "claude-sonnet-4-6"
```

### New `_chat_with_ollama()` function
- Calls `POST {settings.ollama_url}/api/chat`
- Payload: `{ model, messages: [{role, content}], stream: false }`
- System prompt injected as `{"role": "system", "content": system_prompt}` prepended to messages
- Timeout: 120s via `httpx.AsyncClient`
- On `httpx.ConnectError` / timeout → raise `HTTPException(503, "Ollama unavailable")`
- Returns the response text string

### `chat()` endpoint — routing logic
```python
if body.use_claude:
    answer, model_used = await _chat_with_claude(...)
else:
    answer, model_used = await _chat_with_ollama(...)
```

Both branches feed the same `system_prompt` and `messages` list built from `conversation_history`.

### Token counts
- Ollama response includes `prompt_eval_count` / `eval_count` — map these to `input_tokens` / `output_tokens`
- Claude path unchanged

---

## Config (`backend/app/config.py`)

No changes needed. `ollama_url` and `ollama_chat_model` are already defined:
```python
ollama_url: str = "http://host.docker.internal:11434"  # works on host network as 127.0.0.1
ollama_chat_model: str = "qwen2.5:7b"
```

**Pre-requisite:** User must run `ollama pull qwen2.5:7b` on the NUC host (the `qwen` tag pulled is Qwen 1.5, not Qwen 2.5).

---

## Frontend Changes (`frontend/src/app/chat/page.tsx`)

### State
```typescript
const [useClaud, setUseClaude] = useState(false)
```

### Model toggle — pinned to input row
Two pill buttons next to the send button:
- **Local** (default, selected state = honey accent)
- **Claude** (unselected = muted)

Minimal footprint — same row as the text input, right side.

### API call — pass the flag
```typescript
api.chat.send({ message, conversation_history, use_claude: useClaud })
```

### Message bubble — model indicator
Each assistant message stores `model_used` from the response. Rendered as a small muted label below the message content:
```
answered by ollama · qwen2.5:7b
```
or
```
answered by claude · sonnet
```
Same visual weight as a timestamp — not prominent, just informative.

---

## API Client (`frontend/src/lib/api.ts`)

Add `use_claude?: boolean` to the chat request type. Add `model_used: string` to the chat response type.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Ollama unreachable (not running) | 503 from backend; frontend shows "Local AI unavailable — try Claude" with a button to switch |
| Ollama timeout (>120s) | 503; same frontend message |
| Claude API key missing/invalid | 502; frontend shows generic error |
| Empty response from either | 502 |

---

## What Is NOT Changing

- `_build_financial_context()` — shared, untouched
- Conversation history handling — same 10-message window
- The categorization pipeline (Ollama Stage 2) — separate, untouched
- System prompt content — same for both models

---

## Pre-flight Checklist

- [ ] `ollama pull qwen2.5:7b` on the NUC host
- [ ] `ANTHROPIC_API_KEY` set in `.env` (for Claude opt-in to work)
- [ ] Rebuild backend container after changes
