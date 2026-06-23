"""add peak_value to paper_portfolios (drawdown-brake high-water mark)

Revision ID: b6c7d8e9f0a1
Revises: a5b6c7d8e9f0
Create Date: 2026-06-23

"""
import sqlalchemy as sa

from alembic import op

revision = "b6c7d8e9f0a1"
down_revision = "a5b6c7d8e9f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "paper_portfolios",
        sa.Column("peak_value", sa.Numeric(16, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("paper_portfolios", "peak_value")
