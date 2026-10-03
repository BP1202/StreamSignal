"""
StreamSignal — Evidence Mission & Agent Action Schemas
Defines deterministic schemas for missions, agent actions, evidence items, and audit trails.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class MissionType(str, Enum):
    AFTER_RAIN_STREAM_CHECK = "AFTER_RAIN_STREAM_CHECK"
    EVIDENCE_CLARIFICATION = "EVIDENCE_CLARIFICATION"
    PLACE_EVIDENCE_SNAPSHOT = "PLACE_EVIDENCE_SNAPSHOT"


class MissionStatus(str, Enum):
    DISCOVERING = "DISCOVERING"
    MISSION_PLANNED = "MISSION_PLANNED"
    WAITING_FOR_CITIZEN = "WAITING_FOR_CITIZEN"
    COLLECTING_EVIDENCE = "COLLECTING_EVIDENCE"
    VALIDATING_EVIDENCE = "VALIDATING_EVIDENCE"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"
    READY_FOR_SUBMISSION = "READY_FOR_SUBMISSION"
    SUBMITTED = "SUBMITTED"
    RESEARCH_REVIEW = "RESEARCH_REVIEW"


class MissionAgentActionType(str, Enum):
    REQUEST_PHOTO = "REQUEST_PHOTO"
    REQUEST_VIDEO = "REQUEST_VIDEO"
    REQUEST_OBSERVATION = "REQUEST_OBSERVATION"
    REQUEST_CLARIFICATION = "REQUEST_CLARIFICATION"
    VALIDATE_EVIDENCE = "VALIDATE_EVIDENCE"
    READY_FOR_SUBMISSION = "READY_FOR_SUBMISSION"
    SUBMIT = "SUBMIT"


class MissionAgentAction(BaseModel):
    action_type: MissionAgentActionType
    observation_type: Optional[str] = None
    reason: str
    user_message: str
    required_evidence: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    micro_learning: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MissionEvidenceSubmission(BaseModel):
    description: Optional[str] = None
    water_appearance: Optional[str] = None
    flow_condition: Optional[str] = None
    odor: Optional[str] = None
    foam_observed: Optional[bool] = None
    litter_observed: Optional[bool] = None
    dead_wildlife_observed: Optional[bool] = None
    media_id: Optional[UUID] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    observed_at: Optional[datetime] = None

    @field_validator("media_id", mode="before")
    @classmethod
    def parse_media_id(cls, v: Any) -> Optional[UUID]:
        if v is None or v == "":
            return None
        if isinstance(v, UUID):
            return v
        try:
            return UUID(str(v).strip())
        except (ValueError, AttributeError):
            return None

    model_config = ConfigDict(extra="ignore")


class AgentAuditItem(BaseModel):
    id: UUID
    mission_id: UUID
    actor: str
    action_type: str
    tool_used: str
    input_reference: Optional[str] = None
    output_reference: Optional[str] = None
    reason: str
    result_summary: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MissionResponse(BaseModel):
    id: UUID
    mission_type: MissionType
    status: MissionStatus
    title: str
    purpose: str
    research_need: str
    research_need_source: str
    research_need_reference: Optional[str] = None
    signal_case_id: Optional[UUID] = None
    contributor_id: Optional[UUID] = None
    target_latitude: Optional[float] = None
    target_longitude: Optional[float] = None
    required_evidence: List[str] = Field(default_factory=list)
    collected_evidence: Dict[str, Any] = Field(default_factory=dict)
    missing_evidence: List[str] = Field(default_factory=list)
    validation_results: Dict[str, Any] = Field(default_factory=dict)
    next_action: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    updated_at: datetime
    audits: Optional[List[AgentAuditItem]] = None

    model_config = ConfigDict(from_attributes=True)


class MissionListResponse(BaseModel):
    missions: List[MissionResponse] = Field(default_factory=list)
    total: int = 0


class MissionCreateRequest(BaseModel):
    mission_type: MissionType
    title: Optional[str] = None
    purpose: Optional[str] = None
    research_need: Optional[str] = None
    research_need_source: str = "RESEARCHER_REQUIREMENT"
    research_need_reference: Optional[str] = None
    signal_case_id: Optional[UUID] = None
    target_latitude: Optional[float] = None
    target_longitude: Optional[float] = None
    required_evidence: Optional[List[str]] = None

    model_config = ConfigDict(extra="forbid")
