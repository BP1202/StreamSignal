from enum import Enum
from typing import List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.evidence_contract import EvidenceClass


class VisualObservationType(str, Enum):
    """
    Controlled vocabulary for observable, non-diagnostic visual signals
    derived from citizen media evidence.
    """
    GREEN_VISUAL_REGION = "GREEN_VISUAL_REGION"
    DARK_OR_BROWN_DISCOLORATION = "DARK_OR_BROWN_DISCOLORATION"
    FOAM_LIKE_SURFACE_PATTERN = "FOAM_LIKE_SURFACE_PATTERN"
    VISIBLE_LITTER = "VISIBLE_LITTER"
    WATER_SURFACE_VISIBLE = "WATER_SURFACE_VISIBLE"
    IMAGE_TOO_DARK = "IMAGE_TOO_DARK"
    IMAGE_TOO_BLURRY = "IMAGE_TOO_BLURRY"
    INSUFFICIENT_WATER_VISIBILITY = "INSUFFICIENT_WATER_VISIBILITY"


class MediaObservationSupport(BaseModel):
    """
    Safe provenance support metadata for a media visual observation.
    Shields internal filesystem storage keys and directories.
    """
    media_id: UUID = Field(..., description="UUID of the linked citizen media record")
    sha256: str = Field(..., description="SHA-256 cryptographic checksum of analyzed image")
    content_type: str = Field(..., description="MIME content type of analyzed image")

    model_config = ConfigDict(from_attributes=True)


class VisualObservation(BaseModel):
    """
    Atomic observable visual signal derived from media evidence.
    Classified strictly as E2_OBSERVED without diagnostic or environmental assertions.
    """
    observation_id: str = Field(..., description="Stable deterministic identifier for this observation")
    media_id: UUID = Field(..., description="UUID of the parent media record")
    observation_type: VisualObservationType = Field(..., description="Controlled vocabulary signal type")
    evidence_class: EvidenceClass = Field(
        default=EvidenceClass.E2_OBSERVED,
        description="Provenance class (strictly E2_OBSERVED for visual observations)",
    )
    description: str = Field(..., description="Conservative, non-diagnostic statement describing what is visible")
    uncertainty: str = Field(..., description="Explicit statement of visual observation boundaries and limitations")
    support: MediaObservationSupport = Field(..., description="Traceability metadata for source media")

    model_config = ConfigDict(from_attributes=True)


class MediaVisualObservations(BaseModel):
    """Visual observations extracted for a single media item."""
    media_id: UUID = Field(..., description="UUID of the analyzed media record")
    observations: List[VisualObservation] = Field(default_factory=list, description="Extracted visual observations")

    model_config = ConfigDict(from_attributes=True)


class ReportMediaObservationsResponse(BaseModel):
    """
    Response schema for visual observations extracted from all media attached to a report.
    """
    report_id: UUID = Field(..., description="UUID of the parent citizen observation report")
    media: List[MediaVisualObservations] = Field(
        default_factory=list,
        description="List of visual observations grouped by media item",
    )

    model_config = ConfigDict(from_attributes=True)
