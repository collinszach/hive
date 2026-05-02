"""Add is_subscription to transactions and un-exclude Venmo/Zelle

Revision ID: o3p4q5r6s7t8
Revises: n2o3p4q5r6s7
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa

revision = "o3p4q5r6s7t8"
down_revision = "n2o3p4q5r6s7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_subscription column
    op.add_column("transactions", sa.Column("is_subscription", sa.Boolean(), nullable=False, server_default="false"))

    # Mark existing transactions that match active subscriptions
    op.execute("""
        UPDATE transactions t
        SET is_subscription = TRUE
        FROM subscriptions s
        WHERE LOWER(COALESCE(t.merchant, t.raw_description, '')) = s.normalized_name
          AND s.is_active = TRUE
          AND NOT t.is_excluded
    """)

    # Un-exclude Venmo/Zelle/CashApp transactions — they're real payments, not pure pass-throughs
    op.execute("""
        UPDATE transactions
        SET is_excluded = FALSE,
            is_transfer = FALSE
        WHERE raw_description ~* 'venmo|zelle|cash app|cashapp'
    """)


def downgrade() -> None:
    op.drop_column("transactions", "is_subscription")

    # Re-exclude Venmo/Zelle
    op.execute("""
        UPDATE transactions
        SET is_excluded = TRUE,
            is_transfer = TRUE
        WHERE raw_description ~* 'venmo|zelle|cash app|cashapp'
    """)
