"""
Tests for Evidence Mission Agent & Execution Firewall
Verifies:
1. Allowlisted templates from registry
2. Bounded state machine and transition firewall
3. Tool execution firewall (AGENT_ACTION_NOT_ALLOWED)
4. Model provider reasoning (Deterministic fallback & schema constraints)
5. Evidence validation preventing premature submission
6. Full end-to-end mission submission into Report, SignalCase, and SignalGuard
7. Agent audit trail persistence
8. Contributor authorization boundaries
"""

import uuid
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.agent.orchestrator import EvidenceMissionAgent
from app.agent.providers import DeterministicRuleProvider
from app.agent.registry import (
    APPROVED_MISSION_TEMPLATES,
    get_template_for_type,
    list_approved_templates,
)
from app.agent.state_machine import can_transition, enforce_transition
from app.agent.tools import (
    ALLOWED_AGENT_TOOLS,
    assert_tool_allowed,
    tool_get_evidence_gap,
    tool_plan_mission,
    tool_start_mission,
    tool_submit_mission_evidence,
    tool_validate_evidence,
)
from app.core.database import SessionLocal
from app.models.contributor import Contributor
from app.models.media import ReportMedia
from app.models.mission import AgentActionAudit, Mission
from app.models.report import Report
from app.schemas.mission import (
    MissionAgentActionType,
    MissionEvidenceSubmission,
    MissionStatus,
    MissionType,
)
from app.services.contributor import get_or_create_contributor


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_approved_mission_templates():
    """All approved templates are well-formed and contain required keys."""
    templates = list_approved_templates()
    assert len(templates) >= 3

    types = {t["mission_type"] for t in templates}
    assert MissionType.AFTER_RAIN_STREAM_CHECK.value in types
    assert MissionType.EVIDENCE_CLARIFICATION.value in types
    assert MissionType.PLACE_EVIDENCE_SNAPSHOT.value in types

    for template in templates:
        assert "title" in template
        assert "purpose" in template
        assert "required_evidence" in template
        assert isinstance(template["required_evidence"], list)
        assert len(template["required_evidence"]) > 0


def test_state_machine_valid_and_invalid_transitions():
    """Finite State Machine correctly permits valid steps and rejects illegal state jumps."""
    # Valid transitions
    assert can_transition(MissionStatus.DISCOVERING, MissionStatus.MISSION_PLANNED) is True
    assert can_transition(MissionStatus.MISSION_PLANNED, MissionStatus.WAITING_FOR_CITIZEN) is True
    assert can_transition(MissionStatus.WAITING_FOR_CITIZEN, MissionStatus.COLLECTING_EVIDENCE) is True
    assert can_transition(MissionStatus.COLLECTING_EVIDENCE, MissionStatus.VALIDATING_EVIDENCE) is True
    assert can_transition(MissionStatus.VALIDATING_EVIDENCE, MissionStatus.READY_FOR_SUBMISSION) is True
    assert can_transition(MissionStatus.READY_FOR_SUBMISSION, MissionStatus.SUBMITTED) is True
    assert can_transition(MissionStatus.SUBMITTED, MissionStatus.RESEARCH_REVIEW) is True

    # Illegal transitions (skipping states or moving backwards from terminal)
    assert can_transition(MissionStatus.WAITING_FOR_CITIZEN, MissionStatus.SUBMITTED) is False
    assert can_transition(MissionStatus.DISCOVERING, MissionStatus.RESEARCH_REVIEW) is False
    assert can_transition(MissionStatus.RESEARCH_REVIEW, MissionStatus.COLLECTING_EVIDENCE) is False

    with pytest.raises(HTTPException) as exc_info:
        enforce_transition(MissionStatus.WAITING_FOR_CITIZEN, MissionStatus.SUBMITTED)
    assert exc_info.value.status_code == 400


def test_tool_execution_firewall():
    """Tool firewall permits allowlisted tools and blocks unauthorized operations."""
    for tool in ALLOWED_AGENT_TOOLS:
        assert_tool_allowed(tool)  # Should not raise

    with pytest.raises(HTTPException) as exc_info:
        assert_tool_allowed("execute_arbitrary_shell_command")
    assert exc_info.value.status_code == 400
    assert "AGENT_ACTION_NOT_ALLOWED" in exc_info.value.detail


@pytest.mark.asyncio
async def test_deterministic_rule_provider():
    """Deterministic reasoning engine correctly identifies missing evidence dimensions."""
    provider = DeterministicRuleProvider()

    # Case 1: Missing all dimensions
    context1 = {
        "title": "Stream Check",
        "required_evidence": ["photo", "flow_condition", "water_appearance"],
        "collected_evidence": {},
        "micro_learning": "Photos provide baseline visual documentation.",
    }
    action1 = await provider.generate_action(context1)
    assert action1.action_type == MissionAgentActionType.REQUEST_PHOTO
    assert "photo" in action1.missing_evidence

    # Case 2: Photo provided, missing flow condition
    context2 = {
        "title": "Stream Check",
        "required_evidence": ["photo", "flow_condition"],
        "collected_evidence": {"photo": "media-uuid-123"},
    }
    action2 = await provider.generate_action(context2)
    assert action2.action_type == MissionAgentActionType.REQUEST_OBSERVATION
    assert action2.observation_type == "flow_condition"

    # Case 3: All provided
    context3 = {
        "title": "Stream Check",
        "required_evidence": ["photo", "flow_condition"],
        "collected_evidence": {"photo": "media-uuid-123", "flow_condition": "moderate"},
    }
    action3 = await provider.generate_action(context3)
    assert action3.action_type == MissionAgentActionType.READY_FOR_SUBMISSION
    assert len(action3.missing_evidence) == 0


