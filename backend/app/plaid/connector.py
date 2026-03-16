"""Plaid API connector. Uses /transactions/sync exclusively (cursor-based)."""
import logging
from typing import Optional

import plaid
from plaid.api import plaid_api
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.transactions_sync_request_options import TransactionsSyncRequestOptions

from app.config import settings

logger = logging.getLogger(__name__)

_PLAID_ENVS = {
    "sandbox": plaid.Environment.Sandbox,
    "development": plaid.Environment.Production,  # Plaid deprecated Development; keys work on Production
    "production": plaid.Environment.Production,
}


def _make_client() -> plaid_api.PlaidApi:
    configuration = plaid.Configuration(
        host=_PLAID_ENVS.get(settings.plaid_env, plaid.Environment.Sandbox),
        api_key={
            "clientId": settings.plaid_client_id,
            "secret": settings.plaid_secret,
        },
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


class PlaidConnector:
    def __init__(self) -> None:
        self._client = _make_client()

    def get_link_token(self, user_id: str) -> str:
        """Create a Plaid Link token for the given user."""
        request = LinkTokenCreateRequest(
            products=[Products("transactions")],
            client_name="Hive Finance",
            country_codes=[CountryCode("US")],
            language="en",
            user=LinkTokenCreateRequestUser(client_user_id=user_id),
        )
        response = self._client.link_token_create(request)
        logger.info("Created link token for user %s", user_id)
        return response["link_token"]

    def exchange_public_token(self, public_token: str) -> tuple[str, str]:
        """Exchange a public token for an access_token + item_id."""
        request = ItemPublicTokenExchangeRequest(public_token=public_token)
        response = self._client.item_public_token_exchange(request)
        return response["access_token"], response["item_id"]

    def get_accounts(self, access_token: str) -> list:
        """Return all accounts for a given access token."""
        request = AccountsGetRequest(access_token=access_token)
        response = self._client.accounts_get(request)
        return response["accounts"]

    def sync_transactions(
        self, access_token: str, cursor: Optional[str]
    ) -> tuple[list, list, list, str]:
        """
        Pull incremental transaction updates using /transactions/sync.
        Returns (added, modified, removed, next_cursor).
        NEVER uses /transactions/get.
        """
        added: list = []
        modified: list = []
        removed: list = []
        has_more = True
        next_cursor = cursor or ""

        while has_more:
            request = TransactionsSyncRequest(
                access_token=access_token,
                cursor=next_cursor,
                count=500,
                options=TransactionsSyncRequestOptions(
                    include_original_description=True,
                    include_logo_and_counterparty_beta=True,
                ),
            )
            response = self._client.transactions_sync(request)
            added.extend(response["added"])
            modified.extend(response["modified"])
            removed.extend(response["removed"])
            has_more = response["has_more"]
            next_cursor = response["next_cursor"]

        logger.info(
            "Sync complete: +%d modified=%d removed=%d", len(added), len(modified), len(removed)
        )
        return added, modified, removed, next_cursor


# Module-level singleton — one instance per process
plaid_connector = PlaidConnector()
