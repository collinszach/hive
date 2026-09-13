"""add trip_transactions

Links real transactions to a trip so planned spend can be checked against actual.

Revision ID: 8c4d1e6b9f27
Revises: 7f3c9a1b2d4e
Create Date: 2026-09-12
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "8c4d1e6b9f27"
down_revision = "7f3c9a1b2d4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trip_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        # One trip per transaction: two trips claiming one charge would double-count it.
        sa.UniqueConstraint("transaction_id", name="uq_trip_transaction_transaction"),
    )
    op.create_index("ix_trip_transactions_trip", "trip_transactions", ["trip_id"])


def downgrade() -> None:
    op.drop_index("ix_trip_transactions_trip", table_name="trip_transactions")
    op.drop_table("trip_transactions")
