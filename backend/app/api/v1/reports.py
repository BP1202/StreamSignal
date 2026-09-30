from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Path, UploadFile, File, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.report import Report
from app.schemas.report import ReportCreate, ReportResponse, ReportListResponse
from app.schemas.evidence_quality import EvidenceQualityResponse
from app.schemas.media import ReportMediaResponse
from app.services.evidence_quality import assess_evidence_quality
from app.services.media import ingest_report_media

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
    return media_record
