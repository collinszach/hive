"""add is_manual to accounts

Revision ID: r6s7t8u9v0w1
Revises: q5r6s7t8u9v0
Branch Labels: None
Depends On: None
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = "r6s7t8u9v0w1"
down_revision = "q5r6s7t8u9v0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("is_manual", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("accounts", "is_manual")
