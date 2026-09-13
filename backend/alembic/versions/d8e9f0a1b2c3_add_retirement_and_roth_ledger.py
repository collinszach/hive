"""add is_retirement flag, liquid net worth columns, and roth contribution ledger

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Branch Labels: None
Depends On: None
Create Date: 2026-07-06
"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "d8e9f0a1b2c3"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("is_retirement", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.add_column(
        "net_worth_snapshots",
        sa.Column("total_liquid_assets", sa.Numeric(14, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "net_worth_snapshots",
        sa.Column(
            "liquid_net_worth",
            sa.Numeric(14, 2),
            sa.Computed("total_liquid_assets - total_liabilities", persisted=True),
        ),
    )

    op.create_table(
        "roth_contributions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=False, index=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("is_withdrawal", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("contributed_on", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("roth_contributions")
    op.drop_column("net_worth_snapshots", "liquid_net_worth")
    op.drop_column("net_worth_snapshots", "total_liquid_assets")
    op.drop_column("accounts", "is_retirement")
