"""add paper portfolio / position / trade / performance-snapshot tables

The forward paper-trading bookkeeping (also reused by the backtester's transient
backtest portfolios). All FKs cascade on portfolio delete.

Revision ID: z4a5b6c7d8e9
Revises: y3z4a5b6c7d8
Branch Labels: None
Depends On: None
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "z4a5b6c7d8e9"
down_revision = "y3z4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "paper_portfolios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.Text(), server_default="Paper Portfolio", nullable=False),
        sa.Column("status", sa.Text(), server_default="live", nullable=False),
        sa.Column("starting_cash", sa.Numeric(16, 2), nullable=False),
        sa.Column("current_cash", sa.Numeric(16, 2), nullable=False),
        sa.Column("strategy_params", JSONB(), nullable=True),
        sa.Column("benchmark_symbol", sa.Text(), server_default="SPY", nullable=False),
        sa.Column("benchmark_start_price", sa.Numeric(16, 4), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("evaluation_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_paper_portfolios_user_id", "paper_portfolios", ["user_id"])

    op.create_table(
        "paper_positions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(20, 6), nullable=False),
        sa.Column("avg_cost", sa.Numeric(16, 4), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("portfolio_id", "symbol", name="uq_paper_position_portfolio_symbol"),
    )
    op.create_index("ix_paper_positions_portfolio_id", "paper_positions", ["portfolio_id"])

    op.create_table(
        "paper_trades",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("side", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(20, 6), nullable=False),
        sa.Column("price", sa.Numeric(16, 4), nullable=False),
        sa.Column("executor_type", sa.Text(), server_default="simulated", nullable=False),
        sa.Column("signal_score", sa.Numeric(6, 4), nullable=True),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_paper_trades_portfolio_id", "paper_trades", ["portfolio_id"])
    op.create_index("ix_paper_trades_symbol", "paper_trades", ["symbol"])
    op.create_index("ix_paper_trades_as_of", "paper_trades", ["as_of"])

    op.create_table(
        "paper_performance_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("cash", sa.Numeric(16, 2), nullable=False),
        sa.Column("positions_value", sa.Numeric(16, 2), nullable=False),
        sa.Column("portfolio_value", sa.Numeric(16, 2), nullable=False),
        sa.Column("benchmark_value", sa.Numeric(16, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("portfolio_id", "as_of", name="uq_paper_perf_portfolio_asof"),
    )
    op.create_index("ix_paper_perf_portfolio_id", "paper_performance_snapshots", ["portfolio_id"])
    op.create_index("ix_paper_perf_as_of", "paper_performance_snapshots", ["as_of"])


def downgrade() -> None:
    op.drop_index("ix_paper_perf_as_of", table_name="paper_performance_snapshots")
    op.drop_index("ix_paper_perf_portfolio_id", table_name="paper_performance_snapshots")
    op.drop_table("paper_performance_snapshots")
    op.drop_index("ix_paper_trades_as_of", table_name="paper_trades")
    op.drop_index("ix_paper_trades_symbol", table_name="paper_trades")
    op.drop_index("ix_paper_trades_portfolio_id", table_name="paper_trades")
    op.drop_table("paper_trades")
    op.drop_index("ix_paper_positions_portfolio_id", table_name="paper_positions")
    op.drop_table("paper_positions")
    op.drop_index("ix_paper_portfolios_user_id", table_name="paper_portfolios")
    op.drop_table("paper_portfolios")
