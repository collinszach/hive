"""add points_redemptions

Points spent, which the ledger has never recorded. ``points_ledger`` only tracks
points earned and its recompute task rewrites a row per transaction, so redemptions
need their own table rather than negative entries there.

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
Create Date: 2026-09-12
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "f0a1b2c3d4e5"
down_revision = "e9f0a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "points_redemptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=True),
        sa.Column("program", sa.Text(), nullable=True),
        sa.Column("points_spent", sa.Numeric(12, 2), nullable=True),
        sa.Column("cash_value_avoided", sa.Numeric(12, 2), nullable=True),
        sa.Column("fees_paid", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("redeemed_on", sa.Date(), nullable=False),
        sa.Column("merchant", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="candidate"),
        sa.Column("detection_reason", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("transaction_id", name="uq_points_redemption_transaction"),
    )
    # Balance math reads confirmed redemptions per program since a snapshot date.
    op.create_index(
        "ix_points_redemptions_program_date",
        "points_redemptions",
        ["program", "redeemed_on"],
    )
    # The review queue reads candidates newest-first.
    op.create_index(
        "ix_points_redemptions_status",
        "points_redemptions",
        ["status", "redeemed_on"],
    )


def downgrade() -> None:
    op.drop_index("ix_points_redemptions_status", table_name="points_redemptions")
    op.drop_index("ix_points_redemptions_program_date", table_name="points_redemptions")
    op.drop_table("points_redemptions")
