"""
StreamSignal — Mission Need Schemas
Pydantic schemas for researcher-approved evidence collection requests.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class MissionNeedStatus(str, Enum):
    IDENTIFIED = "IDENTIFIED"
    REVIEWED = "REVIEWED"
    APPROVED = "APPROVED"
    MISSION_PLANNED = "MISSION_PLANNED"
    ACTIVE = "ACTIVE"
    FULFILLED = "FULFILLED"
    CLOSED = "CLOSED"


# Allowed forward transitions in the MissionNeed lifecycle
MISSION_NEED_TRANSITIONS = {
    MissionNeedStatus.IDENTIFIED: [MissionNeedStatus.REVIEWED, MissionNeedStatus.CLOSED],
    MissionNeedStatus.REVIEWED: [MissionNeedStatus.APPROVED, MissionNeedStatus.CLOSED],
    MissionNeedStatus.APPROVED: [MissionNeedStatus.MISSION_PLANNED, MissionNeedStatus.CLOSED],
    MissionNeedStatus.MISSION_PLANNED: [MissionNeedStatus.ACTIVE, MissionNeedStatus.CLOSED],
    MissionNeedStatus.ACTIVE: [MissionNeedStatus.FULFILLED, MissionNeedStatus.CLOSED],
    MissionNeedStatus.FULFILLED: [MissionNeedStatus.CLOSED],
    MissionNeedStatus.CLOSED: [],
}


class MissionNeedCreate(BaseModel):
    """Request schema for researcher-created Mission Need."""
    evidence_gap_dimension: str = Field(
        ...,
        min_length=2,
        max_length=64,
        description="The evidence dimension to address (e.g. 'flow_condition', 'photo')",
    )
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=10, max_length=2000)
    rationale: str = Field(
        ...,
        min_length=20,
        max_length=5000,
        description="Researcher's explicit reason this gap should be addressed. Required provenance.",
    )
    source_case_ids: List[str] = Field(
        default_factory=list,
        description="UUIDs of real SignalCases that motivated this need",
    )
    target_stream_segments: List[str] = Field(default_factory=list)
    required_evidence: List[str] = Field(
        default_factory=list,
        description="Evidence dimensions citizens must collect",
    )
    created_by_researcher: str = Field(
        default="RESEARCHER",
        max_length=100,
        description="Researcher identifier — no PII required",
    )

    @field_validator("rationale")
    @classmethod
    def rationale_not_placeholder(cls, v: str) -> str:
        placeholder_words = {"todo", "tbd", "n/a", "na", "test", "placeholder"}
        if v.lower().strip() in placeholder_words:
            raise ValueError("Researcher rationale must be a substantive explanation, not a placeholder.")
        return v


class MissionNeedResponse(BaseModel):
    """Response schema for a persisted Mission Need."""
    id: UUID
    evidence_gap_dimension: str
    title: str
    description: str
    rationale: str
    status: MissionNeedStatus
    created_by_researcher: str
    source_case_ids: List[str]
    target_stream_segments: List[str]
    required_evidence: List[str]
    created_at: datetime
    approved_at: Optional[datetime] = None
    fulfilled_at: Optional[datetime] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MissionNeedListResponse(BaseModel):
    needs: List[MissionNeedResponse]
    total: int

    model_config = ConfigDict(from_attributes=True)
