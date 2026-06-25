"""add Plaid personal_finance_category columns + net-spend materialized view

Adds plaid_pfc_primary / plaid_pfc_detailed so income detection can use Plaid's
reliable INCOME_* signal (the legacy `category` field often omits it), and
rebuilds mv_monthly_category_spend so its totals net out expense shares
(amounts owed back to the user) — matching the budgets/dashboard math.

Revision ID: c7d8e9f0a1b2
Revises: b6c7d8e9f0a1
Create Date: 2026-06-25 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "b6c7d8e9f0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Per-transaction spend net of amounts owed back to the user, clamped at 0.
_NET_SPEND = (
    "GREATEST(t.amount - COALESCE("
    "(SELECT SUM(es.amount) FROM expense_shares es WHERE es.transaction_id = t.id), 0), 0)"
)

CREATE_VIEW = f"""
CREATE MATERIALIZED VIEW mv_monthly_category_spend AS
SELECT
    DATE_TRUNC('month', t.date)::DATE AS month,
    t.category,
    COUNT(*) AS transaction_count,
    SUM({_NET_SPEND}) AS total_spent,
    b.budget_amount,
    CASE
        WHEN b.budget_amount > 0
        THEN ROUND((SUM({_NET_SPEND}) / b.budget_amount) * 100, 1)
        ELSE NULL
    END AS pct_used,
    MAX(t.date) AS last_transaction_date
FROM transactions t
LEFT JOIN budgets b
    ON b.category = t.category
    AND b.month = DATE_TRUNC('month', t.date)::DATE
WHERE
    t.is_excluded = FALSE
    AND t.is_transfer = FALSE
    AND t.pending = FALSE
    AND t.amount > 0
    AND t.category IS NOT NULL
GROUP BY
    DATE_TRUNC('month', t.date)::DATE,
    t.category,
    b.budget_amount
"""

CREATE_INDEX = "CREATE UNIQUE INDEX ON mv_monthly_category_spend(month, category)"
DROP_VIEW = "DROP MATERIALIZED VIEW IF EXISTS mv_monthly_category_spend"

# Original (gross) view, for downgrade.
CREATE_VIEW_GROSS = """
CREATE MATERIALIZED VIEW mv_monthly_category_spend AS
SELECT
    DATE_TRUNC('month', t.date)::DATE AS month,
    t.category,
    COUNT(*) AS transaction_count,
    SUM(t.amount) AS total_spent,
    b.budget_amount,
    CASE
        WHEN b.budget_amount > 0
        THEN ROUND((SUM(t.amount) / b.budget_amount) * 100, 1)
        ELSE NULL
    END AS pct_used,
    MAX(t.date) AS last_transaction_date
FROM transactions t
LEFT JOIN budgets b
    ON b.category = t.category
    AND b.month = DATE_TRUNC('month', t.date)::DATE
WHERE
    t.is_excluded = FALSE
    AND t.is_transfer = FALSE
    AND t.pending = FALSE
    AND t.amount > 0
    AND t.category IS NOT NULL
GROUP BY
    DATE_TRUNC('month', t.date)::DATE,
    t.category,
    b.budget_amount
"""


def upgrade() -> None:
    op.add_column("transactions", sa.Column("plaid_pfc_primary", sa.Text(), nullable=True))
    op.add_column("transactions", sa.Column("plaid_pfc_detailed", sa.Text(), nullable=True))
    # Index supports the correlated expense-shares subquery used by net-spend math.
    op.create_index(
        "ix_expense_shares_transaction_id",
        "expense_shares",
        ["transaction_id"],
        if_not_exists=True,
    )
    op.execute(DROP_VIEW)
    op.execute(CREATE_VIEW)
    op.execute(CREATE_INDEX)


def downgrade() -> None:
    op.execute(DROP_VIEW)
    op.execute(CREATE_VIEW_GROSS)
    op.execute(CREATE_INDEX)
    op.drop_index("ix_expense_shares_transaction_id", table_name="expense_shares", if_exists=True)
    op.drop_column("transactions", "plaid_pfc_detailed")
    op.drop_column("transactions", "plaid_pfc_primary")
