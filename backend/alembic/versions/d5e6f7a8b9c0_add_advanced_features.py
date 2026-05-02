"""Add advanced features: categorization_rules, subscriptions, goals, insights

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-04-05 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "categorization_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("match_type", sa.Text, nullable=False),
        sa.Column("match_value", sa.Text, nullable=False),
        sa.Column("amount_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("amount_max", sa.Numeric(10, 2), nullable=True),
        sa.Column("category", sa.Text, nullable=False),
        sa.Column("subcategory", sa.Text, nullable=True),
        sa.Column("priority", sa.Integer, nullable=False, server_default="100"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("merchant_name", sa.Text, nullable=False),
        sa.Column("normalized_name", sa.Text, nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.Text, nullable=False, server_default="USD"),
        sa.Column("frequency", sa.Text, nullable=False),
        sa.Column("category", sa.Text, nullable=True),
        sa.Column("subcategory", sa.Text, nullable=True),
        sa.Column("last_charged", sa.Date, nullable=True),
        sa.Column("next_expected", sa.Date, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_cancelled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("auto_detected", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("previous_amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_changed_at", sa.Date, nullable=True),
        sa.Column("annual_cost", sa.Numeric(10, 2), nullable=True),
        sa.Column("charge_count", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_subscriptions_normalized_name", "subscriptions", ["normalized_name"])

    op.create_table(
        "goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("goal_type", sa.Text, nullable=False),
        sa.Column("target_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("linked_account_id", sa.Text, nullable=True),
        sa.Column("linked_category", sa.Text, nullable=True),
        sa.Column("target_date", sa.Date, nullable=True),
        sa.Column("projected_completion_date", sa.Date, nullable=True),
        sa.Column("required_monthly_contribution", sa.Numeric(10, 2), nullable=True),
        sa.Column("on_track", sa.Boolean, nullable=True),
        sa.Column("is_completed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_archived", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("completed_at", sa.Date, nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "insights",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("insight_type", sa.Text, nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("delta_pct", sa.Numeric(6, 2), nullable=True),
        sa.Column("category", sa.Text, nullable=True),
        sa.Column("linked_entity_type", sa.Text, nullable=True),
        sa.Column("linked_entity_id", sa.Text, nullable=True),
        sa.Column("priority", sa.Text, nullable=False, server_default="'medium'"),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_dismissed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("dedup_key", sa.Text, nullable=True, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insights_is_dismissed", "insights", ["is_dismissed"])
    op.create_index("ix_insights_created_at", "insights", ["created_at"])


def downgrade() -> None:
    op.drop_table("insights")
    op.drop_table("goals")
    op.drop_table("subscriptions")
    op.drop_table("categorization_rules")
