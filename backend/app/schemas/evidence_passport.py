"""
StreamSignal — Evidence Passport Schemas (Track 7 Interoperability)
Exposes an immutable, provenance-rich Evidence Passport for a SignalCase.
Strictly separates:
1. Citizen observation (CITIZEN_REPORTED)
2. Quality evaluation (completeness ratio)
3. Media evidence (safe metadata & integrity hashes)
4. Machine observations (MACHINE_OBSERVATION / E3_INFERRED)
5. Contextual corroboration (Pattern Echo)
6. SignalGuard Interpretation Firewall (allowed vs prohibited interpretations)
7. Human decision (E4 != E5, requests != completed)
8. Authoritative Evidence Lineage audit events
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

from app.schemas.evidence_case import LocationData


class PassportMetadata(BaseModel):
    passport_id: UUID = Field(..., description="Deterministic unique identifier for this evidence passport")
    schema_version: str = Field(default="1.0.0", description="Evidence Passport schema specification version")
    generated_at: datetime = Field(..., description="Timestamp when this passport export was assembled")
    system_source: str = Field(default="StreamSignal Track 7 Interoperability Gateway")
    governance_standard: str = Field(default="IEEE OneAquaHealth One Health Evidence Standard")


class SignalCaseIdentity(BaseModel):
    case_id: UUID = Field(..., description="Primary SignalCase identifier matching report UUID")
    report_id: UUID = Field(..., description="Underlying citizen report UUID")
    created_at: datetime = Field(..., description="Timestamp when report was initially submitted")
    current_evidence_state: str = Field(..., description="Authoritative evidence state tier (e.g. E1_REPORTED, E4_CORROBORATED)")
    current_workflow_status: str = Field(..., description="Current case workflow status (e.g. AWAITING_REVIEW, FIELD_VERIFICATION_REQUESTED)")


class CitizenEvidencePassportSection(BaseModel):
    evidence_origin: str = Field(default="CITIZEN_REPORTED", description="Explicit evidence source indicator")
    observed_at: datetime = Field(..., description="Physical observation timestamp recorded by citizen")
    location: LocationData = Field(..., description="Geographic coordinates of the observation")
    description: str = Field(..., description="Citizen textual observation narrative")
    water_appearance: Optional[str] = None
    flow_condition: Optional[str] = None
    odor: Optional[str] = None
    foam_observed: bool = False
    litter_observed: bool = False
    dead_wildlife_observed: bool = False


class QualityPassportSection(BaseModel):
    quality_tier: str = Field(..., description="Evidence completeness rating (COMPLETE, PARTIAL, INSUFFICIENT)")
    completeness_score: float = Field(..., ge=0.0, le=1.0, description="Completeness ratio of physical dimensions")
    present_dimensions: List[str] = Field(default_factory=list)
    missing_dimensions: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    interpretation_boundary: str = Field(
        default="Completeness reflects documented physical dimension density, not scientific truth or contamination certainty."
    )


class MediaPassportItem(BaseModel):
    media_id: UUID
    original_filename: str
    content_type: str
    size_bytes: int
    sha256_hash: str
    safe_reference: str = Field(..., description="Safe relative API reference without disk paths")


class MediaPassportSection(BaseModel):
    total_media: int = 0
    items: List[MediaPassportItem] = Field(default_factory=list)


class MachineObservationPassportItem(BaseModel):
    observation_id: str
    media_id: str
    observation_type: str
    evidence_class: str = "E3_INFERRED"
    description: str
    uncertainty: str
    sha256_integrity: str


class MachineObservationPassportSection(BaseModel):
    status: str = "AVAILABLE"
    evidence_class: str = "E3_INFERRED"
    items: List[MachineObservationPassportItem] = Field(default_factory=list)
    scientific_limitation: str = Field(
        default="Machine vision observations indicate visible cues only and do not establish biological identity, toxicity, or environmental causation."
    )


class ContextualMatchPassportItem(BaseModel):
    report_id: str
    observed_at: str
    distance_meters: float
    days_difference: int
    matched_signals: List[str] = Field(default_factory=list)
    similarity_explanation: List[str] = Field(default_factory=list)


class ContextualPassportSection(BaseModel):
    status: str = "NO_MATCHES"
    matches_count: int = 0
    search_radius_meters: int = 1000
    historical_window_days: int = 90
    summary: str = "No historical patterns within spatial/temporal threshold."
    matches: List[ContextualMatchPassportItem] = Field(default_factory=list)
    interpretation_boundary: str = Field(
        default="Historical recurrence indicates spatial/temporal pattern similarity, not environmental causation."
    )


class SignalGuardPassportSection(BaseModel):
    contract_version: str = "1.0"
    rules_applied: List[str] = Field(default_factory=list)
    guarantees: List[str] = Field(default_factory=list)
    supported_claims: List[str] = Field(default_factory=list)
    prohibited_interpretations: List[str] = Field(default_factory=list)


class HumanDecisionPassportSection(BaseModel):
    review_status: str = Field(default="AWAITING_REVIEW", description="Workflow state of expert review")
    outcome: Optional[str] = None
    workflow_status: str = "AWAITING_REVIEW"
    evidence_state_before: Optional[str] = None
    evidence_state_after: Optional[str] = None
    reviewer_id: Optional[str] = None
    rationale: Optional[str] = None
    linked_case_id: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    boundary_notice: str = Field(
        default="Human review requests further verification and does not automatically confirm clinical or environmental causation."
    )


class LineagePassportItem(BaseModel):
    event_id: UUID
    event_type: str
    actor_type: str
    actor_id: str
    summary: str
    created_at: datetime


class LineagePassportSection(BaseModel):
    total_events: int = 0
    events: List[LineagePassportItem] = Field(default_factory=list)


class EvidencePassportResponse(BaseModel):
    metadata: PassportMetadata
    identity: SignalCaseIdentity
    citizen_evidence: CitizenEvidencePassportSection
    evidence_quality: QualityPassportSection
    media_evidence: MediaPassportSection
    machine_assistance: MachineObservationPassportSection
    contextual_evidence: ContextualPassportSection
    signal_guard: SignalGuardPassportSection
    human_decision: HumanDecisionPassportSection
    lineage: LineagePassportSection

    model_config = ConfigDict(from_attributes=True)
