from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Path, UploadFile, File, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.report import Report
from app.schemas.report import ReportCreate, ReportResponse, ReportListResponse
from app.schemas.evidence_quality import EvidenceQualityResponse
from app.schemas.media import ReportMediaResponse
from app.schemas.evidence_interview import (
    EvidenceInterviewResponse,
    EvidenceInterviewAnswersRequest,
    EvidenceInterviewAnswersResponse,
)
from app.schemas.evidence_case import EvidenceCaseResponse
from app.schemas.evidence_contract import EvidenceContractResponse
from app.schemas.media_observation import ReportMediaObservationsResponse
from app.schemas.contextual_evidence import PatternEchoResponse
from app.schemas.triage import TriageResponse
from app.services.evidence_quality import assess_evidence_quality
from app.services.media import ingest_report_media
from app.services.evidence_interview import (
    generate_interview_questions,
    apply_interview_answers,
)
from app.services.evidence_case import assemble_evidence_case
from app.services.evidence_contract import assemble_evidence_contract
from app.services.media_observation import extract_report_media_observations
from app.services.contextual_evidence import evaluate_pattern_echo
from app.services.triage import evaluate_evidence_triage
from app.schemas.research import CitizenImpactStatusResponse
from app.services.review import get_citizen_impact_status
from app.services.realtime import connection_manager, RealtimeEventType

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Citizen Evidence Report",
    description="Captures primary citizen observations of urban freshwater conditions.",
)
def create_report(
    report_in: ReportCreate,
    db: Session = Depends(get_db),
) -> Report:
    """Create a new citizen evidence report with server-managed SUBMITTED status."""
    report_data = report_in.model_dump()
    db_report = Report(**report_data, status="SUBMITTED")
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    # Publish SIGNAL_CASE_CREATED to research workspace strictly post-commit
    connection_manager.publish_event(
        event_type=RealtimeEventType.SIGNAL_CASE_CREATED,
        case_id=db_report.id,
        report_id=db_report.id,
        payload={
            "title": f"Observation #{str(db_report.id)[:8].upper()}",
            "description": db_report.description,
            "media_count": len(db_report.media) if db_report.media else 0,
        },
    )

    return db_report


@router.get(
    "",
    response_model=ReportListResponse,
    summary="List Citizen Evidence Reports",
    description="Retrieve paginated citizen evidence reports ordered newest first.",
)
def list_reports(
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of reports to return (1 to 100)",
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Number of reports to skip",
    ),
    db: Session = Depends(get_db),
) -> ReportListResponse:
    """List citizen reports with pagination and deterministic ordering (created_at DESC, id DESC)."""
    total = db.query(Report).count()
    items = (
        db.query(Report)
        .order_by(Report.created_at.desc(), Report.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return ReportListResponse(
        items=items,
        limit=limit,
        offset=offset,
        total=total,
    )


@router.get(
    "/{report_id}",
    response_model=ReportResponse,
    summary="Retrieve Citizen Report by ID",
    description="Retrieve a single citizen observation report by its UUID.",
)
def get_report(
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    db: Session = Depends(get_db),
) -> Report:
    """Retrieve an existing evidence report by UUID."""
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' not found",
        )
    return db_report


@router.get(
    "/{report_id}/evidence-quality",
    response_model=EvidenceQualityResponse,
    summary="Assess Report Evidence Quality",
    description=(
        "Deterministically evaluates the evidence completeness of a citizen report. "
        "Provides explainable completeness metrics and actionable recommendations without "
        "making environmental health, pollution, or diagnostic claims."
    ),
)
def get_report_evidence_quality(
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    db: Session = Depends(get_db),
) -> EvidenceQualityResponse:
    """Evaluate and return the evidence completeness assessment for a report."""
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' not found",
        )
    return assess_evidence_quality(db_report)


@router.post(
    "/{report_id}/media",
    response_model=ReportMediaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Citizen Media Evidence",
    description=(
        "Securely ingests image evidence (JPEG, PNG, WebP up to 10MB) for an existing report. "
        "Validates actual binary content, verifies pixel decodability, enforces decompression limits, "
        "calculates a SHA-256 checksum, and persists structured metadata in PostgreSQL."
    ),
)
async def upload_report_media(
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    file: UploadFile = File(..., description="Image evidence file (JPEG, PNG, WebP)"),
    db: Session = Depends(get_db),
) -> ReportMediaResponse:
    """Upload and attach validated image evidence to an observation report."""
    file_bytes = await file.read()
    media_record = ingest_report_media(
        report_id=report_id,
        file_bytes=file_bytes,
        original_filename=file.filename,
        db=db,
    )

    # Publish EVIDENCE_UPDATED event post-commit
    connection_manager.publish_event(
        event_type=RealtimeEventType.EVIDENCE_UPDATED,
        case_id=report_id,
        report_id=report_id,
        payload={"update_type": "MEDIA_UPLOADED", "media_id": str(media_record.id)},
    )

    return media_record


@router.get(
    "/{report_id}/evidence-interview",
    response_model=EvidenceInterviewResponse,
    summary="Generate Targeted Follow-Up Questions",
    description=(
        "Deterministically generates up to 2 targeted follow-up questions to help the citizen "
        "document missing observational evidence without speculative diagnoses."
    ),
)
def get_report_evidence_interview(
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    db: Session = Depends(get_db),
) -> EvidenceInterviewResponse:
    """Retrieve prioritized follow-up interview questions for an observation report."""
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' not found",
        )
    return generate_interview_questions(db_report)


