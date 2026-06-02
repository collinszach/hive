"""add Apple StoreKit IAP columns to users

Revision ID: u9v0w1x2y3z4
Revises: t8u9v0w1x2y3
Branch Labels: None
Depends On: None
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa

revision = "u9v0w1x2y3z4"
down_revision = "t8u9v0w1x2y3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("apple_original_transaction_id", sa.Text(), nullable=True),
    )
    op.add_column("users", sa.Column("plan_source", sa.Text(), nullable=True))
    op.create_index(
        "ix_users_apple_original_transaction_id",
        "users",
        ["apple_original_transaction_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_users_apple_original_transaction_id", table_name="users")
    op.drop_column("users", "plan_source")
    op.drop_column("users", "apple_original_transaction_id")
