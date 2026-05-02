"""add snaptrade fields

Revision ID: a2b3c4d5e6f7
Revises: f2a3b4c5d6e7
Create Date: 2026-04-05

"""
from alembic import op
import sqlalchemy as sa

revision = "a2b3c4d5e6f7"
down_revision = "g3h4i5j6k7l8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("snaptrade_account_id", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_accounts_snaptrade_id", "accounts", ["snaptrade_account_id"])
    op.add_column("users", sa.Column("snaptrade_user_id", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("snaptrade_user_secret", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "snaptrade_user_secret")
    op.drop_column("users", "snaptrade_user_id")
    op.drop_constraint("uq_accounts_snaptrade_id", "accounts", type_="unique")
    op.drop_column("accounts", "snaptrade_account_id")
