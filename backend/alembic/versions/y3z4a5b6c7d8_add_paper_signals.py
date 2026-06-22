"""add paper_signals table

Stores point-in-time trading signals from the signal engine. ``source`` separates
backtest-replayed signals from live forward signals in one table.

Revision ID: y3z4a5b6c7d8
Revises: x2y3z4a5b6c7
Branch Labels: None
Depends On: None
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "y3z4a5b6c7d8"
down_revision = "x2y3z4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "paper_signals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("signal_score", sa.Numeric(6, 4), nullable=False),
        sa.Column("signal_label", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Numeric(6, 4), nullable=False),
        sa.Column("regime_label", sa.Text(), nullable=True),
        sa.Column("indicators", JSONB(), nullable=True),
        sa.Column("source", sa.Text(), server_default="live", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("symbol", "as_of", "source", name="uq_paper_signal_symbol_asof_source"),
    )
    op.create_index("ix_paper_signals_symbol", "paper_signals", ["symbol"])
    op.create_index("ix_paper_signals_as_of", "paper_signals", ["as_of"])


def downgrade() -> None:
    op.drop_index("ix_paper_signals_as_of", table_name="paper_signals")
    op.drop_index("ix_paper_signals_symbol", table_name="paper_signals")
    op.drop_table("paper_signals")
