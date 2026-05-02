"""fix points_ledger account_id cascade

Revision ID: l8m9n0o1p2q3
Revises: k7l8m9n0o1p2
Create Date: 2026-04-30 00:00:00.000000

"""
from alembic import op

revision = "l8m9n0o1p2q3"
down_revision = "k7l8m9n0o1p2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing FK constraint and re-create with ON DELETE CASCADE
    op.drop_constraint(
        "points_ledger_account_id_fkey", "points_ledger", type_="foreignkey"
    )
    op.create_foreign_key(
        "points_ledger_account_id_fkey",
        "points_ledger",
        "accounts",
        ["account_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "points_ledger_account_id_fkey", "points_ledger", type_="foreignkey"
    )
    op.create_foreign_key(
        "points_ledger_account_id_fkey",
        "points_ledger",
        "accounts",
        ["account_id"],
        ["id"],
    )
