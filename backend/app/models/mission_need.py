"""
StreamSignal — Mission Need Model
A researcher-created, database-backed request to address a recurring evidence gap
through citizen evidence collection. Mission Needs form the authoritative link between
Evidence Gap Intelligence analysis and the bounded Evidence Mission Agent.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class MissionNeed(Base):
    """
    Persisted Mission Need model.
    Represents a researcher's explicit, rationale-backed decision to request
    evidence collection for a specific missing dimension observed in real SignalCases.

    Lifecycle: IDENTIFIED → REVIEWED → APPROVED → MISSION_PLANNED → ACTIVE → FULFILLED → CLOSED

    Security rules:
    - Only researchers can create and approve MissionNeeds.
    - The Evidence Mission Agent may only read APPROVED MissionNeeds.
    - The agent may never approve, modify, or fulfill a MissionNeed directly.
    """
    __tablename__ = "mission_needs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # The evidence dimension this need targets (e.g. 'flow_condition', 'photo')
    evidence_gap_dimension = Column(String(64), nullable=False, index=True)

    # Researcher-authored metadata
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    rationale = Column(Text, nullable=False)  # Why researcher decided this matters

    # Lifecycle
    status = Column(String(64), nullable=False, default="IDENTIFIED", index=True)

    # Researcher identity (no PII required — free-form researcher identifier)
    created_by_researcher = Column(String(100), nullable=False, default="RESEARCHER")

    # Source data: JSON lists of affected case IDs and stream segments
    source_case_ids = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=list,
    )
    target_stream_segments = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=list,
    )

    # Required evidence dimensions for fulfillment (matches Mission template vocabulary)
    required_evidence = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=list,
    )

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    approved_at = Column(DateTime(timezone=True), nullable=True)
    fulfilled_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships: missions created to fulfil this need
    missions = relationship(
        "Mission",
        back_populates="mission_need",
        foreign_keys="Mission.mission_need_id",
    )