@router.post(
    "/{report_id}/evidence-interview/answers",
    response_model=EvidenceInterviewAnswersResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit Evidence Interview Answers",
    description=(
        "Validates citizen follow-up answers, updates the report's observational fields, "
        "and recalculates the resulting evidence completeness."
    ),
)
def submit_report_evidence_interview_answers(
    request: EvidenceInterviewAnswersRequest,
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    db: Session = Depends(get_db),
) -> EvidenceInterviewAnswersResponse:
    """Validate citizen answers, update report fields, and return recalculated evidence quality."""
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' not found",
        )

    updated_report, updated_fields = apply_interview_answers(
        report=db_report,
        answers=request.answers,
        db=db,
    )

    recalculated_quality = assess_evidence_quality(updated_report)

    # Publish EVIDENCE_UPDATED event post-commit
    connection_manager.publish_event(
        event_type=RealtimeEventType.EVIDENCE_UPDATED,
        case_id=updated_report.id,
        report_id=updated_report.id,
        payload={"update_type": "INTERVIEW_ANSWERED", "updated_fields": updated_fields},
    )

    return EvidenceInterviewAnswersResponse(
        report_id=updated_report.id,
        updated_fields=updated_fields,
        message="Evidence interview answers successfully recorded.",
        evidence_quality=recalculated_quality,
    )


@router.get(
    "/{report_id}/evidence-case",
    response_model=EvidenceCaseResponse,
    summary="Retrieve Structured Evidence Case",
    description=(
        "Aggregates citizen observations, visual media metadata, evidence quality completeness, "
        "interview updates, and provenance into a single transparent Evidence Case."
    ),
)
def get_report_evidence_case(
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    db: Session = Depends(get_db),
) -> EvidenceCaseResponse:
    """Retrieve aggregated Evidence Case representation for a report."""
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' not found",
        )
    return assemble_evidence_case(db_report)


@router.get(
    "/{report_id}/evidence-contract",
    response_model=EvidenceContractResponse,
    summary="Retrieve SignalGuard Evidence Contract",
    description=(
        "Returns the deterministic SignalGuard Evidence Trust Contract. "
        "Separates evidence classes (E1-E5), sources, explicit uncertainties, "
        "allowed follow-up actions, and strictly prohibited interpretations without "
        "making unsupported scientific or diagnostic assertions."
    ),
)
def get_report_evidence_contract(
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    db: Session = Depends(get_db),
) -> EvidenceContractResponse:
    """Retrieve deterministic SignalGuard Evidence Trust Contract for a report."""
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' not found",
        )
    return assemble_evidence_contract(db_report)


@router.get(
    "/{report_id}/media-observations",
    response_model=ReportMediaObservationsResponse,
    summary="Extract Media Visual Observations",
    description=(
        "Extracts observable, non-diagnostic visual signals from attached media evidence. "
        "Observations are classified strictly as E2_OBSERVED with explicit uncertainty "
        "boundaries without asserting environmental or diagnostic conclusions."
    ),
)
def get_report_media_observations(
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    db: Session = Depends(get_db),
) -> ReportMediaObservationsResponse:
    """Retrieve structured visual observations for all media attached to an observation report."""
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' not found",
        )
    return extract_report_media_observations(db_report)


@router.get(
    "/{report_id}/contextual-evidence",
    response_model=PatternEchoResponse,
    summary="Retrieve Pattern Echo Contextual Evidence",
    description=(
        "Retrieves nearby historical freshwater observation reports with similar "
        "characteristics based on bounded spatial and temporal proximity. "
        "Strictly provides transparent historical context without claiming environmental causation."
    ),
)
def get_report_contextual_evidence(
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    radius_meters: float = Query(
        default=1000.0,
        ge=10.0,
        le=50000.0,
        description="Spatial search radius in meters",
    ),
    window_days: int = Query(
        default=30,
        ge=1,
        le=365,
        description="Historical search window in days",
    ),
    limit: int = Query(
        default=5,
        ge=1,
        le=20,
        description="Maximum number of matching historical cases to return",
    ),
    db: Session = Depends(get_db),
) -> PatternEchoResponse:
    """Retrieve deterministic Pattern Echo historical contextual evidence for a report."""
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' not found",
        )
    return evaluate_pattern_echo(
        report=db_report,
        db=db,
        search_radius_meters=radius_meters,
        historical_window_days=window_days,
        max_cases=limit,
    )


@router.get(
    "/{report_id}/triage",
    response_model=TriageResponse,
    summary="Retrieve Evidence Triage Recommendation",
    description=(
        "Deterministically evaluates available multi-source evidence (completeness, visual observations, "
        "historical context, and review status) and recommends the next evidence-handling action. "
        "Strictly provides workflow guidance without asserting environmental diagnosis, causation, or contamination."
    ),
)
def get_report_evidence_triage(
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    db: Session = Depends(get_db),
) -> TriageResponse:
    """Retrieve deterministic evidence triage next-action recommendation for an observation report."""
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' not found",
        )
    return evaluate_evidence_triage(report=db_report, db=db)


@router.get(
    "/{report_id}/impact-status",
    response_model=CitizenImpactStatusResponse,
    summary="Retrieve Non-Sensitive Citizen Impact Status",
    description=(
        "Returns non-sensitive impact status suitable for citizen tracking. "
        "Strictly excludes researcher identity, internal reviewer rationales, and private case linkages."
    ),
)
def get_report_impact_status(
    report_id: UUID = Path(..., description="Unique UUID identifier of the report"),
    db: Session = Depends(get_db),
) -> CitizenImpactStatusResponse:
    """Retrieve safe, non-sensitive impact status for a citizen observation report."""
    return get_citizen_impact_status(db=db, case_id=report_id)
