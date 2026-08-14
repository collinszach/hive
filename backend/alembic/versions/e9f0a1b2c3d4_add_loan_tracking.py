"""add loans and loan_entries tables for manual loan tracking

Revision ID: e9f0a1b2c3d4
Revises: c7d8e9f0a1b2
Branch Labels: None
Depends On: None
Create Date: 2026-08-14
"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "e9f0a1b2c3d4"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "loans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("interest_rate", sa.Numeric(6, 4), nullable=True),
        sa.Column("origination_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "loan_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("loan_id", UUID(as_uuid=True), sa.ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("entry_type", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "entry_type IN ('disbursement', 'payment', 'interest')",
            name="ck_loan_entries_entry_type",
        ),
    )


def downgrade() -> None:
    op.drop_table("loan_entries")
    op.drop_table("loans")
