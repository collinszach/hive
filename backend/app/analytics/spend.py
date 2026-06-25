"""Shared spend math.

Budget/spend analytics count the user's *own* portion of a transaction: the full
amount they paid, minus anything owed back to them via expense shares (e.g. a
friend's half of a dinner). Points are deliberately NOT netted here — the user
earned points on the full charge they put on the card — so the points pipeline
keeps using ``Transaction.amount`` directly.

Use :func:`net_spend_expr` anywhere spend is summed for budgets, dashboards, or
analytics. Both pending and settled shares reduce spend: the user's share of an
expense is their share regardless of whether they've been paid back yet (and the
repayment itself is an excluded transfer, so there's no double-count).
"""
from sqlalchemy import func, select

from app.models.expense_share import ExpenseShare
from app.models.transaction import Transaction

def net_spend_sql(alias: str = "transactions") -> str:
    """Raw-SQL equivalent of net_spend_expr(), for text() queries.

    `alias` is the transactions table's alias in the query (e.g. "t").
    """
    return (
        f"GREATEST({alias}.amount - COALESCE("
        f"(SELECT SUM(es.amount) FROM expense_shares es "
        f"WHERE es.transaction_id = {alias}.id), 0), 0)"
    )


# Convenience for the common unaliased / "transactions" case.
NET_SPEND_SQL = net_spend_sql("transactions")


def shared_out_subq():
    """Correlated scalar subquery: total owed back to the user for a transaction."""
    return (
        select(func.coalesce(func.sum(ExpenseShare.amount), 0))
        .where(ExpenseShare.transaction_id == Transaction.id)
        .correlate(Transaction)
        .scalar_subquery()
    )


def net_spend_expr():
    """Per-transaction spend net of amounts owed to the user.

    Clamped at 0 so an over-allocated split (shares summing to more than the
    charge) can never produce negative spend that would distort category totals.
    """
    return func.greatest(Transaction.amount - shared_out_subq(), 0)
