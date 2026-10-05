"""
StreamSignal — Mission Need Service (Issue 17)

Manages the lifecycle of researcher-created Mission Needs.
Enforces the canonical lifecycle FSM and researcher authority constraints.

Key rules:
  - Only researchers can create and approve MissionNeeds.
  - The Evidence Mission Agent may only READ APPROVED MissionNeeds.
  - Status transitions follow the canonical FSM — no arbitrary updates.
  - Fulfilled/Closed needs are immutable.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.mission_need import MissionNeed
from app.schemas.mission_need import (
    MissionNeedCreate,
    MissionNeedResponse,
    MissionNeedStatus,
    MISSION_NEED_TRANSITIONS,
)

logger = logging.getLogger("streamsignal.mission_need")


class MissionNeedTransitionError(Exception):
    """Raised when a requested lifecycle transition is not permitted."""


class MissionNeedNotFoundError(Exception):
    """Raised when a Mission Need cannot be located."""


# ──────────────────────────────────────────────────────────────────────────────
# CRUD
# ──────────────────────────────────────────────────────────────────────────────

def create_mission_need(
    db: Session,
    payload: MissionNeedCreate,
) -> MissionNeed:
    """
    Persist a new Mission Need at IDENTIFIED status.
    The researcher provides explicit rationale and source case IDs.
    """
    need = MissionNeed(
        evidence_gap_dimension=payload.evidence_gap_dimension,
        title=payload.title,
        description=payload.description,
        rationale=payload.rationale,
        source_case_ids=payload.source_case_ids,
        target_stream_segments=payload.target_stream_segments,
        required_evidence=payload.required_evidence,
        created_by_researcher=payload.created_by_researcher,
        status=MissionNeedStatus.IDENTIFIED.value,
    )
    db.add(need)
    db.commit()
    db.refresh(need)
    logger.info("Mission Need created: id=%s, dimension=%s", need.id, need.evidence_gap_dimension)
    return need


def list_mission_needs(
    db: Session,
    status: Optional[str] = None,
    dimension: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[MissionNeed]:
    """Return Mission Needs filtered by optional status/dimension."""
    q = select(MissionNeed).order_by(MissionNeed.created_at.desc())
    if status:
        q = q.where(MissionNeed.status == status)
    if dimension:
        q = q.where(MissionNeed.evidence_gap_dimension == dimension)
    q = q.limit(limit).offset(offset)
    result = db.execute(q)
    return list(result.scalars().all())


def get_mission_need(
    db: Session,
    need_id: UUID,
) -> Optional[MissionNeed]:
    result = db.execute(
        select(MissionNeed).where(MissionNeed.id == need_id)
    )
    return result.scalar_one_or_none()


def transition_mission_need(
    db: Session,
    need_id: UUID,
    to_status: MissionNeedStatus,
) -> MissionNeed:
    """
    Advance a Mission Need through its canonical lifecycle FSM.
    Raises MissionNeedTransitionError if the transition is not permitted.
    """
    need = get_mission_need(db, need_id)
    if need is None:
        raise MissionNeedNotFoundError(f"MissionNeed {need_id} not found.")

    current = MissionNeedStatus(need.status)
    allowed = MISSION_NEED_TRANSITIONS.get(current, [])

    if to_status not in allowed:
        raise MissionNeedTransitionError(
            f"Transition from {current.value} → {to_status.value} is not permitted. "
            f"Allowed from {current.value}: {[s.value for s in allowed]}"
        )

    need.status = to_status.value
    if to_status == MissionNeedStatus.APPROVED:
        need.approved_at = datetime.now(timezone.utc)
    elif to_status == MissionNeedStatus.FULFILLED:
        need.fulfilled_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(need)
    logger.info("Mission Need %s transitioned: %s → %s", need_id, current.value, to_status.value)
    return need


def list_approved_for_agent(
    db: Session,
    dimension: Optional[str] = None,
) -> List[MissionNeed]:
    """
    Return APPROVED MissionNeeds consumable by the Evidence Mission Agent.
    The agent uses these to plan citizen missions.
    Only APPROVED records are exposed — the agent cannot act on IDENTIFIED or REVIEWED needs.
    """
    q = select(MissionNeed).where(
        MissionNeed.status == MissionNeedStatus.APPROVED.value
    ).order_by(MissionNeed.created_at.asc())
    if dimension:
        q = q.where(MissionNeed.evidence_gap_dimension == dimension)
    result = db.execute(q)
    return list(result.scalars().all())
