import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class Mission(Base):
    """
    Persisted Evidence Mission model.
    Represents targeted, bounded citizen missions derived from real research evidence needs.
    """
    __tablename__ = "missions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    mission_type = Column(String(64), index=True, nullable=False)
    status = Column(String(64), index=True, nullable=False, default="WAITING_FOR_CITIZEN")
    title = Column(String(255), nullable=False)
    purpose = Column(Text, nullable=False)
    research_need = Column(Text, nullable=False)
    research_need_source = Column(String(64), nullable=False, index=True)
    research_need_reference = Column(String(100), nullable=True)

    signal_case_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    mission_need_id = Column(
        UUID(as_uuid=True),
        ForeignKey("mission_needs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    contributor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contributors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    target_latitude = Column(Float, nullable=True)
    target_longitude = Column(Float, nullable=True)

    required_evidence = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=list,
    )
    collected_evidence = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=dict,
    )
    missing_evidence = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=list,
    )
    validation_results = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=dict,
    )
    next_action = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=dict,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    contributor = relationship("Contributor", back_populates="missions")
    signal_case = relationship("Report")
    mission_need = relationship(
        "MissionNeed",
        back_populates="missions",
        foreign_keys=[mission_need_id],
    )
    agent_audits = relationship(
        "AgentActionAudit",
        back_populates="mission",
        cascade="all, delete-orphan",
        order_by="AgentActionAudit.created_at.asc()",
    )


class AgentActionAudit(Base):
    """
    Immutable audit trail of actions taken by the Evidence Mission Agent.
    Guarantees full explainability: what tool was invoked, for what reason, and with what result.
    """
    __tablename__ = "agent_action_audits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    mission_id = Column(
        UUID(as_uuid=True),
        ForeignKey("missions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor = Column(String(64), nullable=False, default="AGENT")
    action_type = Column(String(64), nullable=False, index=True)
    tool_used = Column(String(64), nullable=False)
    input_reference = Column(String(255), nullable=True)
    output_reference = Column(String(255), nullable=True)
    reason = Column(Text, nullable=False)
    result_summary = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # Relationships
    mission = relationship("Mission", back_populates="agent_audits")
