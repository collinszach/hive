"""add planning tables (scenarios, assumptions, income streams) + extend plan_events

Revision ID: v0w1x2y3z4a5
Revises: u9v0w1x2y3z4
Branch Labels: None
Depends On: None
Create Date: 2026-06-02
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "v0w1x2y3z4a5"
down_revision = "u9v0w1x2y3z4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_scenarios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("is_baseline", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_scenarios_user_id", "plan_scenarios", ["user_id"])

    op.create_table(
        "plan_assumptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "scenario_id",
            UUID(as_uuid=True),
            sa.ForeignKey("plan_scenarios.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("annual_return_pct", sa.Numeric(5, 2), server_default="6.00"),
        sa.Column("annual_inflation_pct", sa.Numeric(5, 2), server_default="3.00"),
        sa.Column("effective_tax_rate_pct", sa.Numeric(5, 2), server_default="0.00"),
        sa.Column("emergency_floor", sa.Numeric(12, 2), server_default="0.00"),
        sa.Column("auto_invest_surplus", sa.Boolean(), server_default="false"),
        sa.Column("band_spread_pct", sa.Numeric(5, 2), server_default="3.00"),
        sa.Column("base_monthly_expenses", sa.Numeric(12, 2), nullable=True),
    )

    op.create_table(
        "income_streams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "scenario_id",
            UUID(as_uuid=True),
            sa.ForeignKey("plan_scenarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=True),
        sa.Column("monthly_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("frequency", sa.Text(), server_default="monthly"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("growth_pct", sa.Numeric(5, 2), server_default="0.00"),
        sa.Column("taxable", sa.Boolean(), server_default="true"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_income_streams_scenario_id", "income_streams", ["scenario_id"])

    # Extend plan_events for scenarios, direction, recurrence, and ranges.
    op.add_column("plan_events", sa.Column("scenario_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_plan_events_scenario_id", "plan_events", "plan_scenarios",
        ["scenario_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_plan_events_scenario_id", "plan_events", ["scenario_id"])
    op.add_column("plan_events", sa.Column("kind", sa.Text(), server_default="outflow"))
    op.add_column("plan_events", sa.Column("target", sa.Text(), server_default="cash"))
    op.add_column("plan_events", sa.Column("recurrence", sa.Text(), server_default="once"))
    op.add_column("plan_events", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("plan_events", sa.Column("growth_pct", sa.Numeric(5, 2), server_default="0.00"))


def downgrade() -> None:
    op.drop_column("plan_events", "growth_pct")
    op.drop_column("plan_events", "end_date")
    op.drop_column("plan_events", "recurrence")
    op.drop_column("plan_events", "target")
    op.drop_column("plan_events", "kind")
    op.drop_index("ix_plan_events_scenario_id", table_name="plan_events")
    op.drop_constraint("fk_plan_events_scenario_id", "plan_events", type_="foreignkey")
    op.drop_column("plan_events", "scenario_id")

    op.drop_index("ix_income_streams_scenario_id", table_name="income_streams")
    op.drop_table("income_streams")
    op.drop_table("plan_assumptions")
    op.drop_index("ix_plan_scenarios_user_id", table_name="plan_scenarios")
    op.drop_table("plan_scenarios")
