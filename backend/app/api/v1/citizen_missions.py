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
from app.models.human_review import HumanReview
from app.models.mission import Mission
from app.schemas.citizen_impact import (
    ContributionHistoryItem,
    ContributorImpactResponse,
)
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
from app.services.evidence_gap_intelligence import analyze_evidence_gaps

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


@router.get(
    "/impact",
    response_model=ContributorImpactResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Contributor Impact and Coverage Delta",
)
def get_contributor_impact(
    contributor: Contributor = Depends(get_current_contributor),
    db: Session = Depends(get_db),
) -> ContributorImpactResponse:
    """
    Returns real, deterministic impact metrics for the authenticated citizen:
    - Evidence coverage before and after contributions
    - List of submitted contributions linked to SignalCases
    - Research review status (Pending review vs Accepted for research)
    - Factual stewardship milestones
    """
    gaps_info = analyze_evidence_gaps(db)
    per_dim_delta = gaps_info.potential_coverage_per_dimension or 0.89

    # Query missions submitted by this contributor
    submitted_statuses = ["SUBMITTED", "RESEARCH_REVIEW", "COMPLETED"]
    missions = (
        db.query(Mission)
        .filter(
            Mission.contributor_id == contributor.id,
            Mission.status.in_(submitted_statuses),
        )
        .order_by(Mission.updated_at.desc())
        .all()
    )

    tracked_keys = {"flow_condition", "water_appearance", "odor", "foam_observed", "dead_wildlife_observed", "photo"}

    recent_items = []
    total_dims_contributed = 0
    verified_count = 0
    has_flow = False
    has_rain = False

    for m in missions:
        collected = dict(m.collected_evidence or {})
        dims = [k for k in collected.keys() if k in tracked_keys and collected[k] is not None]
        if "flow_condition" in dims:
            has_flow = True
        if m.mission_type == "AFTER_RAIN_STREAM_CHECK":
            has_rain = True

        total_dims_contributed += len(dims)
        dim_delta = round(len(dims) * per_dim_delta, 2)

        # Determine review status
        rev_status = "AWAITING_REVIEW"
        if m.signal_case_id:
            latest_review = (
                db.query(HumanReview)
                .filter(HumanReview.signal_case_id == m.signal_case_id)
                .order_by(HumanReview.created_at.desc())
                .first()
            )
            if latest_review:
                if latest_review.outcome in ["VERIFIED", "ACCEPTED"]:
                    rev_status = "ACCEPTED_FOR_RESEARCH"
                    verified_count += 1
                elif latest_review.outcome in ["INSUFFICIENT_EVIDENCE", "REJECTED"]:
                    rev_status = "MORE_EVIDENCE_REQUESTED"

        recent_items.append(
            ContributionHistoryItem(
                submission_id=m.id,
                signal_case_id=m.signal_case_id,
                mission_title=m.title,
                dimensions_provided=dims,
                submitted_at=m.submitted_at or m.updated_at,
                review_status=rev_status,
                coverage_delta_pct=dim_delta,
            )
        )

    # Stewardship milestones
    milestones = []
    if len(missions) > 0:
        milestones.append("First Signal")
    if has_flow:
        milestones.append("Flow Observer")
    if has_rain:
        milestones.append("Rainwatch Contributor")
    if len(missions) >= 3:
        milestones.append("Stream Steward")

    total_delta = round(total_dims_contributed * per_dim_delta, 2)

    return ContributorImpactResponse(
        contributor_id=contributor.contributor_id,
        display_name=contributor.display_name,
        account_level=contributor.account_level,
        total_contributions=len(missions),
        verified_contributions=verified_count,
        overall_evidence_coverage=gaps_info.overall_coverage_percentage,
        total_coverage_delta_contributed=total_delta,
        recent_contributions=recent_items,
        stewardship_milestones=milestones,
    )



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
