"""SnapTrade SDK wrapper — register users, get connect URLs, fetch account balances."""
import logging
from typing import Optional

from snaptrade_client import SnapTrade

logger = logging.getLogger(__name__)


class SnapTradeConnector:
    def __init__(self, client_id: str, consumer_key: str) -> None:
        self._client = SnapTrade(consumer_key=consumer_key, client_id=client_id)

    def register_user(self, local_user_id: str) -> tuple[str, str]:
        """Register a new SnapTrade user. Returns (snaptrade_user_id, user_secret).

        If the user is already registered (400), delete and re-register to recover a fresh secret.
        """
        from snaptrade_client.exceptions import ApiException
        try:
            resp = self._client.authentication.register_snap_trade_user(
                body={"userId": local_user_id}
            )
            return resp.body["userId"], resp.body["userSecret"]
        except ApiException as exc:
            if exc.status != 400:
                raise
            # Already registered but secret is lost — delete and re-register
            logger.warning("SnapTrade user %s already registered, deleting and re-registering", local_user_id)
            try:
                self._client.authentication.delete_snap_trade_user(
                    query_params={"userId": local_user_id}
                )
            except Exception as del_exc:
                logger.warning("SnapTrade delete failed: %s", del_exc)
            resp = self._client.authentication.register_snap_trade_user(
                body={"userId": local_user_id}
            )
            return resp.body["userId"], resp.body["userSecret"]

    def get_connect_url(
        self,
        snaptrade_user_id: str,
        user_secret: str,
        redirect_uri: str,
    ) -> str:
        """Return the SnapTrade OAuth URL to redirect the user to."""
        resp = self._client.authentication.login_snap_trade_user(
            user_id=snaptrade_user_id,
            user_secret=user_secret,
            custom_redirect=redirect_uri,
        )
        # SDK returns the URL string directly in .body or nested in a dict
        if isinstance(resp.body, str):
            return resp.body
        return resp.body.get("redirectURI") or resp.body.get("loginLink") or str(resp.body)

    def get_accounts(self, snaptrade_user_id: str, user_secret: str) -> list[dict]:
        """Return normalized account dicts: {id, name, institution, balance}."""
        resp = self._client.account_information.list_user_accounts(
            user_id=snaptrade_user_id,
            user_secret=user_secret,
        )
        accounts = []
        for acct in resp.body:
            # Balance may be nested: {"total": {"amount": 123.45, "currency": "USD"}}
            # or a flat float depending on SDK version
            balance_raw = acct.get("balance", {})
            if isinstance(balance_raw, dict):
                total = balance_raw.get("total", {})
                balance = float(total.get("amount", 0)) if isinstance(total, dict) else float(total or 0)
            else:
                balance = float(balance_raw or 0)

            accounts.append({
                "id": acct["id"],
                "name": acct.get("name", "Investment Account"),
                "institution": acct.get("institution_name", "Unknown"),
                "balance": balance,
            })
        return accounts

    def delete_user(self, snaptrade_user_id: str) -> None:
        """Remove a SnapTrade user (cleanup on disconnect)."""
        try:
            self._client.authentication.delete_snap_trade_user(
                query_params={"userId": snaptrade_user_id}
            )
        except Exception as exc:
            logger.warning("SnapTrade delete_user failed (non-fatal): %s", exc)


def get_connector() -> Optional[SnapTradeConnector]:
    """Return a configured connector, or None if credentials are not set."""
    from app.config import settings
    if not settings.snaptrade_client_id or not settings.snaptrade_consumer_key:
        return None
    return SnapTradeConnector(
        client_id=settings.snaptrade_client_id,
        consumer_key=settings.snaptrade_consumer_key,
    )
