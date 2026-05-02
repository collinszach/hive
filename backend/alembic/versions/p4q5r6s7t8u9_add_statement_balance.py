"""Add statement_balance to accounts

Revision ID: p4q5r6s7t8u9
Revises: o3p4q5r6s7t8
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa

revision = "p4q5r6s7t8u9"
down_revision = "o3p4q5r6s7t8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("statement_balance", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("accounts", "statement_balance")
