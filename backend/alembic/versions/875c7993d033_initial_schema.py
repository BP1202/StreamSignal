"""initial schema baseline

Revision ID: 875c7993d033
Revises: 
Create Date: 2026-09-30 00:22:44.518223

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '875c7993d033'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Initial schema baseline (no custom application tables yet)."""
    pass


def downgrade() -> None:
    """Downgrade initial schema baseline."""
    pass
