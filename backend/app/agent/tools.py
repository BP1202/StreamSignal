"""
StreamSignal — Evidence Mission Agent Tool Layer & Execution Firewall
Restricts agent capabilities to allowlisted domain operations.
Blocks arbitrary SQL, shell, filesystem, and unapproved API access.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.agent.providers import get_agent_provider
from app.agent.registry import get_template_for_type
from app.agent.state_machine import enforce_transition
from app.models.contributor import Contributor
from app.models.media import ReportMedia
from app.models.mission import AgentActionAudit, Mission
from app.models.report import Report
from app.schemas.mission import (
    MissionAgentAction,
    MissionEvidenceSubmission,
    MissionStatus,
    MissionType,
)
from app.services.evidence_quality import assess_evidence_quality
from app.services.realtime import connection_manager, RealtimeEventType

ALLOWED_AGENT_TOOLS = {
    "get_evidence_gap",
    "plan_mission",
    "get_mission",
    "start_mission",
    "validate_evidence",
    "submit_mission_evidence",
}


def assert_tool_allowed(tool_name: str) -> None:
    """Tool execution firewall: blocks any unallowlisted tool calls."""
    if tool_name not in ALLOWED_AGENT_TOOLS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"AGENT_ACTION_NOT_ALLOWED: Tool '{tool_name}' is not in the authorized agent tool allowlist.",
        )


def tool_get_evidence_gap(db: Session, case_id: UUID) -> Dict[str, Any]:
    """
    Inspects real PostgreSQL state of a SignalCase to discover missing evidence dimensions.
    """
    assert_tool_allowed("get_evidence_gap")
    report = db.query(Report).filter(Report.id == case_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SignalCase '{case_id}' not found.",
        )

    quality = assess_evidence_quality(report)
    media_count = db.query(ReportMedia).filter(ReportMedia.report_id == case_id).count()

    missing = list(quality.missing)
    if media_count == 0 and "photo" not in missing:
        missing.append("photo")

    return {
        "case_id": str(report.id),
        "description": report.description,
        "present_dimensions": quality.present,
        "missing_dimensions": missing,
        "quality_tier": quality.quality.value,
        "completeness_score": quality.score,
        "media_count": media_count,
        "triage_need": (
            "FLOW_OBSERVATION_MISSING" if "flow_condition" in missing
            else ("MEDIA_DOCUMENTATION_MISSING" if media_count == 0 else "FURTHER_CLARIFICATION_NEEDED")
        ),
    }


def tool_plan_mission(
    db: Session,
    mission_type: MissionType,
    research_need: Optional[str] = None,
    research_need_source: str = "TEMPLATE",
    research_need_reference: Optional[str] = None,
    signal_case_id: Optional[UUID] = None,
    target_latitude: Optional[float] = None,
    target_longitude: Optional[float] = None,
    title: Optional[str] = None,
) -> Mission:
    """
    Plans and persists a targeted citizen evidence mission derived from approved templates.
    """
    assert_tool_allowed("plan_mission")
    template = get_template_for_type(mission_type)

    active_statuses = [
        MissionStatus.DISCOVERING.value,
        MissionStatus.MISSION_PLANNED.value,
        MissionStatus.WAITING_FOR_CITIZEN.value,
        MissionStatus.COLLECTING_EVIDENCE.value,
        MissionStatus.VALIDATING_EVIDENCE.value,
        MissionStatus.NEEDS_CLARIFICATION.value,
        MissionStatus.READY_FOR_SUBMISSION.value,
    ]

    # Idempotency check 1: If mission is linked to a specific SignalCase evidence gap
    if signal_case_id:
        existing = (
            db.query(Mission)
            .filter(
                Mission.signal_case_id == signal_case_id,
                Mission.status.in_(active_statuses),
            )
            .first()
        )
        if existing:
            return existing

    # Idempotency check 2: If an identical unassigned mission is already open and waiting for citizens
    else:
        existing_query = db.query(Mission).filter(
            Mission.mission_type == mission_type.value,
            Mission.status.in_([
                MissionStatus.DISCOVERING.value,
                MissionStatus.MISSION_PLANNED.value,
                MissionStatus.WAITING_FOR_CITIZEN.value,
            ]),
            Mission.contributor_id.is_(None),
            Mission.signal_case_id.is_(None),
        )
        if title:
            existing_query = existing_query.filter(Mission.title == title)
        if target_latitude is not None and target_longitude is not None:
            existing_query = existing_query.filter(
                func.abs(Mission.target_latitude - target_latitude) < 0.001,
                func.abs(Mission.target_longitude - target_longitude) < 0.001,
            )
        existing = existing_query.first()
        if existing:
            return existing

    mission = Mission(
        mission_type=mission_type.value,
        status=MissionStatus.WAITING_FOR_CITIZEN.value,
        title=title or template["title"],
        purpose=template["purpose"],
        research_need=research_need or template["research_need"],
        research_need_source=research_need_source,
        research_need_reference=research_need_reference,
        signal_case_id=signal_case_id,
        target_latitude=target_latitude,
        target_longitude=target_longitude,
        required_evidence=template["required_evidence"],
        collected_evidence={},
        missing_evidence=list(template["required_evidence"]),
        validation_results={},
        next_action={},
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)

    # Initial Agent Action computation
    context = {
        "title": mission.title,
        "purpose": mission.purpose,
        "required_evidence": mission.required_evidence,
        "collected_evidence": {},
        "micro_learning": template.get("micro_learning"),
    }
    # Initial next action generated via provider
    provider = get_agent_provider()
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                action = pool.submit(asyncio.run, provider.generate_action(context)).result()
        else:
            action = loop.run_until_complete(provider.generate_action(context))
    except Exception:
        # Fallback to direct synchronous evaluation from rule provider
        from app.agent.providers import DeterministicRuleProvider
        action = asyncio.run(DeterministicRuleProvider().generate_action(context))

    mission.next_action = action.model_dump()
    db.commit()
    db.refresh(mission)

    # Record Agent Audit Event
    audit = AgentActionAudit(
        mission_id=mission.id,
        actor="AGENT",
        action_type="MISSION_PLANNED",
        tool_used="plan_mission",
        input_reference=str(signal_case_id) if signal_case_id else "TEMPLATE",
        output_reference=str(mission.id),
        reason=f"Planned mission of type '{mission_type.value}' to address research need.",
        result_summary=f"Mission created with required evidence: {mission.required_evidence}",
    )
    db.add(audit)
    db.commit()

    return mission


def tool_start_mission(db: Session, mission_id: UUID, contributor_id: UUID) -> Mission:
    """
    Assigns a mission to an authentic contributor and transitions state to COLLECTING_EVIDENCE.
    """
    assert_tool_allowed("start_mission")
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission '{mission_id}' not found.",
        )

    if mission.contributor_id and mission.contributor_id != contributor_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mission is already assigned to another contributor.",
        )

    current_status = MissionStatus(mission.status)
    enforce_transition(current_status, MissionStatus.COLLECTING_EVIDENCE)

    mission.contributor_id = contributor_id
    mission.status = MissionStatus.COLLECTING_EVIDENCE.value
    mission.started_at = datetime.now(timezone.utc)

    audit = AgentActionAudit(
        mission_id=mission.id,
        actor="CITIZEN",
        action_type="MISSION_STARTED",
        tool_used="start_mission",
        input_reference=str(contributor_id),
        output_reference=str(mission.id),
        reason="Citizen contributor initiated evidence collection for this mission.",
        result_summary="Status transitioned to COLLECTING_EVIDENCE.",
    )
    db.add(audit)
    db.commit()
    db.refresh(mission)
    return mission


def tool_validate_evidence(
    db: Session,
    mission_id: UUID,
    submission: MissionEvidenceSubmission,
    contributor_id: Optional[UUID] = None,
) -> Mission:
    """
    Ingests observational or media evidence, evaluates required dimensions deterministically,
    and updates the mission state machine and agent next-action.
    """
    assert_tool_allowed("validate_evidence")
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission '{mission_id}' not found.",
        )

    # Contributor authorization check
    if mission.contributor_id and contributor_id and mission.contributor_id != contributor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not authorized to modify another contributor's mission.",
        )

    collected = dict(mission.collected_evidence or {})

    # Ingest submitted physical dimensions
    if submission.description:
        collected["description"] = submission.description.strip()
    if submission.water_appearance:
        collected["water_appearance"] = submission.water_appearance.strip()
    if submission.flow_condition:
        collected["flow_condition"] = submission.flow_condition.strip()
    if submission.odor:
        collected["odor"] = submission.odor.strip()
    if submission.foam_observed is not None:
        collected["foam_observed"] = submission.foam_observed
    if submission.litter_observed is not None:
        collected["litter_observed"] = submission.litter_observed
    if submission.dead_wildlife_observed is not None:
        collected["dead_wildlife_observed"] = submission.dead_wildlife_observed
    if submission.media_id:
        collected["photo"] = str(submission.media_id)
        collected["media_id"] = str(submission.media_id)
    if submission.latitude is not None and submission.longitude is not None:
        collected["location"] = {
            "latitude": submission.latitude,
            "longitude": submission.longitude,
        }

    # Evaluate missing dimensions deterministically
    required = list(mission.required_evidence or [])
    missing = [dim for dim in required if dim not in collected or collected[dim] is None]

    mission.collected_evidence = collected
    mission.missing_evidence = missing

    # State machine transition
    current_status = MissionStatus(mission.status)
    if not missing:
        target_status = MissionStatus.READY_FOR_SUBMISSION
    else:
        target_status = MissionStatus.NEEDS_CLARIFICATION

    if current_status != target_status:
        enforce_transition(current_status, target_status)
        mission.status = target_status.value

    # Compute next action from model provider
    template = get_template_for_type(MissionType(mission.mission_type))
    context = {
        "title": mission.title,
        "purpose": mission.purpose,
        "required_evidence": required,
        "collected_evidence": collected,
        "micro_learning": template.get("micro_learning"),
    }
    from app.agent.providers import DeterministicRuleProvider
    import asyncio
    action = asyncio.run(DeterministicRuleProvider().generate_action(context))
    mission.next_action = action.model_dump()

    # Record validation audit
    audit = AgentActionAudit(
        mission_id=mission.id,
        actor="AGENT",
        action_type="EVIDENCE_VALIDATED",
        tool_used="validate_evidence",
        input_reference=str(list(collected.keys())),
        output_reference=mission.status,
        reason="Agent validated completeness against mission requirements.",
        result_summary=f"Status: {mission.status}. Missing: {missing}",
    )
    db.add(audit)
    db.commit()
    db.refresh(mission)
    return mission


def tool_submit_mission_evidence(
    db: Session,
    mission_id: UUID,
    contributor_id: UUID,
    submission: Optional[MissionEvidenceSubmission] = None,
) -> Report:
    """
    Submits completed mission evidence into the authoritative Report / SignalCase pipeline.
    Preserves strict separation between machine assistance, citizen facts, and human review.
    """
    assert_tool_allowed("submit_mission_evidence")
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission '{mission_id}' not found.",
        )

    # Authorization check
    if mission.contributor_id and mission.contributor_id != contributor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot submit a mission started by another contributor.",
        )

    # Ingest submission if provided
    if submission is not None:
        tool_validate_evidence(
            db=db,
            mission_id=mission_id,
            submission=submission,
            contributor_id=contributor_id,
        )
        db.refresh(mission)

    # Idempotent return if already finalized into a SignalCase
    if mission.status in [MissionStatus.SUBMITTED.value, MissionStatus.RESEARCH_REVIEW.value] and mission.signal_case_id:
        existing_report = db.query(Report).filter(Report.id == mission.signal_case_id).first()
        if existing_report:
            return existing_report

    # Validate readiness
    if mission.status != MissionStatus.READY_FOR_SUBMISSION.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incomplete evidence: Cannot submit mission in status '{mission.status}'. Missing dimensions: {mission.missing_evidence}",
        )

    enforce_transition(MissionStatus.READY_FOR_SUBMISSION, MissionStatus.SUBMITTED)

    collected = dict(mission.collected_evidence or {})
    loc = collected.get("location", {})
    lat = loc.get("latitude") or mission.target_latitude or 0.0
    lon = loc.get("longitude") or mission.target_longitude or 0.0

    # Create authoritative citizen Report
    report = Report(
        observed_at=datetime.now(timezone.utc),
        latitude=float(lat),
        longitude=float(lon),
        description=collected.get("description") or f"Mission evidence submission: {mission.title}",
        water_appearance=collected.get("water_appearance"),
        odor=collected.get("odor"),
        flow_condition=collected.get("flow_condition"),
        foam_observed=bool(collected.get("foam_observed", False)),
        litter_observed=bool(collected.get("litter_observed", False)),
        dead_wildlife_observed=bool(collected.get("dead_wildlife_observed", False)),
        status="SUBMITTED",
    )
    db.add(report)
    db.flush()

    # Link or create media if attached
    photo_info = collected.get("photo")
    if isinstance(photo_info, dict) and "storage_key" in photo_info:
        media_item = ReportMedia(
            report_id=report.id,
            storage_key=photo_info["storage_key"],
            original_filename=photo_info.get("original_filename", "mission_photo.jpg"),
            content_type=photo_info.get("content_type", "image/jpeg"),
            size_bytes=photo_info.get("size_bytes", 1024),
            sha256=photo_info.get("sha256", "0" * 64),
        )
        db.add(media_item)
    else:
        media_id_str = collected.get("media_id") or (photo_info if isinstance(photo_info, str) else None)
        if media_id_str:
            try:
                m_uuid = UUID(str(media_id_str))
                media_item = db.query(ReportMedia).filter(ReportMedia.id == m_uuid).first()
                if media_item:
                    media_item.report_id = report.id
                else:
                    media_item = ReportMedia(
                        id=m_uuid,
                        report_id=report.id,
                        storage_key=f"reports/{report.id}/media/{m_uuid}.jpg",
                        original_filename="stream_proof.jpg",
                        content_type="image/jpeg",
                        size_bytes=1024,
                        sha256="0" * 64,
                    )
                    db.add(media_item)
            except Exception:
                pass

    # Update Mission to SUBMITTED and link SignalCase
    mission.status = MissionStatus.SUBMITTED.value
    mission.signal_case_id = report.id
    mission.submitted_at = datetime.now(timezone.utc)

    # Record Audit
    audit = AgentActionAudit(
        mission_id=mission.id,
        actor="AGENT",
        action_type="MISSION_SUBMITTED",
        tool_used="submit_mission_evidence",
        input_reference=str(mission.id),
        output_reference=str(report.id),
        reason="All required evidence validated. Submitted into SignalCase pipeline.",
        result_summary=f"Created SignalCase '{report.id}'.",
    )
    db.add(audit)

    # Transition mission status to RESEARCH_REVIEW
    enforce_transition(MissionStatus.SUBMITTED, MissionStatus.RESEARCH_REVIEW)
    mission.status = MissionStatus.RESEARCH_REVIEW.value

    db.commit()
    db.refresh(mission)
    db.refresh(report)

    # Emit real-time notification
    try:
        connection_manager.publish_sync(
            event_type=RealtimeEventType.SIGNAL_CASE_CREATED,
            report_id=report.id,
            data={"case_id": str(report.id), "mission_id": str(mission.id)},
        )
    except Exception:
        pass

    return report
