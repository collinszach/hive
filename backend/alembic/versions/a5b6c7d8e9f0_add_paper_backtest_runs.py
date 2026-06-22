"""add paper_backtest_runs table

Durable record of each backtest: the train/validation windows, the selected params, and
train vs out-of-sample validation metrics.

Revision ID: a5b6c7d8e9f0
Revises: z4a5b6c7d8e9
Branch Labels: None
Depends On: None
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "a5b6c7d8e9f0"
down_revision = "z4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "paper_backtest_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("paper_portfolios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("train_start", sa.Date(), nullable=False),
        sa.Column("train_end", sa.Date(), nullable=False),
        sa.Column("validation_start", sa.Date(), nullable=False),
        sa.Column("validation_end", sa.Date(), nullable=False),
        sa.Column("selected_params", JSONB(), nullable=True),
        sa.Column("train_sharpe", sa.Numeric(10, 4), nullable=True),
        sa.Column("validation_sharpe", sa.Numeric(10, 4), nullable=True),
        sa.Column("validation_total_return", sa.Numeric(12, 6), nullable=True),
        sa.Column("validation_vs_benchmark", sa.Numeric(12, 6), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_paper_backtest_runs_portfolio_id", "paper_backtest_runs", ["portfolio_id"])


def downgrade() -> None:
    op.drop_index("ix_paper_backtest_runs_portfolio_id", table_name="paper_backtest_runs")
    op.drop_table("paper_backtest_runs")
