"""
StreamSignal — Research Workspace API Endpoints
Provides researcher-facing evidence inbox, deep case investigation endpoints,
human review decision recording, and immutable evidence lineage audit retrieval.
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.evidence_passport import EvidencePassportResponse
from app.schemas.evidence_quality import EvidenceQualityLevel
from app.schemas.fhir import FHIRBundle
from app.schemas.triage import TriageAction
from app.schemas.research import (
    ResearchInboxResponse,
    ResearchCaseDetailResponse,
    HumanReviewCreate,
    HumanReviewResponse,
    HumanReviewListResponse,
    EvidenceLineageListResponse,
    CitizenImpactStatusResponse,
)
from app.services.evidence_passport import generate_evidence_passport
from app.services.fhir_export import generate_fhir_bundle
from app.services.research import get_research_inbox, get_research_case_detail
from app.services.review import (
    create_human_review,
    get_case_reviews,
    get_case_lineage,
    get_citizen_impact_status,
)

router = APIRouter(prefix="/research", tags=["Research Workspace"])


@router.get(
    "/evidence-cases",
    response_model=ResearchInboxResponse,
    status_code=status.HTTP_200_OK,
    summary="Research Evidence Inbox",
    description=(
        "Retrieves a prioritized, deterministically sorted list of SignalCases requiring "
        "investigation. Composes authoritative evidence quality, media visual observations, "
        "Pattern Echo contextual evidence, and triage recommendation."
    ),
)
def list_research_cases(
    action: Optional[TriageAction] = Query(None, description="Filter by recommended triage action"),
    quality_rating: Optional[EvidenceQualityLevel] = Query(None, description="Filter by quality rating"),
    has_media: Optional[bool] = Query(None, description="Filter by presence of media attachments"),
    has_pattern_echo: Optional[bool] = Query(None, description="Filter by presence of historical matches"),
    limit: int = Query(20, ge=1, le=100, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db),
) -> ResearchInboxResponse:
    """
    Returns paginated research evidence cases with Why-This-Case explainability.
    """
    return get_research_inbox(
        db=db,
        action=action,
        quality_rating=quality_rating,
        has_media=has_media,
        has_pattern_echo=has_pattern_echo,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/evidence-cases/{case_id}",
    response_model=ResearchCaseDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="SignalCase Investigation Detail",
    description=(
        "Retrieves comprehensive multi-layered evidence for a single SignalCase, "
        "including citizen evidence, media observations, Pattern Echo context, "
        "triage next actions, SignalGuard claim inspector, and latest human review."
    ),
)
def get_research_case(
    case_id: UUID,
    db: Session = Depends(get_db),
) -> ResearchCaseDetailResponse:
    """
    Returns complete evidence investigation details for a specific SignalCase.
    """
    case_detail = get_research_case_detail(db=db, case_id=case_id)
    if not case_detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SignalCase with id '{case_id}' not found.",
        )
    return case_detail


@router.post(
    "/evidence-cases/{case_id}/reviews",
    response_model=HumanReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Human Review Decision",
    description=(
        "Records an auditable, defensible researcher decision for a SignalCase. "
        "Mandates a minimum 15-character rationale. Validates linked cases for related/duplicate outcomes. "
        "Deterministically maps workflow status, preserves evidence-state separation (E4 never becomes E5), "
        "and atomically appends an immutable EvidenceLineageEvent."
    ),
)
def record_human_review(
    case_id: UUID,
    review_in: HumanReviewCreate,
    x_reviewer_id: Optional[str] = Header(default="R-042", alias="X-Reviewer-Id"),
    db: Session = Depends(get_db),
) -> HumanReviewResponse:
    """
    Atomically records a human review decision, updates case workflow status, and records lineage.
    """
    return create_human_review(
        db=db,
        case_id=case_id,
        review_in=review_in,
        reviewer_id=x_reviewer_id or "R-042",
    )


@router.get(
    "/evidence-cases/{case_id}/reviews",
    response_model=HumanReviewListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Human Review History",
    description="Returns deterministic chronological history of all reviews recorded for this SignalCase.",
)
def list_case_reviews(
    case_id: UUID,
    db: Session = Depends(get_db),
) -> HumanReviewListResponse:
    """
    Returns chronological human review decisions for a case.
    """
    return get_case_reviews(db=db, case_id=case_id)


@router.get(
    "/evidence-cases/{case_id}/lineage",
    response_model=EvidenceLineageListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Evidence Lineage Audit Events",
    description="Returns deterministic chronological audit lineage events for a SignalCase.",
)
def list_case_lineage(
    case_id: UUID,
    db: Session = Depends(get_db),
) -> EvidenceLineageListResponse:
    """
    Returns chronological immutable audit lineage for a case.
    """
    return get_case_lineage(db=db, case_id=case_id)


@router.get(
    "/evidence-cases/{case_id}/impact-status",
    response_model=CitizenImpactStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve Non-Sensitive Impact Status",
    description="Returns safe, non-sensitive impact status suitable for citizen observation tracking.",
)
def get_case_impact_status(
    case_id: UUID,
    db: Session = Depends(get_db),
) -> CitizenImpactStatusResponse:
    """
    Returns non-sensitive impact status for an evidence case.
    """
    return get_citizen_impact_status(db=db, case_id=case_id)


@router.get(
    "/evidence-cases/{case_id}/evidence-passport",
    response_model=EvidencePassportResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve Evidence Passport",
    description="Returns an immutable, provenance-rich Evidence Passport for a SignalCase (One Health Interoperability).",
)
def get_evidence_passport(
    case_id: UUID,
    db: Session = Depends(get_db),
) -> EvidencePassportResponse:
    """
    Returns the comprehensive, provenance-preserving Evidence Passport.
    """
    passport = generate_evidence_passport(db=db, case_id=case_id)
    if not passport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SignalCase with id '{case_id}' not found.",
        )
    return passport


@router.get(
    "/evidence-cases/{case_id}/fhir",
    response_model=FHIRBundle,
    status_code=status.HTTP_200_OK,
    summary="Export FHIR R4 Bundle",
    description="Returns a deterministic, standards-aligned FHIR R4 collection bundle for a SignalCase.",
)
def get_fhir_bundle(
    case_id: UUID,
    db: Session = Depends(get_db),
) -> FHIRBundle:
    """
    Exports SignalCase data into a deterministic FHIR R4 Bundle.
    """
    bundle = generate_fhir_bundle(db=db, case_id=case_id)
    if not bundle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SignalCase with id '{case_id}' not found.",
        )
    return bundle


@router.get(
    "/evidence-cases/{case_id}/mission-needs",
    status_code=status.HTTP_200_OK,
    summary="Inspect Case Evidence Gaps for Mission Planning",
)
def get_case_mission_needs(
    case_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Exposes real evidence gaps of a SignalCase to discover targeted mission opportunities."""
    from app.agent.tools import tool_get_evidence_gap
    return tool_get_evidence_gap(db=db, case_id=case_id)


@router.get(
    "/missions",
    status_code=status.HTTP_200_OK,
    summary="List All Research Missions",
)
def list_research_missions(
    case_id: Optional[UUID] = Query(None, description="Filter by linked SignalCase ID"),
    db: Session = Depends(get_db),
) -> dict:
    """Returns missions and their evidence collection status for researcher oversight."""
    from app.models.mission import Mission
    from app.api.v1.citizen_missions import serialize_mission
    query = db.query(Mission).order_by(Mission.created_at.desc())
    if case_id:
        query = query.filter(Mission.signal_case_id == case_id)
    missions = query.all()
    serialized = [serialize_mission(m).model_dump() for m in missions]
    return {"missions": serialized, "total": len(serialized)}
