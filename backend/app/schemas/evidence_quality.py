from enum import Enum
from typing import List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class EvidenceQualityLevel(str, Enum):
    """
    Deterministic evidence completeness tiers.
    Separates evidence sufficiency from environmental diagnoses.
    """
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    INSUFFICIENT = "INSUFFICIENT"


class EvidenceQualityResponse(BaseModel):
    """
    Schema for evidence quality assessment response.
    Provides explainable completeness metrics and actionable recommendations.
    """
    report_id: UUID = Field(..., description="Unique UUID identifier of the assessed report")
    quality: EvidenceQualityLevel = Field(
        ...,
        description="Assigned evidence quality tier: COMPLETE, PARTIAL, or INSUFFICIENT",
    )
    score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Completeness ratio between 0.0 and 1.0 based on documented baseline evidence dimensions",
    )
    present: List[str] = Field(
        ...,
        description="List of evidence dimensions documented in the report",
    )
    missing: List[str] = Field(
        ...,
        description="List of expected evidence dimensions not documented in the report",
    )
    recommendations: List[str] = Field(
        ...,
        description="Actionable, deterministic recommendations to improve evidence documentation",
    )

    model_config = ConfigDict(from_attributes=True)
