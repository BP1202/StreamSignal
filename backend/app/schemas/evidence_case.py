from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

from app.schemas.evidence_quality import EvidenceQualityResponse
from app.schemas.media import ReportMediaResponse


class LocationData(BaseModel):
    """Geographic coordinates for citizen observation site."""
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude between -90 and 90")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude between -180 and 180")


class CitizenEvidence(BaseModel):
    """Observational evidence explicitly documented or supplied by the citizen."""
    observation_time: datetime = Field(..., description="Timestamp of the physical observation")
    location: LocationData = Field(..., description="Geographic coordinates of observation")
    description: str = Field(..., description="Primary citizen textual description")
    water_appearance: Optional[str] = Field(default=None, description="Visual appearance of water")
    odor: Optional[str] = Field(default=None, description="Odor or smell noted by citizen")
    flow_condition: Optional[str] = Field(default=None, description="Flow or stagnation condition")
    foam_observed: bool = Field(default=False, description="Whether unnatural foam was observed")
    litter_observed: bool = Field(default=False, description="Whether visible trash/debris was present")
    dead_wildlife_observed: bool = Field(default=False, description="Whether dead fish or aquatic life were seen")
    media: List[ReportMediaResponse] = Field(
        default_factory=list,
        description="Safe metadata for visual evidence attached to this report",
    )


class MachineAssistanceSection(BaseModel):
    """Machine-assisted inferences or automated analytical outputs (empty/unavailable in Issue 6)."""
    status: str = Field(default="not_available", description="Status of machine assistance pipeline")
    items: List[Dict[str, Any]] = Field(default_factory=list, description="Machine-generated analytical items")


class ContextualEvidenceSection(BaseModel):
    """External or environmental contextual data (empty/unavailable in Issue 6)."""
    status: str = Field(default="not_available", description="Status of contextual evidence pipeline")
    items: List[Dict[str, Any]] = Field(default_factory=list, description="Contextual data items")


class HumanDecisionSection(BaseModel):
    """Human expert review outcome and notes (pending review in Issue 6)."""
    status: str = Field(default="pending", description="Status of human expert review")
    decision: Optional[str] = Field(default=None, description="Expert decision if completed")
    reviewer: Optional[str] = Field(default=None, description="Reviewer identifier if reviewed")
    notes: Optional[str] = Field(default=None, description="Reviewer notes or comments")


class EvidenceCaseProvenance(BaseModel):
    """Provenance and lineage metadata for the aggregated evidence case."""
    source: str = Field(default="streamsignal", description="Primary data system source")
    generated_at: datetime = Field(..., description="Timestamp when this evidence case view was aggregated")
    components: List[str] = Field(
        default_factory=lambda: ["citizen_report", "report_media", "evidence_quality", "evidence_interview"],
        description="Data components integrated into this case",
    )


class EvidenceCaseResponse(BaseModel):
    """
    Transparent, aggregated Evidence Case for a freshwater observation report.
    Clearly separates citizen evidence, machine assistance, contextual data, and human review.
    """
    case_id: UUID = Field(..., description="Deterministic case identifier (matches report_id)")
    report_id: UUID = Field(..., description="Underlying citizen report UUID")
    status: str = Field(default="pending_review", description="Overall evidence case review status")
    created_at: datetime = Field(..., description="Timestamp when the underlying report was created")
    citizen_evidence: CitizenEvidence
    evidence_quality: EvidenceQualityResponse
    machine_assistance: MachineAssistanceSection
    contextual_evidence: ContextualEvidenceSection
    human_decision: HumanDecisionSection
    provenance: EvidenceCaseProvenance

    model_config = ConfigDict(from_attributes=True)
