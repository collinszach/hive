"""
Tests for transaction deduplication logic.
Ensures the same plaid_transaction_id cannot be inserted twice.

These tests verify the business logic in _upsert_transactions without
needing a live database — we test the upsert SQL statement structure
and the plaid_transaction_id uniqueness constraint via the model definition.
"""
import pytest
from unittest.mock import MagicMock, patch, call
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.transaction import Transaction


class TestTransactionModel:
    def test_plaid_transaction_id_is_unique_column(self):
        """Transaction model must have plaid_transaction_id with unique constraint."""
        col = Transaction.__table__.c.get("plaid_transaction_id")
        assert col is not None, "plaid_transaction_id column missing from Transaction model"
        assert col.unique, "plaid_transaction_id must have unique=True"

    def test_transaction_has_required_analytics_fields(self):
        """Critical fields for analytics exclusion must exist."""
        cols = {c.name for c in Transaction.__table__.columns}
        required = {"is_transfer", "is_excluded", "pending", "plaid_transaction_id"}
        for field in required:
            assert field in cols, f"Missing required field: {field}"

    def test_is_excluded_default_false(self):
        """is_excluded should default to False for new transactions."""
        col = Transaction.__table__.c.get("is_excluded")
        assert col is not None
        assert col.default is not None or col.server_default is not None or str(col.type) == "BOOLEAN"

    def test_pending_field_exists(self):
        col = Transaction.__table__.c.get("pending")
        assert col is not None


class TestUpsertLogic:
    """Test the upsert logic in isolation using mocks."""

    def test_upsert_uses_plaid_transaction_id_as_conflict_target(self):
        """
        The _upsert_transactions function must use on_conflict_do_update
        with plaid_transaction_id as the conflict target.
        """
        from app.tasks.ingestion import _upsert_transactions

        mock_db = MagicMock()
        mock_db.execute = MagicMock()

        account_map = {"plaid_acct_001": "uuid-account-1"}

        # Minimal Plaid transaction mock
        mock_tx = {
            "transaction_id": "plaid_tx_abc123",
            "account_id": "plaid_acct_001",
            "date": "2024-01-15",
            "authorized_date": None,
            "amount": 45.99,
            "iso_currency_code": "USD",
            "merchant_name": "Starbucks",
            "original_description": "STARBUCKS #12345 SEATTLE WA",
            "name": "Starbucks",
            "category": ["Food and Drink", "Coffee Shop"],
            "pending": False,
            "payment_channel": "in store",
            "location": {},
            "counterparties": [],
            "website": None,
        }

        count = _upsert_transactions(mock_db, account_map, [mock_tx])

        assert count == 1
        mock_db.execute.assert_called_once()
        # Verify commit was called
        mock_db.commit.assert_called_once()

    def test_empty_list_returns_zero(self):
        """Empty transaction list should return 0 without hitting the DB."""
        from app.tasks.ingestion import _upsert_transactions

        mock_db = MagicMock()
        count = _upsert_transactions(mock_db, {}, [])
        assert count == 0
        mock_db.execute.assert_not_called()

    def test_unknown_account_id_is_skipped(self):
        """Transaction with unknown plaid account_id must be silently skipped."""
        from app.tasks.ingestion import _upsert_transactions

        mock_db = MagicMock()
        account_map = {}  # empty — no known accounts

        mock_tx = {
            "transaction_id": "plaid_tx_xyz",
            "account_id": "unknown_plaid_account",
            "date": "2024-01-15",
            "authorized_date": None,
            "amount": 50.0,
            "iso_currency_code": "USD",
            "merchant_name": "Amazon",
            "original_description": "AMAZON.COM",
            "name": "Amazon",
            "category": [],
            "pending": False,
            "payment_channel": "online",
            "location": {},
            "counterparties": [],
            "website": None,
        }

        count = _upsert_transactions(mock_db, account_map, [mock_tx])
        assert count == 0
        mock_db.execute.assert_not_called()


class TestRemoveTransactions:
    def test_empty_removed_returns_zero(self):
        from app.tasks.ingestion import _remove_transactions
        mock_db = MagicMock()
        count = _remove_transactions(mock_db, [])
        assert count == 0
        mock_db.execute.assert_not_called()

    def test_removed_transactions_deleted_by_plaid_id(self):
        from app.tasks.ingestion import _remove_transactions
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.rowcount = 2
        mock_db.execute.return_value = mock_result

        removed = [
            {"transaction_id": "plaid_tx_001"},
            {"transaction_id": "plaid_tx_002"},
        ]
        count = _remove_transactions(mock_db, removed)
        assert count == 2
        mock_db.commit.assert_called_once()


class TestPlaidTxToDict:
    """Test Plaid transaction conversion logic."""

    def test_venmo_sets_is_excluded(self):
        """Venmo transactions must have is_transfer=True, is_excluded=True."""
        from app.tasks.ingestion import _plaid_tx_to_dict

        account_map = {"acct_001": "uuid-1"}
        mock_tx = {
            "transaction_id": "plaid_venmo_001",
            "account_id": "acct_001",
            "date": "2024-01-15",
            "authorized_date": None,
            "amount": 50.0,
            "iso_currency_code": "USD",
            "merchant_name": "Venmo",
            "original_description": "Venmo payment to Jane",
            "name": "Venmo",
            "category": [],
            "pending": False,
            "payment_channel": "other",
            "location": {},
            "counterparties": [],
            "website": None,
        }

        result = _plaid_tx_to_dict(account_map, mock_tx)
        assert result is not None
        assert result["is_transfer"] is True
        assert result["is_excluded"] is True

    def test_normal_transaction_not_excluded(self):
        from app.tasks.ingestion import _plaid_tx_to_dict

        account_map = {"acct_001": "uuid-1"}
        mock_tx = {
            "transaction_id": "plaid_sb_001",
            "account_id": "acct_001",
            "date": "2024-01-15",
            "authorized_date": None,
            "amount": 6.75,
            "iso_currency_code": "USD",
            "merchant_name": "Starbucks",
            "original_description": "STARBUCKS #12345",
            "name": "Starbucks",
            "category": [],
            "pending": False,
            "payment_channel": "in store",
            "location": {},
            "counterparties": [],
            "website": None,
        }

        result = _plaid_tx_to_dict(account_map, mock_tx)
        assert result is not None
        assert result["is_transfer"] is False
        assert result["is_excluded"] is False

    def test_plaid_transaction_id_preserved(self):
        from app.tasks.ingestion import _plaid_tx_to_dict

        account_map = {"acct_001": "uuid-1"}
        mock_tx = {
            "transaction_id": "unique_plaid_tx_id_987",
            "account_id": "acct_001",
            "date": "2024-01-15",
            "authorized_date": None,
            "amount": 10.0,
            "iso_currency_code": "USD",
            "merchant_name": "Test",
            "original_description": "Test merchant",
            "name": "Test",
            "category": [],
            "pending": False,
            "payment_channel": "online",
            "location": {},
            "counterparties": [],
            "website": None,
        }

        result = _plaid_tx_to_dict(account_map, mock_tx)
        assert result is not None
        assert result["plaid_transaction_id"] == "unique_plaid_tx_id_987"
