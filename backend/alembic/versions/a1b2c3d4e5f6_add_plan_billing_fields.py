"""Add plan_tier enum and billing fields to users table

Revision ID: a1b2c3d4e5f6
Revises: f2a3b4c5d6e7
Create Date: 2026-04-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the plan_tier enum type
    op.execute("CREATE TYPE plan_tier AS ENUM ('free', 'starter', 'pro')")

    # Add billing columns to users
    op.add_column("users", sa.Column(
        "plan",
        sa.Enum("free", "starter", "pro", name="plan_tier", create_type=False),
        nullable=False,
        server_default="free",
    ))
    op.add_column("users", sa.Column("stripe_customer_id", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("stripe_subscription_id", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("stripe_status", sa.Text(), nullable=True))
    op.add_column("users", sa.Column(
        "plan_period_end", sa.DateTime(timezone=True), nullable=True
    ))


def downgrade() -> None:
    op.drop_column("users", "plan_period_end")
    op.drop_column("users", "stripe_status")
    op.drop_column("users", "stripe_subscription_id")
    op.drop_column("users", "stripe_customer_id")
    op.drop_column("users", "plan")
    op.execute("DROP TYPE plan_tier")
