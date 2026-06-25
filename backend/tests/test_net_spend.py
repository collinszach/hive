"""Spend analytics net expense shares (amounts owed back to the user).

Budgets/spend count the user's own portion (charge minus what others owe them);
points are computed on the full charge and must NOT be netted. These tests lock
the SQL shape without touching a database.
"""
from sqlalchemy import func, select
from sqlalchemy.dialects import postgresql

from app.analytics.spend import net_spend_expr
from app.models.transaction import Transaction


def _sql(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect())).lower()


def test_net_spend_subtracts_expense_shares():
    sql = _sql(select(func.sum(net_spend_expr())))
    # Spend = transaction amount minus the sum of expense shares for that tx...
    assert "transactions.amount -" in sql
    assert "from expense_shares" in sql
    assert "expense_shares.transaction_id = transactions.id" in sql
    # ...clamped at zero so an over-allocated split can't go negative.
    assert "greatest(" in sql


def test_net_spend_both_pending_and_settled():
    # No status filter — a settled share still reduces spend (the user's portion
    # is their portion regardless of whether they've been paid back yet).
    sql = _sql(select(func.sum(net_spend_expr())))
    assert "status" not in sql


def test_income_from_pfc_maps_income_primaries():
    from app.ml.categorizer import income_from_pfc

    assert income_from_pfc("INCOME", "INCOME_WAGES") == ("Income", "Salary")
    assert income_from_pfc("INCOME", "INCOME_TAX_REFUND") == ("Income", "Tax Refund")
    # Unknown detailed under an INCOME primary still counts as income.
    assert income_from_pfc("INCOME", "INCOME_SOMETHING_NEW") == ("Income", "Other")


def test_income_from_pfc_ignores_non_income():
    from app.ml.categorizer import income_from_pfc

    # Refunds and transfers carry non-INCOME primaries — must not be labelled income.
    assert income_from_pfc("TRANSFER_IN", "TRANSFER_IN_DEPOSIT") is None
    assert income_from_pfc("GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_OTHER") is None
    assert income_from_pfc(None, None) is None


def test_budgets_use_net_spend():
    # The budgets endpoint must aggregate net spend, not gross amount.
    import inspect

    import app.api.budgets as budgets

    src = inspect.getsource(budgets)
    assert "net_spend_expr" in src
    assert "func.sum(Transaction.amount)" not in src
