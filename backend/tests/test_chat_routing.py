"""Tests for chat endpoint routing — _chat_with_ollama() behavior."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
from httpx import ConnectError, TimeoutException


@pytest.mark.asyncio
async def test_chat_with_ollama_returns_text_and_tokens():
    """_chat_with_ollama parses Ollama response correctly."""
    from app.api.chat import _chat_with_ollama

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "message": {"content": "You spent $200 on food."},
        "prompt_eval_count": 100,
        "eval_count": 20,
    }

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("app.api.chat.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        text, inp, out, model = await _chat_with_ollama(
            system_prompt="You are a finance assistant.",
            messages=[{"role": "user", "content": "How much on food?"}],
            model="qwen2.5:7b",
            ollama_url="http://localhost:11434",
        )

    assert text == "You spent $200 on food."
    assert inp == 100
    assert out == 20
    assert model == "ollama/qwen2.5:7b"


@pytest.mark.asyncio
async def test_chat_with_ollama_raises_503_on_connect_error():
    """ConnectError → HTTPException 503."""
    from app.api.chat import _chat_with_ollama

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=ConnectError("refused"))

    with patch("app.api.chat.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        with pytest.raises(HTTPException) as exc_info:
            await _chat_with_ollama(
                system_prompt="sys",
                messages=[{"role": "user", "content": "hi"}],
                model="qwen2.5:7b",
                ollama_url="http://localhost:11434",
            )

    assert exc_info.value.status_code == 503
    assert "Ollama" in exc_info.value.detail


@pytest.mark.asyncio
async def test_chat_with_ollama_raises_503_on_timeout():
    """TimeoutException → HTTPException 503."""
    from app.api.chat import _chat_with_ollama

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=TimeoutException("timeout"))

    with patch("app.api.chat.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        with pytest.raises(HTTPException) as exc_info:
            await _chat_with_ollama(
                system_prompt="sys",
                messages=[{"role": "user", "content": "hi"}],
                model="qwen2.5:7b",
                ollama_url="http://localhost:11434",
            )

    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_build_system_prompt_includes_context():
    """_build_system_prompt embeds the financial context string."""
    from app.api.chat import _build_system_prompt

    result = _build_system_prompt("=== ACCOUNT BALANCES ===\n- Checking: $1000")
    assert "=== ACCOUNT BALANCES ===" in result
    assert "Hive" in result
    assert "Venmo" in result