def test_mission_validation_rejects_premature_submission(db: Session):
    """Premature submission before satisfying required evidence is strictly blocked."""
    contributor = get_or_create_contributor(db=db, contributor_id_str=None)
    mission = tool_plan_mission(
        db=db,
        mission_type=MissionType.AFTER_RAIN_STREAM_CHECK,
        target_latitude=41.1579,
        target_longitude=-8.6291,
    )

    # Start mission
    tool_start_mission(db=db, mission_id=mission.id, contributor_id=contributor.id)

    # Incomplete evidence submission
    incomplete = MissionEvidenceSubmission(
        flow_condition="slow",
        # photo and water_appearance missing
    )

    with pytest.raises(HTTPException) as exc_info:
        tool_submit_mission_evidence(
            db=db,
            mission_id=mission.id,
            contributor_id=contributor.id,
            submission=incomplete,
        )
    assert exc_info.value.status_code == 400
    assert "Incomplete evidence" in exc_info.value.detail

    # Clean up
    db.query(AgentActionAudit).filter(AgentActionAudit.mission_id == mission.id).delete()
    db.delete(mission)
    db.delete(contributor)
    db.commit()


def test_full_mission_lifecycle_and_pipeline_handoff(db: Session):
    """
    Executes full bounded lifecycle:
    Plan -> Start -> Attach Real Media -> Validate -> Submit -> Report + SignalCase + Audit Trail.
    """
    # 1. Contributor
    contributor = get_or_create_contributor(db=db, contributor_id_str=None)

    # 2. Plan mission
    mission = tool_plan_mission(
        db=db,
        mission_type=MissionType.AFTER_RAIN_STREAM_CHECK,
        target_latitude=41.1579,
        target_longitude=-8.6291,
        title="Post-Rain Urban Brook Inspection",
    )
    assert mission.status == MissionStatus.WAITING_FOR_CITIZEN.value

    # 3. Start mission
    started = tool_start_mission(db=db, mission_id=mission.id, contributor_id=contributor.id)
    assert started.status == MissionStatus.COLLECTING_EVIDENCE.value
    assert started.contributor_id == contributor.id

    # 4. Generate media UUID representing an uploaded photo
    media_id = uuid.uuid4()

    # 5. Complete submission with required dimensions
    submission = MissionEvidenceSubmission(
        media_id=media_id,
        flow_condition="moderate",
        water_appearance="clear with natural leaf debris",
        foam_observed=False,
        additional_notes="Collected at downstream footbridge following morning rain.",
        latitude=41.1579,
        longitude=-8.6291,
    )

    # 6. Validate evidence first
    validation_mission = tool_validate_evidence(
        db=db,
        mission_id=mission.id,
        submission=submission,
        contributor_id=contributor.id,
    )
    assert validation_mission.status == MissionStatus.READY_FOR_SUBMISSION.value

    # 7. Submit evidence
    report = tool_submit_mission_evidence(
        db=db,
        mission_id=mission.id,
        contributor_id=contributor.id,
        submission=submission,
    )
    assert report.id is not None
    assert report.latitude == 41.1579
    assert report.longitude == -8.6291

    # Verify Mission state updated
    db.refresh(mission)
    assert mission.status == MissionStatus.RESEARCH_REVIEW.value
    assert mission.signal_case_id == report.id

    # Verify Media is linked to Report
    media = db.query(ReportMedia).filter(ReportMedia.id == media_id).first()
    assert media is not None
    assert media.report_id == report.id

    # Verify Audit Trail exists in PostgreSQL
    audits = (
        db.query(AgentActionAudit)
        .filter(AgentActionAudit.mission_id == mission.id)
        .order_by(AgentActionAudit.created_at.asc())
        .all()
    )
    assert len(audits) >= 2
    actions_logged = [a.action_type for a in audits]
    assert "MISSION_PLANNED" in actions_logged
    assert "MISSION_SUBMITTED" in actions_logged

    # Teardown
    db.query(AgentActionAudit).filter(AgentActionAudit.mission_id == mission.id).delete()
    db.delete(mission)
    if media:
        db.delete(media)
    db.delete(report)
    db.delete(contributor)
    db.commit()


def test_contributor_authorization_isolation(db: Session):
    """Contributor B cannot start or submit on Contributor A's assigned mission."""
    c1 = get_or_create_contributor(db=db, contributor_id_str=None)
    c2 = get_or_create_contributor(db=db, contributor_id_str=None)

    mission = tool_plan_mission(
        db=db,
        mission_type=MissionType.PLACE_EVIDENCE_SNAPSHOT,
        target_latitude=41.15,
        target_longitude=-8.62,
    )

    # c1 starts it
    tool_start_mission(db=db, mission_id=mission.id, contributor_id=c1.id)

    # c2 tries to validate or submit
    with pytest.raises(HTTPException) as exc_info:
        tool_validate_evidence(
            db=db,
            mission_id=mission.id,
            submission=MissionEvidenceSubmission(),
            contributor_id=c2.id,
        )
    assert exc_info.value.status_code == 403
    assert "You are not authorized" in exc_info.value.detail

    # Clean up
    db.query(AgentActionAudit).filter(AgentActionAudit.mission_id == mission.id).delete()
    db.delete(mission)
    db.delete(c1)
    db.delete(c2)
    db.commit()
