"""add google_id and email to users

Revision ID: s7t8u9v0w1x2
Revises: r6s7t8u9v0w1
Branch Labels: None
Depends On: None
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = "s7t8u9v0w1x2"
down_revision = "r6s7t8u9v0w1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_id", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("email", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_users_google_id", "users", ["google_id"])


def downgrade() -> None:
    op.drop_constraint("uq_users_google_id", "users", type_="unique")
    op.drop_column("users", "email")
    op.drop_column("users", "google_id")
