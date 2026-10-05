"""
StreamSignal — Mission Need API (Issue 17)
Research Workspace endpoints for creating, reviewing, and approving Mission Needs.

Only researchers interact with these endpoints.
The Evidence Mission Agent uses read-only GET /approved to consume APPROVED needs.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.mission_need import (
    MissionNeedCreate,
    MissionNeedListResponse,
    MissionNeedResponse,
    MissionNeedStatus,
)
from app.services.mission_need import (
    MissionNeedNotFoundError,
    MissionNeedTransitionError,
    create_mission_need,
    get_mission_need,
    list_mission_needs,
    list_approved_for_agent,
    transition_mission_need,
)
from app.services.realtime import RealtimeEventType, connection_manager

router = APIRouter()


@router.post(
    "/mission-needs",
    response_model=MissionNeedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a researcher-approved Mission Need",
    description=(
        "Persists a new Mission Need at IDENTIFIED status. "
        "Requires explicit researcher rationale and source SignalCase IDs. "
        "The Evidence Mission Agent may only consume APPROVED needs — never IDENTIFIED."
    ),
)
def create_need(
    payload: MissionNeedCreate,
    db: Session = Depends(get_db),
) -> MissionNeedResponse:
    need = create_mission_need(db, payload)
    connection_manager.publish_event(
        event_type=RealtimeEventType.MISSION_CREATED,
        case_id=need.id,
        report_id=need.id,
        payload={
            "mission_need_id": str(need.id),
            "dimension": need.evidence_gap_dimension,
            "status": need.status,
        },
    )
    return MissionNeedResponse.model_validate(need)


@router.get(
    "/mission-needs",
    response_model=MissionNeedListResponse,
    summary="List Mission Needs (researcher workspace)",
    description="Returns all Mission Needs, optionally filtered by status or dimension.",
)
def list_needs(
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        description="Filter by lifecycle status (e.g. IDENTIFIED, APPROVED)",
    ),
    dimension: Optional[str] = Query(default=None, description="Filter by evidence dimension"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> MissionNeedListResponse:
    needs = list_mission_needs(db, status=status_filter, dimension=dimension, limit=limit, offset=offset)
    total = len(needs)
    return MissionNeedListResponse(
        needs=[MissionNeedResponse.model_validate(n) for n in needs],
        total=total,
    )


@router.get(
    "/mission-needs/approved",
    response_model=MissionNeedListResponse,
    summary="List APPROVED Mission Needs (agent-consumable)",
    description=(
        "Returns only APPROVED Mission Needs. "
        "This endpoint is the gate through which the Evidence Mission Agent accesses researcher-approved needs. "
        "The agent may not access IDENTIFIED or REVIEWED needs."
    ),
)
def list_approved(
    dimension: Optional[str] = Query(default=None, description="Filter by evidence dimension"),
    db: Session = Depends(get_db),
) -> MissionNeedListResponse:
    needs = list_approved_for_agent(db, dimension=dimension)
    return MissionNeedListResponse(
        needs=[MissionNeedResponse.model_validate(n) for n in needs],
        total=len(needs),
    )


@router.get(
    "/mission-needs/{need_id}",
    response_model=MissionNeedResponse,
    summary="Get a specific Mission Need",
)
def get_need(
    need_id: UUID,
    db: Session = Depends(get_db),
) -> MissionNeedResponse:
    need = get_mission_need(db, need_id)
    if need is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission Need not found.")
    return MissionNeedResponse.model_validate(need)


@router.patch(
    "/mission-needs/{need_id}/status",
    response_model=MissionNeedResponse,
    summary="Advance Mission Need lifecycle (researcher action)",
    description=(
        "Transitions a Mission Need to the next lifecycle status. "
        "Only forward transitions are permitted per the canonical FSM. "
        "Researchers approve — the agent never calls this endpoint."
    ),
)
def transition_need(
    need_id: UUID,
    to_status: MissionNeedStatus,
    db: Session = Depends(get_db),
) -> MissionNeedResponse:
    try:
        need = transition_mission_need(db, need_id, to_status)
    except MissionNeedNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission Need not found.")
    except MissionNeedTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    connection_manager.publish_event(
        event_type=RealtimeEventType.MISSION_UPDATED,
        case_id=need.id,
        report_id=need.id,
        payload={
            "mission_need_id": str(need.id),
            "dimension": need.evidence_gap_dimension,
            "status": need.status,
        },
    )
    return MissionNeedResponse.model_validate(need)
