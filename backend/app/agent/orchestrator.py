"""
StreamSignal — Evidence Mission Agent Orchestrator
Coordinates the citizen evidence collection lifecycle:
Gap Inspection -> Mission Planning -> Guidance -> Validation -> Pipeline Hand-off.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.agent.registry import list_approved_templates
from app.agent.tools import (
    tool_get_evidence_gap,
    tool_plan_mission,
    tool_start_mission,
    tool_submit_mission_evidence,
    tool_validate_evidence,
)
from app.models.contributor import Contributor
from app.models.mission import Mission
from app.models.report import Report
from app.schemas.mission import (
    MissionAgentAction,
    MissionEvidenceSubmission,
    MissionStatus,
    MissionType,
)


class EvidenceMissionAgent:
    """
    Production-grade, bounded Evidence Mission Agent.
    Operates strictly via allowlisted tools, state machines, and safe evidence schemas.
    Never hallucinates environmental diagnoses or overrides SignalGuard trust contracts.
    """

    @staticmethod
    def inspect_and_plan_from_gap(db: Session, case_id: UUID) -> Mission:
        """
        Inspects an authentic SignalCase, discovers real missing physical dimensions,
        and plans a targeted Evidence Clarification mission.
        """
        gap_info = tool_get_evidence_gap(db=db, case_id=case_id)
        report = db.query(Report).filter(Report.id == case_id).first()
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SignalCase '{case_id}' not found.",
            )

        missing_dims = gap_info.get("missing_dimensions", [])
        research_need = (
            f"Case requires physical verification of missing dimensions: {', '.join(missing_dims)}."
            if missing_dims
            else "Follow-up verification needed for reported surface cues."
        )

        mission = tool_plan_mission(
            db=db,
            mission_type=MissionType.EVIDENCE_CLARIFICATION,
            research_need=research_need,
            research_need_source="SIGNAL_CASE_EVIDENCE_GAP",
            research_need_reference=str(case_id),
            signal_case_id=case_id,
            target_latitude=report.latitude,
            target_longitude=report.longitude,
        )
        return mission

    @staticmethod
    def get_citizen_missions(
        db: Session,
        contributor_id: Optional[UUID] = None,
    ) -> List[Mission]:
        """
        Returns active missions available for citizens or assigned to the specific contributor.
        Zero fake data: returns strictly persisted database records.
        """
        query = db.query(Mission).options(joinedload(Mission.agent_audits))
        if contributor_id:
            query = query.filter(
                (Mission.contributor_id == contributor_id) | (Mission.contributor_id.is_(None))
            )
        else:
            query = query.filter(Mission.contributor_id.is_(None))

        # Show active, non-archived missions
        active_statuses = [
            MissionStatus.WAITING_FOR_CITIZEN.value,
            MissionStatus.COLLECTING_EVIDENCE.value,
            MissionStatus.NEEDS_CLARIFICATION.value,
            MissionStatus.READY_FOR_SUBMISSION.value,
        ]
        return (
            query.filter(Mission.status.in_(active_statuses))
            .order_by(Mission.created_at.desc())
            .all()
        )

    @staticmethod
    def get_mission_by_id(db: Session, mission_id: UUID) -> Mission:
        """Retrieves single mission with audits."""
        mission = (
            db.query(Mission)
            .options(joinedload(Mission.agent_audits))
            .filter(Mission.id == mission_id)
            .first()
        )
        if not mission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Mission '{mission_id}' not found.",
            )
        return mission

    @staticmethod
    def start_citizen_mission(
        db: Session,
        mission_id: UUID,
        contributor: Contributor,
    ) -> Mission:
        """Assigns mission to contributor and transitions to COLLECTING_EVIDENCE."""
        return tool_start_mission(
            db=db,
            mission_id=mission_id,
            contributor_id=contributor.id,
        )

    @staticmethod
    def validate_and_guide(
        db: Session,
        mission_id: UUID,
        submission: MissionEvidenceSubmission,
    ) -> Mission:
        """Ingests evidence, deterministically validates, and updates agent next action."""
        return tool_validate_evidence(
            db=db,
            mission_id=mission_id,
            submission=submission,
        )

    @staticmethod
    def submit_mission(
        db: Session,
        mission_id: UUID,
        contributor: Contributor,
    ) -> Report:
        """Finalizes evidence submission into the authoritative Report / SignalCase pipeline."""
        return tool_submit_mission_evidence(
            db=db,
            mission_id=mission_id,
            contributor_id=contributor.id,
        )
