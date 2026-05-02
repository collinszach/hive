"""add billing dates to accounts, create contacts and expense_shares tables

Revision ID: m1n2o3p4q5r6
Revises: l8m9n0o1p2q3
Create Date: 2026-05-01 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "m1n2o3p4q5r6"
down_revision = "l8m9n0o1p2q3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add billing cycle columns to accounts (nullable — only credit cards use them)
    op.add_column("accounts", sa.Column("statement_close_day", sa.Integer(), nullable=True))
    op.add_column("accounts", sa.Column("payment_due_day", sa.Integer(), nullable=True))

    # People you share expenses with
    op.create_table(
        "contacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Person-based expense shares (distinct from category-based transaction_splits)
    op.create_table(
        "expense_shares",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "transaction_id",
            UUID(as_uuid=True),
            sa.ForeignKey("transactions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "contact_id",
            UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "settlement_transaction_id",
            UUID(as_uuid=True),
            sa.ForeignKey("transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_expense_shares_transaction_id", "expense_shares", ["transaction_id"])
    op.create_index("ix_expense_shares_contact_id", "expense_shares", ["contact_id"])
    op.create_index("ix_expense_shares_status", "expense_shares", ["status"])


def downgrade() -> None:
    op.drop_table("expense_shares")
    op.drop_table("contacts")
    op.drop_column("accounts", "payment_due_day")
    op.drop_column("accounts", "statement_close_day")
