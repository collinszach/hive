"""add materialized view mv_monthly_category_spend

Revision ID: a1b2c3d4e5f6
Revises: 34c12187dd95
Create Date: 2026-03-14 23:48:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "34c12187dd95"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CREATE_VIEW = """
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

CREATE_INDEX = "CREATE UNIQUE INDEX ON mv_monthly_category_spend(month, category)"

DROP_VIEW = "DROP MATERIALIZED VIEW IF EXISTS mv_monthly_category_spend"


def upgrade() -> None:
    op.execute(CREATE_VIEW)
    op.execute(CREATE_INDEX)


def downgrade() -> None:
    op.execute(DROP_VIEW)
