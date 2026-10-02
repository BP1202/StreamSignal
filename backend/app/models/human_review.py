import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class HumanReview(Base):
    """
    Human Review entity for research workspace decision records.
    Captures auditable human decisions, mandatory rationales, linked case relationships,
    and explicit evidence-state transitions without automated diagnosis.
    """
    __tablename__ = "human_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    signal_case_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    reviewer_id = Column(String(100), nullable=False, default="R-042")
    outcome = Column(String(50), nullable=False)
    rationale = Column(Text, nullable=False)
    linked_case_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="SET NULL"),
        nullable=True,
    )
    evidence_state_before = Column(String(50), nullable=False)
    evidence_state_after = Column(String(50), nullable=False)
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
    report = relationship("Report", foreign_keys=[report_id], back_populates="reviews")
    linked_case = relationship("Report", foreign_keys=[linked_case_id])
