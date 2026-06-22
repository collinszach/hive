"""add paper-trading watchlist + daily candle cache

First migration for the paper-trading signal engine. Creates the user-curated
watchlist and the daily OHLCV cache the backtester learns from. Both are fully
independent of the real-money SnapTrade tables.

Revision ID: x2y3z4a5b6c7
Revises: w1x2y3z4a5b6
Branch Labels: None
Depends On: None
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "x2y3z4a5b6c7"
down_revision = "w1x2y3z4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "paper_watchlist_symbols",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "symbol", name="uq_paper_watchlist_user_symbol"),
    )
    op.create_index("ix_paper_watchlist_symbols_user_id", "paper_watchlist_symbols", ["user_id"])
    op.create_index("ix_paper_watchlist_symbols_symbol", "paper_watchlist_symbols", ["symbol"])

    op.create_table(
        "paper_candles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("open", sa.Numeric(16, 4), nullable=True),
        sa.Column("high", sa.Numeric(16, 4), nullable=True),
        sa.Column("low", sa.Numeric(16, 4), nullable=True),
        sa.Column("close", sa.Numeric(16, 4), nullable=True),
        sa.Column("volume", sa.Numeric(20, 2), nullable=True),
        sa.Column("adj_close", sa.Numeric(16, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("symbol", "date", name="uq_paper_candle_symbol_date"),
    )
    op.create_index("ix_paper_candles_symbol", "paper_candles", ["symbol"])
    op.create_index("ix_paper_candles_date", "paper_candles", ["date"])


def downgrade() -> None:
    op.drop_index("ix_paper_candles_date", table_name="paper_candles")
    op.drop_index("ix_paper_candles_symbol", table_name="paper_candles")
    op.drop_table("paper_candles")
    op.drop_index("ix_paper_watchlist_symbols_symbol", table_name="paper_watchlist_symbols")
    op.drop_index("ix_paper_watchlist_symbols_user_id", table_name="paper_watchlist_symbols")
    op.drop_table("paper_watchlist_symbols")
