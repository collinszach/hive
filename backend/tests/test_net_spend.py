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


def test_every_spend_surface_nets_expense_shares():
    """Each module that sums spend must go through the net helpers.

    These were missed when netting was introduced, so a shared charge still showed
    its full amount in cash flow, the AI chat context, the plan/trim analysis, the
    transaction list total, and the month position — while budgets showed the net.
    """
    import inspect

    from app.api import cash_flow, chat, plan, planning, position, transactions

    for module in (cash_flow, chat, plan, planning, position, transactions):
        src = inspect.getsource(module)
        assert "net_spend" in src, f"{module.__name__} sums spend without netting shares"


def test_spend_sql_alias_matches_table_reference():
    """net_spend_sql's alias must match how the query names the transactions table."""
    from app.analytics.spend import net_spend_sql

    assert "t.amount" in net_spend_sql("t")
    assert "es.transaction_id = t.id" in net_spend_sql("t")
    assert "transactions.amount" in net_spend_sql("transactions")


def test_transaction_out_exposes_own_portion():
    """A shared charge reports the full amount plus what's left on the user."""
    from app.api.transactions import TransactionOut

    out = TransactionOut(
        id="00000000-0000-0000-0000-000000000001",
        plaid_transaction_id=None,
        account_id="00000000-0000-0000-0000-000000000002",
        date="2026-09-01",
        amount=120.00,
        currency="USD",
        merchant="Dinner",
        raw_description="DINNER",
        category="Food & Drink",
        subcategory="Restaurant",
        category_source="rule",
        is_transfer=False,
        is_excluded=False,
        pending=False,
        payment_channel=None,
        location_city=None,
        location_state=None,
        logo_url=None,
    )
    out.apply_shared(80.0)
    # The charge itself is untouched — points are earned on the full 120.
    assert out.amount == 120.00
    assert out.shared_out == 80.00
    assert out.net_amount == 40.00


def test_transaction_out_net_amount_clamps_at_zero():
    """Over-assigning a charge can't read as negative spend."""
    from app.api.transactions import TransactionOut

    out = TransactionOut(
        id="00000000-0000-0000-0000-000000000001",
        plaid_transaction_id=None,
        account_id="00000000-0000-0000-0000-000000000002",
        date="2026-09-01",
        amount=50.00,
        currency="USD",
        merchant="Dinner",
        raw_description="DINNER",
        category="Food & Drink",
        subcategory="Restaurant",
        category_source="rule",
        is_transfer=False,
        is_excluded=False,
        pending=False,
        payment_channel=None,
        location_city=None,
        location_state=None,
        logo_url=None,
    )
    out.apply_shared(75.0)
    assert out.net_amount == 0.0


def test_points_pipeline_still_uses_the_full_charge():
    """Points must never be netted — the user earned them on the whole swipe."""
    import inspect

    from app.points import tracker
    from app.tasks import points as points_task

    for module in (tracker, points_task):
        src = inspect.getsource(module)
        assert "net_spend" not in src, f"{module.__name__} must not net points by shares"
