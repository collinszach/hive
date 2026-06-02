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

    def get_holdings(
        self,
        snaptrade_user_id: str,
        user_secret: str,
        account_id: str,
    ) -> dict:
        """Return normalized holdings for one investment account.

        Shape:
            {
                "total_value": float | None,
                "currency": str | None,
                "positions": [
                    {symbol, description, units, price, market_value,
                     open_pnl, avg_price, currency, type}, ...
                ],
                "orders": [
                    {action, status, symbol, description, quantity,
                     filled_quantity, price, order_type, placed_at,
                     executed_at, currency}, ...
                ],
            }
        """
        resp = self._client.account_information.get_user_holdings(
            account_id=account_id,
            user_id=snaptrade_user_id,
            user_secret=user_secret,
        )
        body = resp.body or {}

        positions = [
            self._normalize_position(p)
            for p in (body.get("positions") or [])
        ]
        # Option positions are normalized through the same shaper; their symbol
        # block differs but the fields we read degrade gracefully.
        positions += [
            self._normalize_position(p)
            for p in (body.get("option_positions") or [])
        ]
        orders = [
            self._normalize_order(o)
            for o in (body.get("orders") or [])
        ]

        total = body.get("total_value") or {}
        if isinstance(total, dict):
            total_value = self._as_float(total.get("value"))
            total_currency = total.get("currency")
        else:
            total_value = self._as_float(total)
            total_currency = None

        return {
            "total_value": total_value,
            "currency": total_currency,
            "positions": positions,
            "orders": orders,
        }

    @staticmethod
    def _as_float(value) -> Optional[float]:
        try:
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    @classmethod
    def _symbol_fields(cls, raw_symbol: dict) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
        """Drill into a (possibly nested) symbol block → (symbol, description, currency, type)."""
        if not isinstance(raw_symbol, dict):
            return None, None, None, None
        # PositionSymbol → {symbol: UniversalSymbol{...}} OR a flat UniversalSymbol.
        universal = raw_symbol.get("symbol")
        if not isinstance(universal, dict):
            universal = raw_symbol
        symbol = universal.get("symbol") or universal.get("raw_symbol")
        description = universal.get("description")
        currency = None
        cur = universal.get("currency")
        if isinstance(cur, dict):
            currency = cur.get("code")
        sym_type = None
        typ = universal.get("type")
        if isinstance(typ, dict):
            sym_type = typ.get("description") or typ.get("code")
        return symbol, description, currency, sym_type

    @classmethod
    def _normalize_position(cls, pos: dict) -> dict:
        if not isinstance(pos, dict):
            return {}
        symbol, description, currency, sym_type = cls._symbol_fields(pos.get("symbol") or {})
        units = cls._as_float(pos.get("units")) or cls._as_float(pos.get("fractional_units"))
        price = cls._as_float(pos.get("price"))
        avg_price = cls._as_float(pos.get("average_purchase_price"))
        market_value = (units * price) if (units is not None and price is not None) else None
        return {
            "symbol": symbol,
            "description": description,
            "units": units,
            "price": price,
            "market_value": market_value,
            "open_pnl": cls._as_float(pos.get("open_pnl")),
            "avg_price": avg_price,
            "currency": currency,
            "type": sym_type,
        }

    @classmethod
    def _normalize_order(cls, order: dict) -> dict:
        if not isinstance(order, dict):
            return {}
        raw_symbol = order.get("universal_symbol") or order.get("symbol") or {}
        symbol, description, currency, _ = cls._symbol_fields(raw_symbol)
        # Orders sometimes carry a bare ticker string in `symbol`.
        if symbol is None and isinstance(order.get("symbol"), str):
            symbol = order["symbol"]
        return {
            "action": order.get("action"),
            "status": order.get("status"),
            "symbol": symbol,
            "description": description,
            "quantity": cls._as_float(order.get("total_quantity")),
            "filled_quantity": cls._as_float(order.get("filled_quantity")),
            "price": cls._as_float(order.get("execution_price")),
            "order_type": order.get("order_type"),
            "placed_at": order.get("time_placed"),
            "executed_at": order.get("time_executed"),
            "currency": currency,
        }

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
