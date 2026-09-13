"""add trips, trip_legs, travel_options

Phase 1 of the award travel planner: the comparison board. See docs/TRAVEL-SPEC.md.

Revision ID: a1b2c3d4e5f6
Revises: f0a1b2c3d4e5
Create Date: 2026-09-12
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trips",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("destination", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("travelers", sa.Integer(), server_default="1", nullable=False),
        sa.Column("status", sa.Text(), server_default="dreaming", nullable=False),
        sa.Column("cash_budget", sa.Numeric(12, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_trips_status_start", "trips", ["status", "start_date"])

    op.create_table(
        "trip_legs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("origin", sa.Text(), nullable=True),
        sa.Column("destination", sa.Text(), nullable=True),
        sa.Column("leg_date", sa.Date(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_trip_legs_trip", "trip_legs", ["trip_id", "sort_order"])

    op.create_table(
        "travel_options",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("leg_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("trip_legs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.Text(), server_default="manual_cash", nullable=False),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("cash_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("points_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("program", sa.Text(), nullable=True),
        sa.Column("fees", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("quoted_on", sa.Date(), nullable=True),
        sa.Column("is_selected", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_travel_options_leg", "travel_options", ["leg_id"])


def downgrade() -> None:
    op.drop_index("ix_travel_options_leg", table_name="travel_options")
    op.drop_table("travel_options")
    op.drop_index("ix_trip_legs_trip", table_name="trip_legs")
    op.drop_table("trip_legs")
    op.drop_index("ix_trips_status_start", table_name="trips")
    op.drop_table("trips")
