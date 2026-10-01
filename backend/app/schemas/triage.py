from enum import Enum
from typing import List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class TriageAction(str, Enum):
    """Controlled workflow next-action recommendations for evidence handling."""
    MONITOR = "MONITOR"
    REQUEST_MORE_EVIDENCE = "REQUEST_MORE_EVIDENCE"
    EXPERT_REVIEW = "EXPERT_REVIEW"
    FIELD_VERIFICATION = "FIELD_VERIFICATION"


class TriageReasonCode(str, Enum):
    """Deterministic, machine-readable reason codes explaining triage decisions."""
    INSUFFICIENT_CORE_EVIDENCE = "INSUFFICIENT_CORE_EVIDENCE"
    MISSING_CONTEXTUAL_EVIDENCE = "MISSING_CONTEXTUAL_EVIDENCE"
    VISUAL_EVIDENCE_REQUIRES_REVIEW = "VISUAL_EVIDENCE_REQUIRES_REVIEW"
    REPEATED_HISTORICAL_CONTEXT = "REPEATED_HISTORICAL_CONTEXT"
    HUMAN_VERIFICATION_REQUIRED = "HUMAN_VERIFICATION_REQUIRED"
    NO_ACTIONABLE_GAP_IDENTIFIED = "NO_ACTIONABLE_GAP_IDENTIFIED"


class TriageEvidenceSummary(BaseModel):
    """
    Structured breakdown of the evidence inputs evaluated by the triage engine.
    Separates completeness, visual signals, historical context, and review state.
    """
    quality: str = Field(..., description="Evidence completeness quality tier (COMPLETE, PARTIAL, INSUFFICIENT)")
    quality_score: float = Field(..., ge=0.0, le=1.0, description="Completeness ratio between 0.0 and 1.0")
    media_count: int = Field(default=0, ge=0, description="Total media files attached to the report")
    visual_observation_count: int = Field(default=0, ge=0, description="Total structured visual observations extracted")
    historical_match_count: int = Field(default=0, ge=0, description="Total nearby similar historical reports matched")
    human_review_status: str = Field(default="PENDING", description="Human reviewer outcome status")

    model_config = ConfigDict(from_attributes=True)


class TriageResponse(BaseModel):
    """
    Deterministic triage recommendation for a citizen evidence report.
    Answers: 'Given the evidence currently available, what should happen next?'
    Does NOT assert environmental diagnosis, causation, or contamination.
    """
    report_id: UUID = Field(..., description="UUID of the evaluated citizen observation report")
    recommended_action: TriageAction = Field(..., description="Recommended workflow next-action")
    reason_codes: List[TriageReasonCode] = Field(
        default_factory=list,
        description="Controlled reason identifiers explaining the action",
    )
    evidence_summary: TriageEvidenceSummary = Field(
        ...,
        description="Summary of evidence signals evaluated by triage",
    )
    explanation: List[str] = Field(
        default_factory=list,
        description="Deterministic, plain-language explanation of triage decision",
    )
    limitations: List[str] = Field(
        default_factory=lambda: [
            "This recommendation concerns evidence handling only.",
            "Historical similarity does not establish environmental cause.",
            "Visual observations do not establish pollution, toxicity, health risk, or contamination.",
            "Human or instrument verification is required for environmental conclusions.",
        ],
        description="Explicit safety and scientific boundaries",
    )

    model_config = ConfigDict(from_attributes=True)
