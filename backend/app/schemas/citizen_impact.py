"""
StreamSignal — Citizen Contributor Impact & Provenance Schemas
Supports tracking personal evidence contributions, coverage delta,
SignalCase linkage, and authoritative research review status.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ContributionHistoryItem(BaseModel):
    """A single evidence submission made by this contributor."""
    submission_id: UUID
    signal_case_id: Optional[UUID] = None
    mission_title: str
    dimensions_provided: List[str] = Field(default_factory=list)
    submitted_at: datetime
    review_status: str = Field(
        ...,
        description="AWAITING_REVIEW | ACCEPTED_FOR_RESEARCH | MORE_EVIDENCE_REQUESTED",
    )
    coverage_delta_pct: float = Field(
        ...,
        description="Percentage points of evidence coverage contributed by this submission",
    )

    model_config = ConfigDict(from_attributes=True)


class ContributorImpactResponse(BaseModel):
    """
    Complete evidence impact summary for the authenticated/current contributor.
    All metrics are deterministically computed from PostgreSQL.
    """
    contributor_id: str = Field(..., description="Public non-identifying contributor handle")
    display_name: str = Field(..., description="Pseudonymous contributor handle (e.g. BrookDragonfly-2378)")
    account_level: str = Field(..., description="LEVEL_1_CONTRIBUTOR | LEVEL_2_REGISTERED")
    total_contributions: int = Field(..., description="Total completed evidence submissions")
    verified_contributions: int = Field(..., description="Submissions reviewed/accepted by researchers")
    overall_evidence_coverage: float = Field(..., description="Current global evidence coverage percentage (0.0–100.0%)")
    total_coverage_delta_contributed: float = Field(..., description="Cumulative percentage points contributed by this citizen")
    recent_contributions: List[ContributionHistoryItem] = Field(default_factory=list)
    stewardship_milestones: List[str] = Field(
        default_factory=list,
        description="Factual stewardship milestones earned through real evidence contributions",
    )
    epistemic_notice: str = (
        "Evidence coverage reflects the availability of relevant observations and supporting media. "
        "Submitted coverage deltas represent potential evidence availability prior to researcher review; "
        "accepted submissions represent verified additions to the case record. "
        "It is not a measure of drinking-water safety or laboratory contamination."
    )

    model_config = ConfigDict(from_attributes=True)
