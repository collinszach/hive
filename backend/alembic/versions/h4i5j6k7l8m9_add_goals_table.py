"""add_goals_table

Revision ID: h4i5j6k7l8m9
Revises: a2b3c4d5e6f7
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'h4i5j6k7l8m9'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old goals table (UUID PK, text goal_type, legacy columns)
    op.drop_table('goals')

    op.create_table(
        'goals',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('goal_type', sa.Enum('save', 'spend_under', 'pay_down', name='goaltype'), nullable=False),
        sa.Column('target_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('current_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('account_id', UUID(as_uuid=True), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('deadline', sa.Date(), nullable=True),
        sa.Column('pinned', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('archived', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('goals')
    op.execute("DROP TYPE IF EXISTS goaltype")
