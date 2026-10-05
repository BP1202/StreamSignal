"""create contact_requests table and add contributor_id to reports

Revision ID: 976f57a048f7
Revises: fb97a1f0ec5b
Create Date: 2026-10-05 00:33:56.161174

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '976f57a048f7'
down_revision: Union[str, Sequence[str], None] = 'fb97a1f0ec5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add contributor_id to reports
    op.add_column(
        'reports',
        sa.Column('contributor_id', sa.UUID(), sa.ForeignKey('contributors.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index(op.f('ix_reports_contributor_id'), 'reports', ['contributor_id'], unique=False)

    # 2. Create contact_requests table
    op.create_table(
        'contact_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('signal_case_id', sa.UUID(), sa.ForeignKey('reports.id', ondelete='CASCADE'), nullable=False),
        sa.Column('contributor_id', sa.UUID(), sa.ForeignKey('contributors.id', ondelete='SET NULL'), nullable=True),
        sa.Column('initiated_by', sa.String(length=32), nullable=False),
        sa.Column('researcher_id', sa.String(length=100), nullable=True),
        sa.Column('reason', sa.String(length=100), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('shared_email', sa.String(length=255), nullable=True),
        sa.Column('shared_phone', sa.String(length=50), nullable=True),
        sa.Column('preferred_method', sa.String(length=50), nullable=True),
        sa.Column('contributor_note', sa.Text(), nullable=True),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_contact_requests_id'), 'contact_requests', ['id'], unique=False)
    op.create_index(op.f('ix_contact_requests_signal_case_id'), 'contact_requests', ['signal_case_id'], unique=False)
    op.create_index(op.f('ix_contact_requests_contributor_id'), 'contact_requests', ['contributor_id'], unique=False)
    op.create_index(op.f('ix_contact_requests_status'), 'contact_requests', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_contact_requests_status'), table_name='contact_requests')
    op.drop_index(op.f('ix_contact_requests_contributor_id'), table_name='contact_requests')
    op.drop_index(op.f('ix_contact_requests_signal_case_id'), table_name='contact_requests')
    op.drop_index(op.f('ix_contact_requests_id'), table_name='contact_requests')
    op.drop_table('contact_requests')

    op.drop_index(op.f('ix_reports_contributor_id'), table_name='reports')
    op.drop_column('reports', 'contributor_id')
