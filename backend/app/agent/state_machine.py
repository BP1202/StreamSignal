"""
StreamSignal — Evidence Mission State Machine (FSM)
Enforces strictly validated, auditable state transitions for citizen evidence missions.
Frontend and unauthorized actors cannot jump states arbitrarily.
"""

from typing import Dict, Set
from fastapi import HTTPException, status
from app.schemas.mission import MissionStatus

VALID_TRANSITIONS: Dict[MissionStatus, Set[MissionStatus]] = {
    MissionStatus.DISCOVERING: {
        MissionStatus.MISSION_PLANNED,
    },
    MissionStatus.MISSION_PLANNED: {
        MissionStatus.WAITING_FOR_CITIZEN,
    },
    MissionStatus.WAITING_FOR_CITIZEN: {
        MissionStatus.COLLECTING_EVIDENCE,
    },
    MissionStatus.COLLECTING_EVIDENCE: {
        MissionStatus.VALIDATING_EVIDENCE,
        MissionStatus.NEEDS_CLARIFICATION,
        MissionStatus.READY_FOR_SUBMISSION,
    },
    MissionStatus.VALIDATING_EVIDENCE: {
        MissionStatus.COLLECTING_EVIDENCE,
        MissionStatus.NEEDS_CLARIFICATION,
        MissionStatus.READY_FOR_SUBMISSION,
    },
    MissionStatus.NEEDS_CLARIFICATION: {
        MissionStatus.COLLECTING_EVIDENCE,
        MissionStatus.VALIDATING_EVIDENCE,
        MissionStatus.READY_FOR_SUBMISSION,
    },
    MissionStatus.READY_FOR_SUBMISSION: {
        MissionStatus.COLLECTING_EVIDENCE,
        MissionStatus.SUBMITTED,
    },
    MissionStatus.SUBMITTED: {
        MissionStatus.RESEARCH_REVIEW,
    },
    MissionStatus.RESEARCH_REVIEW: set(),  # Terminal state for citizen mission loop
}


def can_transition(current: MissionStatus, target: MissionStatus) -> bool:
    """Returns True if transition from current to target status is mathematically valid."""
    allowed = VALID_TRANSITIONS.get(current, set())
    return target in allowed


def enforce_transition(current: MissionStatus, target: MissionStatus) -> None:
    """
    Validates state transition; raises HTTPException 400 if illegal.
    Protects server-side integrity against client tampering.
    """
    if not can_transition(current, target):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid mission state transition: Cannot transition from "
                f"'{current.value}' to '{target.value}'."
            ),
        )
