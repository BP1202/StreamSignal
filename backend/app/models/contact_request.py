import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class ContactRequest(Base):
    """
    Researcher-Contributor Contact Request model.
    Facilitates safe, consent-based, opt-in communication between researchers
    and citizens for real-world clarification or evidence verification.
    
    Strictly isolates personally identifying contact information from open evidence:
    contact details are ONLY populated and readable when status is 'ACCEPTED'.
    """
    __tablename__ = "contact_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    signal_case_id = Column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contributor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contributors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    initiated_by = Column(String(32), nullable=False, default="RESEARCHER")  # "RESEARCHER" | "CONTRIBUTOR"
    researcher_id = Column(String(100), nullable=True)
    reason = Column(String(100), nullable=False)  # "CLARIFICATION", "ADDITIONAL_EVIDENCE", "FIELD_VERIFICATION", "GENERAL_INQUIRY"
    message = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="PENDING", index=True)  # "PENDING", "ACCEPTED", "DECLINED", "CANCELLED"

    # Shared contact details (Strictly null until contributor consents)
    shared_email = Column(String(255), nullable=True)
    shared_phone = Column(String(50), nullable=True)
    preferred_method = Column(String(50), nullable=True)  # "EMAIL", "PHONE", "IN_APP"
    contributor_note = Column(Text, nullable=True)

    responded_at = Column(DateTime(timezone=True), nullable=True)
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
    report = relationship("Report", back_populates="contact_requests")
    contributor = relationship("Contributor", back_populates="contact_requests")
