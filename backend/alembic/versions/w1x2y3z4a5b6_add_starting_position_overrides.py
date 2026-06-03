"""add starting cash/investments overrides to plan assumptions

Lets a scenario assume a starting position ("anticipated net cash at the start of
the program") instead of pulling t=0 balances from live accounts. NULL keeps the
existing behavior (use live balances).

Revision ID: w1x2y3z4a5b6
Revises: v0w1x2y3z4a5
Branch Labels: None
Depends On: None
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = "w1x2y3z4a5b6"
down_revision = "v0w1x2y3z4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "plan_assumptions",
        sa.Column("starting_cash_override", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "plan_assumptions",
        sa.Column("starting_investments_override", sa.Numeric(12, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("plan_assumptions", "starting_investments_override")
    op.drop_column("plan_assumptions", "starting_cash_override")
