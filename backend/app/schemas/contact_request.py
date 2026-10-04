"""
StreamSignal — Contact Request Schemas (Issue 36)
Defines contracts for researcher-contributor contact workflows.
Strictly isolates personal contact information:
shared_email and shared_phone are only provided when status == 'ACCEPTED'.
"""

from datetime import datetime
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_validator


class ContactRequestCreate(BaseModel):
    """Payload for researcher initiating contact with a contributor for a SignalCase."""
    reason: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="Reason code: CLARIFICATION | ADDITIONAL_EVIDENCE | FIELD_VERIFICATION | GENERAL_INQUIRY",
    )
    message: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Clear, non-coercive message to citizen explaining requested information",
    )

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        cleaned = v.strip().upper()
        allowed = {"CLARIFICATION", "ADDITIONAL_EVIDENCE", "FIELD_VERIFICATION", "GENERAL_INQUIRY"}
        if cleaned not in allowed:
            raise ValueError(f"Reason must be one of {sorted(list(allowed))}")
        return cleaned

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("Message must contain at least 5 characters.")
        return cleaned


class CitizenContactInitiate(BaseModel):
    """Payload for citizen initiating contact with researchers on their observation."""
    reason: str = Field(
        default="ADDITIONAL_EVIDENCE",
        min_length=3,
        max_length=100,
        description="Reason for reaching out: ADDITIONAL_EVIDENCE | CLARIFICATION | GENERAL_INQUIRY",
    )
    message: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Citizen message or additional contextual note",
    )
    shared_email: Optional[str] = Field(default=None, max_length=255)
    shared_phone: Optional[str] = Field(default=None, max_length=50)
    preferred_method: Optional[Literal["EMAIL", "PHONE", "IN_APP"]] = "EMAIL"
    note: Optional[str] = Field(default=None, max_length=1000)


class ContactResponseSubmit(BaseModel):
    """Payload for contributor accepting or declining a contact request."""
    action: Literal["ACCEPT", "DECLINE"]
    shared_email: Optional[str] = Field(default=None, max_length=255)
    shared_phone: Optional[str] = Field(default=None, max_length=50)
    preferred_method: Optional[Literal["EMAIL", "PHONE", "IN_APP"]] = "EMAIL"
    contributor_note: Optional[str] = Field(default=None, max_length=1000)


class ContactRequestResponse(BaseModel):
    """
    Public/Authorized contact request representation.
    Ensures shared_email and shared_phone are omitted unless status == 'ACCEPTED'.
    """
    id: UUID
    signal_case_id: UUID
    contributor_id: Optional[UUID] = None
    contributor_handle: Optional[str] = None
    initiated_by: str
    researcher_id: Optional[str] = None
    reason: str
    message: str
    status: str
    shared_email: Optional[str] = None
    shared_phone: Optional[str] = None
    preferred_method: Optional[str] = None
    contributor_note: Optional[str] = None
    responded_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
