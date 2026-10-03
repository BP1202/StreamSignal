"""
StreamSignal — Evidence Mission Agent API Endpoints
Provides explicit endpoints for mission planning and agent next-action evaluation.
"""

from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.agent.orchestrator import EvidenceMissionAgent
from app.agent.registry import list_approved_templates
from app.agent.tools import tool_plan_mission
from app.core.database import get_db
from app.schemas.mission import (
    MissionAgentAction,
    MissionCreateRequest,
    MissionResponse,
)
from app.api.v1.citizen_missions import serialize_mission

router = APIRouter(prefix="/agent", tags=["Evidence Mission Agent"])


@router.get(
    "/templates",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="List Allowlisted Mission Templates",
)
def get_mission_templates() -> List[Dict[str, Any]]:
    """Returns approved mission templates from the registry."""
    return list_approved_templates()


@router.post(
    "/missions/plan",
    response_model=MissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Plan Evidence Mission",
)
def plan_mission_endpoint(
    req: Optional[MissionCreateRequest] = None,
    case_id: Optional[UUID] = Query(None, description="Plan mission from an existing SignalCase evidence gap"),
    db: Session = Depends(get_db),
) -> MissionResponse:
    """Plans a targeted mission using real evidence gap analysis or researcher requirements."""
    if case_id:
        mission = EvidenceMissionAgent.inspect_and_plan_from_gap(db=db, case_id=case_id)
    elif req:
        mission = tool_plan_mission(
            db=db,
            mission_type=req.mission_type,
            research_need=req.research_need,
            research_need_source=req.research_need_source,
            research_need_reference=req.research_need_reference,
            signal_case_id=req.signal_case_id,
            target_latitude=req.target_latitude,
            target_longitude=req.target_longitude,
            title=req.title,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'case_id' query parameter or request body.",
        )
    return serialize_mission(mission)


@router.get(
    "/missions/{mission_id}/next-action",
    response_model=MissionAgentAction,
    status_code=status.HTTP_200_OK,
    summary="Get Agent Next Action",
)
def get_mission_next_action(
    mission_id: UUID,
    db: Session = Depends(get_db),
) -> MissionAgentAction:
    """Returns current structured next action calculated by the agent."""
    mission = EvidenceMissionAgent.get_mission_by_id(db=db, mission_id=mission_id)
    next_action_dict = mission.next_action or {}
    if not next_action_dict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No next action generated for this mission.",
        )
    return MissionAgentAction.model_validate(next_action_dict)
