from datetime import datetime
from enum import Enum
from typing import List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class EvidenceClass(str, Enum):
    """
    Evidence classification by provenance and verification state.
    Note: These represent evidence state/lineage, NOT a numeric quality score.
    """
    E1_REPORTED = "E1_REPORTED"        # Directly stated or submitted by the citizen
    E2_OBSERVED = "E2_OBSERVED"        # Supported by directly observable media or structured evidence
    E3_INFERRED = "E3_INFERRED"        # Produced by AI/model/rule-based inference
    E4_CORROBORATED = "E4_CORROBORATED"  # Supported by independent observations, sensors, or repeat evidence
    E5_VERIFIED = "E5_VERIFIED"        # Confirmed via expert, laboratory, or instrument validation


class AllowedAction(str, Enum):
    """Permitted next actions supported by the current evidence state."""
    MONITOR = "MONITOR"
    REQUEST_MORE_EVIDENCE = "REQUEST_MORE_EVIDENCE"
    EXPERT_REVIEW = "EXPERT_REVIEW"
    FIELD_VERIFICATION = "FIELD_VERIFICATION"


class ProhibitedInterpretation(str, Enum):
    """Conclusions that must strictly NOT be inferred from the current evidence state."""
    POLLUTION_CONFIRMED = "POLLUTION_CONFIRMED"
    TOXICITY_CONFIRMED = "TOXICITY_CONFIRMED"
    HEALTH_RISK_CONFIRMED = "HEALTH_RISK_CONFIRMED"
    CAUSE_CONFIRMED = "CAUSE_CONFIRMED"


class EvidenceClaim(BaseModel):
    """
    Deterministic atomic claim derived from authoritative evidence records.
    Documents provenance, support, uncertainty boundaries, allowed actions,
    and prohibited scientific interpretations.
    """
    claim_id: str = Field(..., description="Stable, deterministic identifier for this claim")
    claim: str = Field(..., description="Objective statement of observed or submitted evidence")
    evidence_class: EvidenceClass = Field(..., description="Evidence provenance/state class")
    source: str = Field(..., description="Authoritative origin field or component")
    support: List[str] = Field(default_factory=list, description="Authoritative supporting items or identifiers")
    uncertainty: List[str] = Field(default_factory=list, description="Explicit uncertainty boundaries")
    allowed_actions: List[AllowedAction] = Field(default_factory=list, description="Appropriate follow-up actions")
    prohibited_interpretations: List[ProhibitedInterpretation] = Field(
        default_factory=list,
        description="Conclusions that this evidence does NOT prove",
    )

    model_config = ConfigDict(from_attributes=True)


class EvidenceContractProvenance(BaseModel):
    """Lightweight lineage and generation metadata for the Evidence Contract."""
    source: str = Field(default="streamsignal", description="Primary data system source")
    generated_at: datetime = Field(..., description="Timestamp when evidence contract was evaluated")
    components: List[str] = Field(
        default_factory=lambda: ["citizen_report", "report_media", "evidence_quality", "evidence_interview"],
        description="Data components integrated into this contract evaluation",
    )


class EvidenceContractResponse(BaseModel):
    """
    SignalGuard Evidence Trust Contract response.
    Explicitly bounds claims, uncertainty, allowed actions, and prohibited interpretations.
    """
    report_id: UUID = Field(..., description="Underlying citizen report UUID")
    case_id: UUID = Field(..., description="Deterministic case identifier (matches report_id)")
    status: str = Field(default="pending_review", description="Overall evidence review status")
    claims: List[EvidenceClaim] = Field(default_factory=list, description="Deterministic claims list")
    provenance: EvidenceContractProvenance = Field(..., description="Provenance metadata")

    model_config = ConfigDict(from_attributes=True)
