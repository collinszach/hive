"""Unit tests for SnapTrade connector — mocks the SDK, tests wrapper logic."""
from unittest.mock import MagicMock, patch

import pytest

from app.snaptrade.connector import SnapTradeConnector


@pytest.fixture
def connector():
    with patch("app.snaptrade.connector.SnapTrade") as mock_cls:
        mock_client = MagicMock()
        mock_cls.return_value = mock_client
        yield SnapTradeConnector(client_id="test-id", consumer_key="test-key"), mock_client


def test_register_user_returns_user_id_and_secret(connector):
    conn, mock_client = connector
    mock_client.authentication.register_snap_trade_user.return_value = MagicMock(
        body={"userId": "snap-uid-123", "userSecret": "secret-abc"}
    )
    uid, secret = conn.register_user("my-local-user-id")
    assert uid == "snap-uid-123"
    assert secret == "secret-abc"
    mock_client.authentication.register_snap_trade_user.assert_called_once_with(
        body={"userId": "my-local-user-id"}
    )


def test_get_connect_url_returns_redirect_uri(connector):
    conn, mock_client = connector
    mock_client.authentication.login_snap_trade_user.return_value = MagicMock(
        body="https://app.snaptrade.com/snapTrade/connect?token=abc"
    )
    url = conn.get_connect_url(
        snaptrade_user_id="snap-uid",
        user_secret="secret",
        redirect_uri="https://example.com/connect",
    )
    assert url == "https://app.snaptrade.com/snapTrade/connect?token=abc"


def test_get_accounts_returns_normalized_list(connector):
    conn, mock_client = connector
    mock_client.account_information.list_user_accounts.return_value = MagicMock(
        body=[
            {
                "id": "acct-1",
                "name": "Schwab Roth IRA",
                "institution_name": "Charles Schwab",
                "balance": {"total": {"amount": 42000.50, "currency": "USD"}},
            }
        ]
    )
    accounts = conn.get_accounts(snaptrade_user_id="snap-uid", user_secret="secret")
    assert len(accounts) == 1
    assert accounts[0]["id"] == "acct-1"
    assert accounts[0]["name"] == "Schwab Roth IRA"
    assert accounts[0]["institution"] == "Charles Schwab"
    assert accounts[0]["balance"] == 42000.50
