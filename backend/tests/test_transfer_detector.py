"""
Tests for the transfer detector.
Venmo, Zelle, Cash App must always be detected as (is_transfer=True, is_excluded=True).
"""
import pytest

from app.ml.transfer_detector import is_transfer


class TestP2PTransfers:
    @pytest.mark.parametrize("description", [
        "Venmo payment",
        "VENMO 123456",
        "venmo transfer",
        "Venmo *JOHN_DOE",
        "Zelle payment",
        "ZELLE ZPN12345",
        "zelle transfer to mom",
        "Cash App",
        "CASH APP TRANSFER",
        "cash app payment",
        "Paypal Transfer",
        "PAYPAL TRANSFER USD",
        "CashApp payment",
        "CASHAPP PAYMENT",
    ])
    def test_p2p_is_always_excluded(self, description):
        is_xfer, is_excl = is_transfer(description)
        assert is_xfer is True, f"Expected is_transfer=True for: {description}"
        assert is_excl is True, f"Expected is_excluded=True for: {description}"


class TestBankTransfers:
    @pytest.mark.parametrize("description", [
        "Online Transfer to Savings",
        "ACH Transfer Chase",
        "Wire Transfer International",
        "Bank Transfer #12345",
        "Transfer to checking",
        "Transfer from savings",
        "External Transfer",
        "Internal Transfer",
    ])
    def test_bank_transfers_excluded(self, description):
        is_xfer, is_excl = is_transfer(description)
        assert is_xfer is True
        assert is_excl is True


class TestNormalTransactions:
    @pytest.mark.parametrize("description", [
        "STARBUCKS #12345",
        "AMAZON.COM",
        "SOUTHWEST AIRLINES",
        "WHOLE FOODS MARKET",
        "NETFLIX",
        "SHELL OIL 00012",
        "UBER * TRIP",
        "CHIPOTLE MEXICAN GRILL",
        "DELTA AIR LINES",
        "CVS PHARMACY",
    ])
    def test_normal_transactions_not_excluded(self, description):
        is_xfer, is_excl = is_transfer(description)
        assert is_xfer is False, f"Expected is_transfer=False for: {description}"
        assert is_excl is False, f"Expected is_excluded=False for: {description}"


class TestReturnValues:
    def test_returns_tuple_of_bools(self):
        result = is_transfer("some merchant")
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], bool)
        assert isinstance(result[1], bool)

    def test_venmo_both_true(self):
        xfer, excl = is_transfer("VENMO PAYMENT")
        assert xfer is True
        assert excl is True

    def test_grocery_both_false(self):
        xfer, excl = is_transfer("TRADER JOES #123")
        assert xfer is False
        assert excl is False
