"""add user_id to accounts and plaid_links

Revision ID: q5r6s7t8u9v0
Revises: p4q5r6s7t8u9
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "q5r6s7t8u9v0"
down_revision = "p4q5r6s7t8u9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add user_id column to accounts
    op.add_column("accounts", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"])
    op.create_foreign_key("fk_accounts_user_id", "accounts", "users", ["user_id"], ["id"])

    # Add user_id column to plaid_links
    op.add_column("plaid_links", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_plaid_links_user_id", "plaid_links", ["user_id"])
    op.create_foreign_key("fk_plaid_links_user_id", "plaid_links", "users", ["user_id"], ["id"])

    # Backfill: assign all existing records to the first active user
    op.execute("""
        UPDATE accounts SET user_id = (SELECT id FROM users WHERE is_active = true LIMIT 1)
        WHERE user_id IS NULL
    """)
    op.execute("""
        UPDATE plaid_links SET user_id = (SELECT id FROM users WHERE is_active = true LIMIT 1)
        WHERE user_id IS NULL
    """)


def downgrade() -> None:
    op.drop_constraint("fk_plaid_links_user_id", "plaid_links", type_="foreignkey")
    op.drop_index("ix_plaid_links_user_id", "plaid_links")
    op.drop_column("plaid_links", "user_id")

    op.drop_constraint("fk_accounts_user_id", "accounts", type_="foreignkey")
    op.drop_index("ix_accounts_user_id", "accounts")
    op.drop_column("accounts", "user_id")
