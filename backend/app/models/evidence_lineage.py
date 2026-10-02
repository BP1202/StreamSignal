import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class EvidenceLineageEvent(Base):
    """
    Immutable Evidence Lineage Event audit record.
    Tracks chronological provenance transformations, actor types, services, and payloads.
    No update or delete endpoints are ever exposed for lineage events.
    """
    __tablename__ = "evidence_lineage_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    signal_case_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(100), nullable=False, index=True)
    actor_type = Column(String(50), nullable=False)
    actor_id = Column(String(100), nullable=False)
    source_service = Column(String(100), nullable=False)
    summary = Column(Text, nullable=False)
    structured_payload_json = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # Relationships
    report = relationship("Report", foreign_keys=[signal_case_id], back_populates="lineage_events")
