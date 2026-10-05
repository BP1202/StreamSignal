from datetime import datetime
from enum import Enum
from typing import List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class PatternEchoStatus(str, Enum):
    """Status of historical contextual matching."""
    AVAILABLE = "AVAILABLE"
    NO_MATCHES = "NO_MATCHES"


class PatternEchoMatch(BaseModel):
    """
    Transparent historical contextual match representation.
    Explicitly provides the matched historical report ID, distance, elapsed days,
    matching signals, and plain-language explanation without causal claims.
    """
    report_id: UUID = Field(..., description="UUID of the matching historical observation report")
    observed_at: datetime = Field(..., description="Timestamp when the historical report was observed")
    distance_meters: float = Field(..., ge=0.0, description="Great circle distance in meters")
    days_difference: int = Field(..., ge=0, description="Elapsed days between historical and current observations")
    matched_signals: List[str] = Field(
        default_factory=list,
        description="Controlled machine-readable matching signal identifiers",
    )
    similarity_explanation: List[str] = Field(
        default_factory=list,
        description="Explainable, plain-language reasons why this case was identified as similar",
    )

    model_config = ConfigDict(from_attributes=True)


class PatternEchoResponse(BaseModel):
    """
    Pattern Echo historical contextual evidence response.
    Transparently reports nearby historical observations while strictly enforcing
    the fundamental principle that similarity does not equal causation.
    """
    report_id: UUID = Field(..., description="UUID of the current citizen observation report")
    status: PatternEchoStatus = Field(..., description="Contextual search status (AVAILABLE or NO_MATCHES)")
    search_radius_meters: float = Field(..., description="Spatial search radius applied in meters")
    historical_window_days: int = Field(..., description="Historical search window applied in days")
    matches: List[PatternEchoMatch] = Field(
        default_factory=list,
        description="Matching historical cases sorted deterministically",
    )
    summary: str = Field(..., description="Concise, factual summary of historical search results")
    interpretation_limit: str = Field(
        default=(
            "Historical similarity indicates recurrence of reported observations only. "
            "It does not establish environmental cause, pollution, toxicity, health risk, or contamination."
        ),
        description="Scientific safety boundary: similarity is never causation",
    )

    model_config = ConfigDict(from_attributes=True)
