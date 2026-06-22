"""Unit tests for the provider-agnostic MarketDataConnector (mocks httpx)."""
from datetime import date
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.marketdata.connector import MarketDataConnector, get_connector


def _resp(status_code=200, json_body=None):
    r = MagicMock()
    r.status_code = status_code
    r.json.return_value = json_body if json_body is not None else []
    r.raise_for_status = MagicMock()
    return r


_TIINGO_ROWS = [
    {
        "date": "2023-06-22T00:00:00.000Z",
        "open": 183.74, "high": 187.045, "low": 183.67, "close": 187.0,
        "volume": 51245327, "adjClose": 184.4321,
    },
    {
        "date": "2023-06-23T00:00:00.000Z",
        "open": 185.55, "high": 187.56, "low": 185.01, "close": 186.68,
        "volume": 53079290, "adjClose": 184.1166,
    },
]


@pytest.fixture
def connector():
    return MarketDataConnector(api_key="test-token")


def test_get_candles_parses_and_normalizes(connector):
    with patch("app.marketdata.connector.httpx.get", return_value=_resp(json_body=_TIINGO_ROWS)) as g:
        candles = connector.get_candles("AAPL", start=date(2023, 6, 22))
    assert len(candles) == 2
    first = candles[0]
    assert first["date"] == date(2023, 6, 22)
    assert first["open"] == 183.74
    assert first["close"] == 187.0
    assert first["adj_close"] == pytest.approx(184.4321)
    # symbol is lower-cased into the Tiingo path; token is attached
    _, kwargs = g.call_args
    assert kwargs["params"]["token"] == "test-token"
    assert kwargs["params"]["resampleFreq"] == "daily"
    assert kwargs["params"]["startDate"] == "2023-06-22"


def test_get_candles_passes_end_date(connector):
    with patch("app.marketdata.connector.httpx.get", return_value=_resp(json_body=_TIINGO_ROWS)) as g:
        connector.get_candles("aapl", start=date(2023, 1, 1), end=date(2023, 12, 31))
    _, kwargs = g.call_args
    assert kwargs["params"]["endDate"] == "2023-12-31"


def test_get_candles_empty_or_bad_body_returns_empty(connector):
    with patch("app.marketdata.connector.httpx.get", return_value=_resp(json_body={"detail": "x"})):
        assert connector.get_candles("AAPL", start=date(2023, 1, 1)) == []


def test_malformed_rows_are_skipped(connector):
    rows = [{"date": None, "close": 1}, {"no_date": True}, _TIINGO_ROWS[0]]
    with patch("app.marketdata.connector.httpx.get", return_value=_resp(json_body=rows)):
        candles = connector.get_candles("AAPL", start=date(2023, 1, 1))
    assert len(candles) == 1
    assert candles[0]["date"] == date(2023, 6, 22)


def test_get_quote_returns_latest_bar(connector):
    with patch("app.marketdata.connector.httpx.get", return_value=_resp(json_body=_TIINGO_ROWS)):
        bar = connector.get_quote("AAPL")
    assert bar["date"] == date(2023, 6, 23)  # last bar


def test_get_quote_none_when_no_data(connector):
    with patch("app.marketdata.connector.httpx.get", return_value=_resp(json_body=[])):
        assert connector.get_quote("AAPL") is None


def test_rate_limit_backoff_then_success(connector):
    responses = [_resp(status_code=429), _resp(json_body=_TIINGO_ROWS)]
    with patch("app.marketdata.connector.httpx.get", side_effect=responses), \
            patch("app.marketdata.connector.time.sleep") as sleep:
        candles = connector.get_candles("AAPL", start=date(2023, 1, 1))
    assert len(candles) == 2
    sleep.assert_called_once()  # backed off once for the 429


def test_network_error_retries_then_raises(connector):
    with patch("app.marketdata.connector.httpx.get", side_effect=httpx.ConnectError("boom")), \
            patch("app.marketdata.connector.time.sleep"):
        with pytest.raises(httpx.HTTPError):
            connector.get_candles("AAPL", start=date(2023, 1, 1))


def test_get_connector_none_when_key_unset():
    # Patch the settings object the factory reads.
    import app.config as config_mod
    with patch.object(config_mod.settings, "tiingo_api_key", ""):
        assert get_connector() is None


def test_get_connector_returns_instance_when_key_set():
    import app.config as config_mod
    with patch.object(config_mod.settings, "tiingo_api_key", "abc123"):
        conn = get_connector()
    assert isinstance(conn, MarketDataConnector)
