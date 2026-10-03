"""
StreamSignal — Citizen Mission & Contributor Endpoints
Provides citizen-facing endpoints for:
1. Persistent contributor identity (SS-C-XXXX) and in-place account upgrade
2. Discovering active, allowlisted missions
3. Starting and executing agent-guided missions
4. Submitting validated evidence into the SignalCase pipeline
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.agent.orchestrator import EvidenceMissionAgent
from app.core.database import get_db
from app.models.contributor import Contributor
from app.schemas.contributor import (
    AccountUpgradeRequest,
    AccountUpgradeResponse,
    ContributorResponse,
)
from app.schemas.mission import (
    AgentAuditItem,
    MissionEvidenceSubmission,
    MissionListResponse,
    MissionResponse,
)
from app.services.contributor import (
    get_or_create_contributor,
    upgrade_contributor_account,
)

router = APIRouter(prefix="/citizen", tags=["Citizen Missions & Contributor"])


def get_current_contributor(
    x_contributor_id: Optional[str] = Header(None, alias="X-Contributor-Id"),
    db: Session = Depends(get_db),
) -> Contributor:
    """Dependency retrieving or creating a persistent contributor identity."""
    return get_or_create_contributor(db=db, contributor_id_str=x_contributor_id)


def serialize_mission(mission) -> MissionResponse:
    """Helper to convert Mission model to MissionResponse schema."""
    audits = [
        AgentAuditItem(
            id=a.id,
            mission_id=a.mission_id,
            actor=a.actor,
            action_type=a.action_type,
            tool_used=a.tool_used,
            input_reference=a.input_reference,
            output_reference=a.output_reference,
            reason=a.reason,
            result_summary=a.result_summary,
            created_at=a.created_at,
        )
        for a in (getattr(mission, "agent_audits", []) or [])
    ]
    return MissionResponse(
        id=mission.id,
        mission_type=mission.mission_type,
        status=mission.status,
        title=mission.title,
        purpose=mission.purpose,
        research_need=mission.research_need,
        research_need_source=mission.research_need_source,
        research_need_reference=mission.research_need_reference,
        signal_case_id=mission.signal_case_id,
        contributor_id=mission.contributor_id,
        target_latitude=mission.target_latitude,
        target_longitude=mission.target_longitude,
        required_evidence=list(mission.required_evidence or []),
        collected_evidence=dict(mission.collected_evidence or {}),
        missing_evidence=list(mission.missing_evidence or []),
        validation_results=dict(mission.validation_results or {}),
        next_action=dict(mission.next_action or {}),
        created_at=mission.created_at,
        started_at=mission.started_at,
        submitted_at=mission.submitted_at,
        updated_at=mission.updated_at,
        audits=audits,
    )


@router.get(
    "/me",
    response_model=ContributorResponse,
    status_code=status.HTTP_200_OK,
    summary="Get or Initialize Contributor Identity",
)
def get_contributor_me(
    contributor: Contributor = Depends(get_current_contributor),
) -> ContributorResponse:
    """Returns persistent non-identifying contributor profile."""
    return ContributorResponse.model_validate(contributor)


@router.post(
    "/account/upgrade",
    response_model=AccountUpgradeResponse,
    status_code=status.HTTP_200_OK,
    summary="Upgrade Contributor Account",
)
def upgrade_account(
    req: AccountUpgradeRequest,
    contributor: Contributor = Depends(get_current_contributor),
    db: Session = Depends(get_db),
) -> AccountUpgradeResponse:
    """Upgrades Level 1 contributor in-place to Level 2 without duplicating identity."""
    upgraded = upgrade_contributor_account(
        db=db,
        contributor_id_str=contributor.contributor_id,
        email=req.email,
        password=req.password,
    )
    return AccountUpgradeResponse(
        success=True,
        message="Account successfully upgraded to Level 2 Registered Contributor.",
        contributor=ContributorResponse.model_validate(upgraded),
    )


@router.get(
    "/missions",
    response_model=MissionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Active Citizen Missions",
)
def list_citizen_missions(
    x_contributor_id: Optional[str] = Header(None, alias="X-Contributor-Id"),
    db: Session = Depends(get_db),
) -> MissionListResponse:
    """Lists active, allowlisted missions for citizens."""
    contributor = (
        db.query(Contributor).filter(Contributor.contributor_id == x_contributor_id).first()
        if x_contributor_id
        else None
    )
    missions = EvidenceMissionAgent.get_citizen_missions(
        db=db,
        contributor_id=contributor.id if contributor else None,
    )
    items = [serialize_mission(m) for m in missions]
    return MissionListResponse(missions=items, total=len(items))


@router.get(
    "/missions/{mission_id}",
    response_model=MissionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Mission Detail",
)
def get_mission_detail(
    mission_id: UUID,
    db: Session = Depends(get_db),
) -> MissionResponse:
    """Retrieves full mission state, required evidence, and agent next action."""
    mission = EvidenceMissionAgent.get_mission_by_id(db=db, mission_id=mission_id)
    return serialize_mission(mission)


@router.post(
    "/missions/{mission_id}/start",
    response_model=MissionResponse,
    status_code=status.HTTP_200_OK,
    summary="Start Citizen Mission",
)
def start_mission(
    mission_id: UUID,
    contributor: Contributor = Depends(get_current_contributor),
    db: Session = Depends(get_db),
) -> MissionResponse:
    """Assigns mission to contributor and transitions to COLLECTING_EVIDENCE."""
    mission = EvidenceMissionAgent.start_citizen_mission(
        db=db,
        mission_id=mission_id,
        contributor=contributor,
    )
    return serialize_mission(mission)


@router.post(
    "/missions/{mission_id}/evidence",
    response_model=MissionResponse,
    status_code=status.HTTP_200_OK,
    summary="Provide Evidence Item",
)
def provide_evidence(
    mission_id: UUID,
    submission: MissionEvidenceSubmission,
    contributor: Contributor = Depends(get_current_contributor),
    db: Session = Depends(get_db),
) -> MissionResponse:
    """Ingests citizen evidence and updates missing dimensions."""
    mission = EvidenceMissionAgent.get_mission_by_id(db=db, mission_id=mission_id)
    if mission.contributor_id and mission.contributor_id != contributor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot submit evidence for another contributor's mission.",
        )
    updated = EvidenceMissionAgent.validate_and_guide(
        db=db,
        mission_id=mission_id,
        submission=submission,
    )
    return serialize_mission(updated)


@router.post(
    "/missions/{mission_id}/validate",
    response_model=MissionResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger Agent Validation",
)
def validate_mission(
    mission_id: UUID,
    submission: Optional[MissionEvidenceSubmission] = None,
    contributor: Contributor = Depends(get_current_contributor),
    db: Session = Depends(get_db),
) -> MissionResponse:
    """Triggers agent validation and retrieves next step."""
    mission = EvidenceMissionAgent.get_mission_by_id(db=db, mission_id=mission_id)
    if mission.contributor_id and mission.contributor_id != contributor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot validate another contributor's mission.",
        )
    sub = submission or MissionEvidenceSubmission()
    updated = EvidenceMissionAgent.validate_and_guide(
        db=db,
        mission_id=mission_id,
        submission=sub,
    )
    return serialize_mission(updated)


@router.post(
    "/missions/{mission_id}/submit",
    status_code=status.HTTP_200_OK,
    summary="Submit Completed Mission",
)
def submit_mission(
    mission_id: UUID,
    contributor: Contributor = Depends(get_current_contributor),
    db: Session = Depends(get_db),
) -> dict:
    """Finalizes completed mission and hands off evidence to Report/SignalCase pipeline."""
    report = EvidenceMissionAgent.submit_mission(
        db=db,
        mission_id=mission_id,
        contributor=contributor,
    )
    return {
        "status": "SUBMITTED",
        "mission_id": str(mission_id),
        "case_id": str(report.id),
        "message": "Mission evidence successfully submitted to the Research Evidence Workspace.",
    }
