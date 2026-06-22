"""Provider-agnostic market-data client for the paper-trading signal engine.

Backed by Tiingo today (free tier serves multi-year daily OHLCV history), but the
public surface — ``get_candles`` / ``get_quote`` — is vendor-neutral so the source
can be swapped without touching callers. Mirrors the graceful-skip shape of
``app/snaptrade/connector.py``: ``get_connector()`` returns ``None`` when no key is
configured, so tasks log-and-skip instead of crashing.

Candles are returned with both **raw** and **split/dividend-adjusted** prices. The
signal engine computes indicators off the adjusted series so a stock split does not
register as a price crash; raw OHLCV is preserved for display/audit.
"""
import logging
import time
from datetime import date
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Tiingo free tier: generous but throttled. Back off and retry on 429.
_MAX_RETRIES = 4
_BACKOFF_BASE_SECONDS = 1.5


class MarketDataConnector:
    """Thin wrapper over a market-data REST API (Tiingo)."""

    _BASE_URL = "https://api.tiingo.com/tiingo/daily"

    def __init__(self, api_key: str, *, timeout: float = 30.0) -> None:
        self._api_key = api_key
        self._timeout = timeout

    # -- internal HTTP with simple rate-limit backoff -------------------------

    _IEX_URL = "https://api.tiingo.com/iex"

    def _get(self, path: str, params: dict) -> httpx.Response:
        return self._request(f"{self._BASE_URL}{path}", params)

    def _request(self, url: str, params: dict) -> httpx.Response:
        merged = {**params, "token": self._api_key}
        headers = {"Content-Type": "application/json"}
        last_exc: Optional[Exception] = None
        for attempt in range(_MAX_RETRIES):
            try:
                resp = httpx.get(url, params=merged, headers=headers, timeout=self._timeout)
            except httpx.HTTPError as exc:  # network error — retry
                last_exc = exc
                time.sleep(_BACKOFF_BASE_SECONDS * (2 ** attempt))
                continue
            if resp.status_code == 429:
                wait = _BACKOFF_BASE_SECONDS * (2 ** attempt)
                logger.warning("market-data rate limited (429), backing off %.1fs", wait)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        if last_exc is not None:
            raise last_exc
        raise RuntimeError("market-data request exhausted retries (rate limited)")

    # -- public API -----------------------------------------------------------

    def get_candles(
        self,
        symbol: str,
        start: date,
        end: Optional[date] = None,
    ) -> list[dict]:
        """Return daily OHLCV bars for ``symbol`` over ``[start, end]`` (inclusive).

        Supports arbitrary historical ranges (years of history), not just the
        latest bar — the backtest backfill depends on this.

        Each bar: ``{date, open, high, low, close, volume, adj_close}`` where the
        ``adj_*`` value is split/dividend adjusted. Returns ``[]`` if the symbol
        has no data in range.
        """
        params = {"startDate": start.isoformat(), "resampleFreq": "daily"}
        if end is not None:
            params["endDate"] = end.isoformat()
        resp = self._get(f"/{symbol.lower()}/prices", params)
        body = resp.json()
        if not isinstance(body, list):
            return []
        candles: list[dict] = []
        for row in body:
            parsed = self._normalize_candle(row)
            if parsed is not None:
                candles.append(parsed)
        return candles

    def get_quote(self, symbol: str) -> Optional[dict]:
        """Return the latest available daily bar for ``symbol``, or ``None``.

        Used for the ongoing daily fetch and optional live-price display. On the
        free EOD tier this is the most recent close, not intraday.
        """
        # Pull a short recent window and take the last bar — robust to weekends/holidays.
        from datetime import timedelta

        start = date.today() - timedelta(days=10)
        candles = self.get_candles(symbol, start=start)
        return candles[-1] if candles else None

    def get_live_quote(self, symbol: str) -> Optional[dict]:
        """Return the latest intraday IEX quote for ``symbol`` (near-real-time).

        Shape: ``{symbol, price, open, high, low, timestamp}`` or ``None``. ``price`` is
        Tiingo's ``tngoLast`` (falls back to last/mid). Used by the intraday cycle to
        update today's forming bar and mark-to-market between EOD candles.
        """
        resp = self._request(f"{self._IEX_URL}/{symbol.lower()}", {})
        body = resp.json()
        if not isinstance(body, list) or not body:
            return None
        row = body[0]

        def f(key):
            v = row.get(key)
            try:
                return float(v) if v is not None else None
            except (TypeError, ValueError):
                return None

        price = f("tngoLast") or f("last") or f("mid")
        if price is None:
            return None
        return {
            "symbol": symbol.upper(),
            "price": price,
            "open": f("open"),
            "high": f("high"),
            "low": f("low"),
            "timestamp": row.get("timestamp"),
        }

    @staticmethod
    def _normalize_candle(row: dict) -> Optional[dict]:
        if not isinstance(row, dict):
            return None
        raw_date = row.get("date")
        if not raw_date:
            return None
        # Tiingo dates are ISO timestamps like "2023-06-22T00:00:00.000Z".
        try:
            bar_date = date.fromisoformat(raw_date[:10])
        except (ValueError, TypeError):
            return None

        def f(key: str) -> Optional[float]:
            val = row.get(key)
            try:
                return float(val) if val is not None else None
            except (TypeError, ValueError):
                return None

        return {
            "date": bar_date,
            "open": f("open"),
            "high": f("high"),
            "low": f("low"),
            "close": f("close"),
            "volume": f("volume"),
            "adj_close": f("adjClose"),
        }


def get_connector() -> Optional[MarketDataConnector]:
    """Return a configured connector, or ``None`` if no market-data key is set."""
    from app.config import settings

    if not settings.tiingo_api_key:
        return None
    return MarketDataConnector(api_key=settings.tiingo_api_key)
