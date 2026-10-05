import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Contributor(Base):
    """
    Persistent Contributor Identity model.
    Enables low-friction, non-identifying Level 1 citizen participation
    and clean in-place upgrade to Level 2 registered accounts without duplicating history.
    """
    __tablename__ = "contributors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    contributor_id = Column(String(32), unique=True, index=True, nullable=False)
    display_name = Column(String(64), unique=True, index=True, nullable=False)
    account_level = Column(String(32), nullable=False, default="LEVEL_1_CONTRIBUTOR", index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    oidc_subject = Column(String(255), unique=True, index=True, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    missions = relationship("Mission", back_populates="contributor")
    reports = relationship("Report", back_populates="contributor")
    contact_requests = relationship("ContactRequest", back_populates="contributor")
