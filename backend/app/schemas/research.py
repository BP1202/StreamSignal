"""
StreamSignal — Research Workspace Schemas
Defines request and response schemas for the Research Evidence Workspace,
including Inbox listing, deterministic Why-This-Case explanations, Case Investigation,
Human Review decisions, immutable Evidence Lineage, and non-sensitive citizen impact status.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.evidence_quality import EvidenceQualityLevel, EvidenceQualityResponse
from app.schemas.triage import TriageAction, TriageReasonCode, TriageResponse
from app.schemas.media_observation import MediaVisualObservations
from app.schemas.contextual_evidence import PatternEchoResponse
from app.schemas.evidence_contract import EvidenceContractResponse


class WhySurfacedCategory(str, Enum):
    VISUAL_EVIDENCE = "VISUAL_EVIDENCE"
    HISTORICAL_CONTEXT = "HISTORICAL_CONTEXT"
    EVIDENCE_COMPLETENESS = "EVIDENCE_COMPLETENESS"
    TRIAGE_ACTION = "TRIAGE_ACTION"
    HUMAN_REVIEW_STATE = "HUMAN_REVIEW_STATE"


class WhySurfacedReason(BaseModel):
    category: WhySurfacedCategory = Field(
        ..., description="Deterministic category of the explanation."
    )
    summary: str = Field(
        ..., description="Human-readable explanation of why this case surfaced."
    )
    details: Optional[str] = Field(
        None, description="Optional supporting detail or specific evidence metric."
    )


class ResearchLocationSummary(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    stream_name: Optional[str] = None


# -----------------------------------------------------------------------------
# Issue 13: Enums for Human Review, Workflow Status, Evidence State & Lineage
# -----------------------------------------------------------------------------

class HumanReviewOutcome(str, Enum):
    SUPPORTS_REPORTED_OBSERVATION = "SUPPORTS_REPORTED_OBSERVATION"
    REQUEST_CLARIFICATION = "REQUEST_CLARIFICATION"
    REQUEST_MORE_EVIDENCE = "REQUEST_MORE_EVIDENCE"
    REQUEST_FIELD_VERIFICATION = "REQUEST_FIELD_VERIFICATION"
    MARK_RELATED_CASE = "MARK_RELATED_CASE"
    MARK_POTENTIAL_DUPLICATE = "MARK_POTENTIAL_DUPLICATE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    RESOLVED_NO_ACTION = "RESOLVED_NO_ACTION"


class CaseWorkflowStatus(str, Enum):
    AWAITING_REVIEW = "AWAITING_REVIEW"
    REVIEWED = "REVIEWED"
    AWAITING_CITIZEN_RESPONSE = "AWAITING_CITIZEN_RESPONSE"
    AWAITING_MORE_EVIDENCE = "AWAITING_MORE_EVIDENCE"
    FIELD_VERIFICATION_REQUESTED = "FIELD_VERIFICATION_REQUESTED"
    RELATED_TO_CASE = "RELATED_TO_CASE"
    POTENTIAL_DUPLICATE = "POTENTIAL_DUPLICATE"
    CLOSED_INSUFFICIENT_EVIDENCE = "CLOSED_INSUFFICIENT_EVIDENCE"
    RESOLVED = "RESOLVED"


class EvidenceState(str, Enum):
    E1_REPORTED = "E1_REPORTED"
    E2_DOCUMENTED = "E2_DOCUMENTED"
    E3_INFERRED = "E3_INFERRED"
    E4_CORROBORATED = "E4_CORROBORATED"
    E5_VERIFIED = "E5_VERIFIED"


class ActorType(str, Enum):
    CITIZEN = "CITIZEN"
    SYSTEM = "SYSTEM"
    RESEARCHER = "RESEARCHER"
    FIELD_VERIFIER = "FIELD_VERIFIER"
    SENSOR = "SENSOR"
    LABORATORY = "LABORATORY"


class LineageEventType(str, Enum):
    HUMAN_REVIEW_RECORDED = "HUMAN_REVIEW_RECORDED"


OUTCOME_TO_WORKFLOW_STATUS = {
    HumanReviewOutcome.SUPPORTS_REPORTED_OBSERVATION: CaseWorkflowStatus.REVIEWED,
    HumanReviewOutcome.REQUEST_CLARIFICATION: CaseWorkflowStatus.AWAITING_CITIZEN_RESPONSE,
    HumanReviewOutcome.REQUEST_MORE_EVIDENCE: CaseWorkflowStatus.AWAITING_MORE_EVIDENCE,
    HumanReviewOutcome.REQUEST_FIELD_VERIFICATION: CaseWorkflowStatus.FIELD_VERIFICATION_REQUESTED,
    HumanReviewOutcome.MARK_RELATED_CASE: CaseWorkflowStatus.RELATED_TO_CASE,
    HumanReviewOutcome.MARK_POTENTIAL_DUPLICATE: CaseWorkflowStatus.POTENTIAL_DUPLICATE,
    HumanReviewOutcome.INSUFFICIENT_EVIDENCE: CaseWorkflowStatus.CLOSED_INSUFFICIENT_EVIDENCE,
    HumanReviewOutcome.RESOLVED_NO_ACTION: CaseWorkflowStatus.RESOLVED,
}

CITIZEN_IMPACT_DESCRIPTIONS = {
    "SUBMITTED": "Your observation was received and is awaiting initial processing.",
    "AWAITING_REVIEW": "Your observation is awaiting research review.",
    "REVIEWED": "Your observation was reviewed as part of a research evidence workflow.",
    "AWAITING_CITIZEN_RESPONSE": "Researchers requested additional information about your observation.",
    "AWAITING_MORE_EVIDENCE": "Additional evidence may help researchers assess this observation.",
    "FIELD_VERIFICATION_REQUESTED": "Your observation helped identify a location for possible field verification.",
    "RELATED_TO_CASE": "Your observation was linked to a related research case.",
    "POTENTIAL_DUPLICATE": "Your observation was identified as potentially related to another observation.",
    "CLOSED_INSUFFICIENT_EVIDENCE": "Researchers could not proceed with the available evidence.",
    "RESOLVED": "Researchers completed their review with no further action recorded.",
}


# -----------------------------------------------------------------------------
# Review Schemas
# -----------------------------------------------------------------------------

class HumanReviewCreate(BaseModel):
    outcome: HumanReviewOutcome = Field(..., description="Researcher review decision outcome.")
    rationale: str = Field(
        ...,
        description="Mandatory researcher rationale explaining review decision (15 to 2000 characters).",
    )
    linked_case_id: Optional[UUID] = Field(
        default=None,
        description="Target case UUID when marking as related or potential duplicate.",
    )

    @field_validator("rationale")
    @classmethod
    def validate_rationale(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 15:
            raise ValueError("Rationale must contain at least 15 non-whitespace characters.")
        if len(trimmed) > 2000:
            raise ValueError("Rationale cannot exceed 2000 characters.")
        return trimmed

    model_config = ConfigDict(extra="forbid")


class HumanReviewResponse(BaseModel):
    id: UUID
    case_id: UUID
    report_id: UUID
    reviewer_id: str
    outcome: HumanReviewOutcome
    rationale: str
    linked_case_id: Optional[UUID] = None
    evidence_state_before: str
    evidence_state_after: str
    workflow_status: CaseWorkflowStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HumanReviewListResponse(BaseModel):
    reviews: List[HumanReviewResponse]
    total: int


class EvidenceLineageEventResponse(BaseModel):
    id: UUID
    signal_case_id: UUID
    event_type: str
    actor_type: ActorType
    actor_id: str
    source_service: str
    summary: str
    structured_payload_json: Dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvidenceLineageListResponse(BaseModel):
    events: List[EvidenceLineageEventResponse]
    total: int


class CitizenImpactStatusResponse(BaseModel):
    case_id: UUID
    status: str
    status_label: str
    description: str
    updated_at: datetime


# -----------------------------------------------------------------------------
# Inbox and Detail Responses
# -----------------------------------------------------------------------------

class ResearchInboxItem(BaseModel):
    case_id: UUID = Field(..., description="Unique case identifier matching report ID.")
    observed_at: datetime = Field(..., description="Citizen observation timestamp.")
    location: ResearchLocationSummary = Field(..., description="Geographic coordinates.")
    description: Optional[str] = Field(None, description="Citizen narrative.")
    water_appearance: Optional[str] = None
    flow_condition: Optional[str] = None
    odor: Optional[str] = None
    quality_rating: EvidenceQualityLevel = Field(..., description="Deterministic evidence quality rating.")
    completeness_score: float = Field(..., ge=0.0, le=1.0, description="Evidence completeness ratio.")
    media_count: int = Field(0, ge=0, description="Number of attached media files.")
    pattern_echo_count: int = Field(0, ge=0, description="Number of historical similar cases.")
    triage_action: TriageAction = Field(..., description="Recommended triage next action.")
    triage_reasons: List[TriageReasonCode] = Field(default_factory=list, description="Triage reason codes.")
    human_decision_status: str = Field(
        default="AWAITING_REVIEW",
        description="Human review workflow status.",
    )
    workflow_status: str = Field(
        default="AWAITING_REVIEW",
        description="Current case workflow status.",
    )
    evidence_state: str = Field(
        default="E1_REPORTED",
        description="Current provenance evidence state.",
    )
    why_surfaced: List[WhySurfacedReason] = Field(
        default_factory=list,
        description="Deterministic list of reasons why this case surfaced in the inbox.",
    )


class ResearchInboxResponse(BaseModel):
    items: List[ResearchInboxItem]
    total: int = Field(..., ge=0, description="Total count matching filters.")
    limit: int = Field(..., ge=1, le=100)
    offset: int = Field(..., ge=0)


class ResearchCaseDetailResponse(BaseModel):
    case_id: UUID
    observed_at: datetime
    location: ResearchLocationSummary
    description: Optional[str] = None
    water_appearance: Optional[str] = None
    flow_condition: Optional[str] = None
    odor: Optional[str] = None
    foam_observed: Optional[bool] = None
    litter_observed: Optional[bool] = None
    dead_wildlife_observed: Optional[bool] = None
    human_decision_status: str = "AWAITING_REVIEW"
    workflow_status: str = "AWAITING_REVIEW"
    evidence_state: str = "E1_REPORTED"
    latest_human_review: Optional[HumanReviewResponse] = None
    review_count: int = 0
    lineage_count: int = 0
    why_surfaced: List[WhySurfacedReason]
    evidence_quality: EvidenceQualityResponse
    media_observations: List[MediaVisualObservations]
    contextual_evidence: PatternEchoResponse
    triage: TriageResponse
    evidence_contract: EvidenceContractResponse

    model_config = ConfigDict(from_attributes=True)
