"""
StreamSignal — Evidence Gap Intelligence API (Issue 17)
Research Workspace endpoints to analyze evidence availability across real SignalCases.

All output is evidence availability statistics only — not environmental claims.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.evidence_gap import EvidenceGapDetail, EvidenceGapListResponse
from app.services.evidence_gap_intelligence import analyze_evidence_gaps, get_evidence_gap_detail, DIMENSION_LABEL

router = APIRouter()


@router.get(
    "/evidence-gaps",
    response_model=EvidenceGapListResponse,
    summary="Analyze evidence availability across real SignalCases",
    description=(
        "Returns evidence availability statistics for each tracked dimension across all persisted SignalCases. "
        "Values are derived deterministically from PostgreSQL — never synthetic. "
        "An empty database returns empty results. "
        "Statistics describe evidence collection completeness only, NOT environmental conditions."
    ),
)
def get_evidence_gaps(
    min_cases: int = Query(
        default=1,
        ge=1,
        le=10000,
        description="Minimum cases required to include a dimension in output",
    ),
    db: Session = Depends(get_db),
) -> EvidenceGapListResponse:
    return analyze_evidence_gaps(db, min_cases=min_cases)


@router.get(
    "/evidence-gaps/{dimension}",
    response_model=EvidenceGapDetail,
    summary="Get detailed evidence gap for a specific dimension",
    description="Returns per-case detail for a single evidence dimension, including affected SignalCase IDs.",
)
def get_dimension_gap(
    dimension: str,
    db: Session = Depends(get_db),
) -> EvidenceGapDetail:
    if dimension not in DIMENSION_LABEL:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Dimension '{dimension}' is not tracked. "
                f"Tracked dimensions: {sorted(DIMENSION_LABEL.keys())}"
            ),
        )
    detail = get_evidence_gap_detail(db, dimension)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dimension not found.")
    return detail
