import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Report(Base):
    """
    Citizen Evidence Report model.
    Captures primary environmental observations of urban freshwater conditions.
    """
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    observed_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    description = Column(Text, nullable=False)
    water_appearance = Column(String(100), nullable=True)
    odor = Column(String(100), nullable=True)
    flow_condition = Column(String(50), nullable=True)
    foam_observed = Column(Boolean, nullable=False, default=False)
    litter_observed = Column(Boolean, nullable=False, default=False)
    dead_wildlife_observed = Column(Boolean, nullable=False, default=False)
    status = Column(String(50), nullable=False, default="SUBMITTED", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    media = relationship("ReportMedia", back_populates="report", cascade="all, delete-orphan")
