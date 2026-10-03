"""
StreamSignal — Evidence Gap Intelligence Schemas
Pydantic schemas for structured gap analysis output.
All values must be derived from real PostgreSQL data.
No confidence scores, priority ratings, or synthetic gap summaries.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class EvidenceGapSummary(BaseModel):
    """
    Aggregate evidence availability summary for a single dimension across all analyzed SignalCases.
    Values are factual counts derived deterministically from PostgreSQL — never hardcoded.
    """
    dimension: str = Field(..., description="Evidence dimension identifier (e.g. 'flow_condition')")
    dimension_label: str = Field(..., description="Human-readable label (e.g. 'Flow Condition')")
    total_cases_analyzed: int = Field(..., description="Total SignalCases evaluated")
    cases_with_evidence: int = Field(..., description="Cases where this dimension is present")
    cases_missing_evidence: int = Field(..., description="Cases where this dimension is absent")
    availability_ratio: float = Field(..., description="Fraction of cases with this dimension (0.0–1.0)")
    affected_segment_ids: List[str] = Field(default_factory=list, description="Stream segment identifiers from affected cases")
    first_observed_at: Optional[datetime] = None
    last_observed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EvidenceGapDetail(BaseModel):
    """
    Full detail for a single evidence gap, including affected case IDs.
    Includes an explicit epistemic framing statement — never environmental claims.
    """
    dimension: str
    dimension_label: str
    total_cases_analyzed: int
    cases_with_evidence: int
    cases_missing_evidence: int
    availability_ratio: float
    affected_case_ids: List[str] = Field(default_factory=list)
    affected_segment_ids: List[str] = Field(default_factory=list)
    first_observed_at: Optional[datetime] = None
    last_observed_at: Optional[datetime] = None
    epistemic_statement: str = Field(
        ...,
        description=(
            "Explicitly frames the gap as evidence availability only. "
            "Never asserts environmental conditions, toxicity, or health risk."
        ),
    )

    model_config = ConfigDict(from_attributes=True)


class EvidenceGapListResponse(BaseModel):
    """Aggregated evidence gap intelligence across all eligible SignalCases."""
    total_cases_analyzed: int
    gaps: List[EvidenceGapSummary]
    analysis_timestamp: datetime
    epistemic_notice: str = (
        "Evidence availability statistics describe the completeness of collected data only. "
        "Missing evidence dimensions do not establish environmental conditions, toxicity, or health risk."
    )

    model_config = ConfigDict(from_attributes=True)
