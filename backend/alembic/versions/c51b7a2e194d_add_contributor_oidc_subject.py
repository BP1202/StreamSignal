"""add optional verified OIDC identity to contributors

Revision ID: c51b7a2e194d
Revises: 976f57a048f7
Create Date: 2026-10-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c51b7a2e194d"
down_revision: Union[str, Sequence[str], None] = "976f57a048f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("contributors", sa.Column("oidc_subject", sa.String(length=255), nullable=True))
    op.create_index("ix_contributors_oidc_subject", "contributors", ["oidc_subject"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_contributors_oidc_subject", table_name="contributors")
    op.drop_column("contributors", "oidc_subject")
