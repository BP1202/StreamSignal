from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.report import Report
from app.schemas.report import ReportCreate, ReportResponse

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
    """Create a new citizen evidence report with default SUBMITTED status."""
    report_data = report_in.model_dump()
    if report_data.get("observed_at") is None:
        report_data["observed_at"] = datetime.now(timezone.utc)

    db_report = Report(**report_data, status="SUBMITTED")
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


@router.get(
    "/{report_id}",
    response_model=ReportResponse,
    summary="Retrieve Citizen Report by ID",
)
def get_report(
    report_id: UUID,
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
