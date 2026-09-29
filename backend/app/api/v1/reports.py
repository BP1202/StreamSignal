from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.report import Report
from app.schemas.report import ReportCreate, ReportResponse, ReportListResponse

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
