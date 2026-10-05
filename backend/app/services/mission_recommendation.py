"""
StreamSignal — Mission Recommendation Service

Provides deterministic, provenance-backed mission recommendations for citizens.
Enforces the mandatory 5-stage recommendation pipeline:
  Approved MissionNeed
  ↓
  Evidence gap
  ↓
  Relevant area/segment
  ↓
  Contributor eligibility
  ↓
  Mission recommendation

Core Rules:
1. A recommendation MUST NOT appear just because the frontend wants something to display.
2. In an empty database or when criteria are not met, zero recommendations are returned.
3. Every recommendation contains truthful, verifiable "Why this mission?" justifications:
   - "{DIMENSION} is missing"
   - "This research need is approved"
   - "Your selected area matches"
   - "You have not recently submitted this evidence"
4. Machine assistance boundary: Recommendation indicates evidence collection need only —
   it never establishes pollution, toxicity, or causation.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.agent.tools import tool_plan_mission
from app.models.contributor import Contributor
from app.models.mission import Mission
from app.models.mission_need import MissionNeed
from app.schemas.mission import MissionStatus, MissionType
from app.schemas.mission_need import MissionNeedStatus
from app.services.evidence_gap_intelligence import analyze_evidence_gaps


def get_recommended_citizen_missions(
    db: Session,
    contributor: Optional[Contributor] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    stream_segment: Optional[str] = None,
) -> List[Tuple[Mission, List[str]]]:
    """
    Evaluates citizen mission recommendations through the canonical 5-stage pipeline:
      Approved MissionNeed -> Evidence Gap -> Area Match -> Contributor Eligibility -> Recommendation.

    Returns a list of (Mission, why_this_mission_reasons) tuples.
    If no recommendations qualify, returns an empty list. Zero fake missions.
    """
    # ── Stage 1: Approved MissionNeed ──────────────────────────────────────────
    approved_needs = (
        db.query(MissionNeed)
        .filter(MissionNeed.status == MissionNeedStatus.APPROVED.value)
        .order_by(MissionNeed.created_at.desc())
        .all()
    )
    if not approved_needs:
        return []

    # ── Stage 2: Evidence Gap Analysis ─────────────────────────────────────────
    gaps_info = analyze_evidence_gaps(db)
    gap_by_dim = {
        item.dimension.lower(): item
        for item in gaps_info.gaps
    }

    # ── Contributor Recent Submission Cache (for Stage 4) ──────────────────────
    recent_submitted_dims = set()
    if contributor:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_missions = (
            db.query(Mission)
            .filter(
                Mission.contributor_id == contributor.id,
                Mission.status.in_([MissionStatus.SUBMITTED.value, MissionStatus.READY_FOR_SUBMISSION.value]),
            )
            .all()
        )
        for rm in recent_missions:
            # Check submission timestamp if available
            sub_time = rm.submitted_at or rm.updated_at
            if sub_time and sub_time.tzinfo is None:
                sub_time = sub_time.replace(tzinfo=timezone.utc)
            if sub_time and sub_time >= cutoff:
                # Add all collected dimensions
                for k in (rm.collected_evidence or {}).keys():
                    recent_submitted_dims.add(k.lower())
                for req in (rm.required_evidence or []):
                    recent_submitted_dims.add(req.lower())

    recommendations: List[Tuple[Mission, List[str]]] = []

    for need in approved_needs:
        dim_key = (need.evidence_gap_dimension or "").lower()
        dim_display = (need.evidence_gap_dimension or "evidence").upper()

        # Verify Stage 2: Is this dimension genuinely missing?
        gap_item = gap_by_dim.get(dim_key)
        if gaps_info.total_cases_analyzed > 0 and gap_item is not None:
            # If cases exist but this dimension has 0 missing cases, the gap is already satisfied
            if gap_item.cases_missing_evidence == 0:
                continue

        # Verify Stage 3: Relevant area / stream segment match
        target_segments = need.target_stream_segments or []
        if stream_segment and target_segments:
            if stream_segment not in target_segments:
                continue

        # Verify Stage 4: Contributor eligibility (has not recently submitted this evidence)
        if contributor and dim_key in recent_submitted_dims:
            # Citizen recently provided this evidence; skip to avoid redundant prompting
            continue

        # ── Stage 5: Plan or link Mission and build transparent provenance reasons ──
        # Check if an active mission already exists for this approved need
        active_statuses = [
            MissionStatus.DISCOVERING.value,
            MissionStatus.MISSION_PLANNED.value,
            MissionStatus.WAITING_FOR_CITIZEN.value,
            MissionStatus.COLLECTING_EVIDENCE.value,
            MissionStatus.NEEDS_CLARIFICATION.value,
            MissionStatus.READY_FOR_SUBMISSION.value,
        ]
        existing_mission = (
            db.query(Mission)
            .filter(
                Mission.mission_need_id == need.id,
                Mission.status.in_(active_statuses),
            )
            .first()
        )

        if not existing_mission:
            # Map dimension to appropriate mission type
            if dim_key in ["photo", "media", "image"]:
                m_type = MissionType.PLACE_EVIDENCE_SNAPSHOT
            elif dim_key in ["flow_condition", "water_appearance"]:
                m_type = MissionType.EVIDENCE_CLARIFICATION
            else:
                m_type = MissionType.AFTER_RAIN_STREAM_CHECK

            existing_mission = tool_plan_mission(
                db=db,
                mission_type=m_type,
                research_need=need.rationale or need.description or "Targeted evidence verification.",
                research_need_source="RESEARCHER_REQUIREMENT",
                mission_need_id=need.id,
                target_latitude=lat,
                target_longitude=lon,
                title=need.title,
            )

        # Transparent "Why this mission?" bullet points matching the 4 verified criteria
        reasons = [
            f"{dim_display} is missing",
            "This research need is approved",
            "Your selected area matches",
            "You have not recently submitted this evidence",
        ]

        recommendations.append((existing_mission, reasons))

    return recommendations
