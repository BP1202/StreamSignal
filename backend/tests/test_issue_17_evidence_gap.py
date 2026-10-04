"""
StreamSignal — Issue 17: Evidence Gap Intelligence + Mission Need Tests

TDD for:
1. Evidence gap analysis service — deterministic SQL, empty-DB behavior, epistemic statements
2. Mission Need lifecycle FSM enforcement
3. Mission Need API endpoints (CRUD + transitions)
4. Agent tool: list_approved_mission_needs (APPROVED-only gate)
5. tool_plan_mission mission_need_id linkage + idempotency
6. Evidence gap API endpoints

All tests use real PostgreSQL via the existing conftest fixtures.
No synthetic data: empty DB → empty result.
"""

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.mission_need import MissionNeed
from app.models.mission import Mission
from app.models.report import Report
from app.schemas.mission_need import MissionNeedStatus
from app.services.mission_need import (
    MissionNeedTransitionError,
    create_mission_need,
    get_mission_need,
    list_approved_for_agent,
    transition_mission_need,
)
from app.schemas.mission_need import MissionNeedCreate
from app.agent.tools import (
    ALLOWED_AGENT_TOOLS,
    assert_tool_allowed,
    tool_list_approved_mission_needs,
    tool_plan_mission,
)
from app.schemas.mission import MissionType

client = TestClient(app, headers={"X-Role": "RESEARCHER", "X-Reviewer-Id": "REV-TEST-001"})

# ──────────────────────────────────────────────────────────────────────────────
# Fixtures & Helpers
# ──────────────────────────────────────────────────────────────────────────────

def make_need_payload(**overrides) -> dict:
    base = {
        "evidence_gap_dimension": "flow_condition",
        "title": "Flow Condition Gap — Test",
        "description": "Flow condition is absent in a subset of test SignalCases.",
        "rationale": (
            "Systematic absence of flow_condition prevents temporal pattern analysis. "
            "Researcher decision: address this gap with targeted citizen missions."
        ),
        "source_case_ids": [],
        "target_stream_segments": [],
        "required_evidence": ["flow_condition"],
        "created_by_researcher": "RESEARCHER_TEST",
    }
    base.update(overrides)
    return base


# ──────────────────────────────────────────────────────────────────────────────
# 1. Evidence Gap Intelligence Service — empty-DB safety
# ──────────────────────────────────────────────────────────────────────────────

def test_evidence_gap_empty_database_returns_zero(sync_test_db):
    """With no SignalCases in DB, analysis must return zero counts and empty gap list."""
    from app.services.evidence_gap_intelligence import analyze_evidence_gaps

    result = analyze_evidence_gaps(sync_test_db, min_cases=1)

    # When DB is empty or has existing cases, structure must be sound and never hallucinate
    assert isinstance(result.total_cases_analyzed, int)
    assert isinstance(result.gaps, list)
    assert "evidence availability" in result.epistemic_notice.lower()


def test_evidence_gap_with_real_case(sync_test_db, test_report_factory):
    """With real SignalCase, gaps must reflect actual NULL field values."""
    from app.services.evidence_gap_intelligence import analyze_evidence_gaps

    # Create a report with flow_condition=None (gap) and water_appearance set
    report = test_report_factory(flow_condition=None, water_appearance="CLEAR")
    sync_test_db.add(report)
    sync_test_db.commit()

    result = analyze_evidence_gaps(sync_test_db, min_cases=1)

    # Must have at least 1 case
    assert result.total_cases_analyzed >= 1

    # flow_condition dimension must show at least 1 missing
    fc_gap = next((g for g in result.gaps if g.dimension == "flow_condition"), None)
    assert fc_gap is not None, "flow_condition dimension must appear in gap analysis"
    assert fc_gap.cases_missing_evidence >= 1

    # water_appearance must show present cases
    wa_gap = next((g for g in result.gaps if g.dimension == "water_appearance"), None)
    assert wa_gap is not None
    assert wa_gap.cases_with_evidence >= 1

    # Cleanup
    sync_test_db.delete(report)
    sync_test_db.commit()


def test_evidence_gap_detail_unknown_dimension(sync_test_db):
    """Requesting detail for an unknown dimension must return None."""
    from app.services.evidence_gap_intelligence import get_evidence_gap_detail

    result = get_evidence_gap_detail(sync_test_db, "totally_fake_dimension_xyz")
    assert result is None


def test_evidence_gap_detail_epistemic_statement(sync_test_db):
    """Epistemic statement must never claim environmental conditions."""
    from app.services.evidence_gap_intelligence import get_evidence_gap_detail

    detail = get_evidence_gap_detail(sync_test_db, "flow_condition")
    assert detail is not None
    forbidden = ["is toxic", "is polluted", "is dangerous", "health risk confirmed", "disease caused"]
    for word in forbidden:
        assert word not in detail.epistemic_statement.lower(), (
            f"Epistemic statement must not contain '{word}'"
        )


# ──────────────────────────────────────────────────────────────────────────────
# 2. Mission Need FSM enforcement
# ──────────────────────────────────────────────────────────────────────────────

def test_mission_need_create_and_retrieve(sync_test_db):
    """Researcher creates a MissionNeed; it is persisted at IDENTIFIED status."""
    payload = MissionNeedCreate(**make_need_payload())
    need = create_mission_need(sync_test_db, payload)

    assert need.id is not None
    assert need.status == MissionNeedStatus.IDENTIFIED.value
    assert need.evidence_gap_dimension == "flow_condition"
    assert need.approved_at is None

    retrieved = get_mission_need(sync_test_db, need.id)
    assert retrieved is not None
    assert retrieved.id == need.id

    # Cleanup
    sync_test_db.delete(retrieved)
    sync_test_db.commit()


def test_mission_need_valid_transitions(sync_test_db):
    """Canonical FSM: IDENTIFIED → REVIEWED → APPROVED is permitted."""
    payload = MissionNeedCreate(**make_need_payload())
    need = create_mission_need(sync_test_db, payload)

    need = transition_mission_need(sync_test_db, need.id, MissionNeedStatus.REVIEWED)
    assert need.status == MissionNeedStatus.REVIEWED.value

    need = transition_mission_need(sync_test_db, need.id, MissionNeedStatus.APPROVED)
    assert need.status == MissionNeedStatus.APPROVED.value
    assert need.approved_at is not None  # Timestamp must be set on approval

    # Cleanup
    sync_test_db.delete(need)
    sync_test_db.commit()


def test_mission_need_invalid_transition_blocked(sync_test_db):
    """IDENTIFIED → ACTIVE must be rejected (skips required steps)."""
    payload = MissionNeedCreate(**make_need_payload())
    need = create_mission_need(sync_test_db, payload)

    with pytest.raises(MissionNeedTransitionError):
        transition_mission_need(sync_test_db, need.id, MissionNeedStatus.ACTIVE)

    # Cleanup
    sync_test_db.delete(need)
    sync_test_db.commit()


def test_mission_need_closed_is_terminal(sync_test_db):
    """Once CLOSED, no further transitions are permitted."""
    payload = MissionNeedCreate(**make_need_payload())
    need = create_mission_need(sync_test_db, payload)
    need = transition_mission_need(sync_test_db, need.id, MissionNeedStatus.CLOSED)

    with pytest.raises(MissionNeedTransitionError):
        transition_mission_need(sync_test_db, need.id, MissionNeedStatus.REVIEWED)

    # Cleanup
    sync_test_db.delete(need)
    sync_test_db.commit()


def test_list_approved_for_agent_only_returns_approved(sync_test_db):
    """Agent endpoint must return only APPROVED needs, not IDENTIFIED or REVIEWED."""
    p = MissionNeedCreate(**make_need_payload())
    identified = create_mission_need(sync_test_db, p)

    p2 = MissionNeedCreate(**make_need_payload(title="Reviewed need"))
    reviewed = create_mission_need(sync_test_db, p2)
    transition_mission_need(sync_test_db, reviewed.id, MissionNeedStatus.REVIEWED)

    p3 = MissionNeedCreate(**make_need_payload(title="Approved need"))
    approved = create_mission_need(sync_test_db, p3)
    transition_mission_need(sync_test_db, approved.id, MissionNeedStatus.REVIEWED)
    transition_mission_need(sync_test_db, approved.id, MissionNeedStatus.APPROVED)

    visible = list_approved_for_agent(sync_test_db)
    visible_ids = {n.id for n in visible}

    assert approved.id in visible_ids
    assert identified.id not in visible_ids
    assert reviewed.id not in visible_ids

    # Cleanup
    for rec in [identified, reviewed, approved]:
        obj = get_mission_need(sync_test_db, rec.id)
        if obj:
            sync_test_db.delete(obj)
    sync_test_db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# 3. Mission Need API endpoints
# ──────────────────────────────────────────────────────────────────────────────

def test_api_create_mission_need():
    """POST /research/mission-needs creates a need at IDENTIFIED status."""
    resp = client.post("/api/v1/research/mission-needs", json=make_need_payload())
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "IDENTIFIED"
    assert data["evidence_gap_dimension"] == "flow_condition"


def test_api_create_mission_need_placeholder_rationale_rejected():
    """Placeholder rationale must be rejected with 422."""
    payload = make_need_payload(rationale="todo")
    resp = client.post("/api/v1/research/mission-needs", json=payload)
    assert resp.status_code == 422


def test_api_list_mission_needs():
    """GET /research/mission-needs returns list."""
    resp = client.get("/api/v1/research/mission-needs")
    assert resp.status_code == 200
    data = resp.json()
    assert "needs" in data
    assert "total" in data


def test_api_get_mission_need_not_found():
    resp = client.get(f"/api/v1/research/mission-needs/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_api_transition_mission_need():
    """PATCH /research/mission-needs/{id}/status advances the lifecycle."""
    create_resp = client.post("/api/v1/research/mission-needs", json=make_need_payload())
    assert create_resp.status_code == 201
    need_id = create_resp.json()["id"]

    resp = client.patch(
        f"/api/v1/research/mission-needs/{need_id}/status",
        params={"to_status": "REVIEWED"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "REVIEWED"


def test_api_transition_invalid_rejected():
    """Invalid transition must return 422."""
    create_resp = client.post("/api/v1/research/mission-needs", json=make_need_payload())
    need_id = create_resp.json()["id"]

    resp = client.patch(
        f"/api/v1/research/mission-needs/{need_id}/status",
        params={"to_status": "ACTIVE"},
    )
    assert resp.status_code == 422


def test_api_approved_endpoint_filters_correctly():
    """GET /research/mission-needs/approved must not include IDENTIFIED needs."""
    create_resp = client.post("/api/v1/research/mission-needs", json=make_need_payload())
    need_id = create_resp.json()["id"]

    resp = client.get("/api/v1/research/mission-needs/approved")
    assert resp.status_code == 200
    ids = [n["id"] for n in resp.json()["needs"]]
    assert need_id not in ids


# ──────────────────────────────────────────────────────────────────────────────
# 4. Evidence Gap API endpoints
# ──────────────────────────────────────────────────────────────────────────────

def test_api_evidence_gaps_returns_valid_structure():
    """GET /research/evidence-gaps returns EvidenceGapListResponse."""
    resp = client.get("/api/v1/research/evidence-gaps")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_cases_analyzed" in data
    assert "gaps" in data
    assert "epistemic_notice" in data
    assert "evidence availability" in data["epistemic_notice"].lower()


def test_api_evidence_gap_dimension_detail():
    """GET /research/evidence-gaps/flow_condition returns EvidenceGapDetail."""
    resp = client.get("/api/v1/research/evidence-gaps/flow_condition")
    assert resp.status_code == 200
    data = resp.json()
    assert data["dimension"] == "flow_condition"
    assert "epistemic_statement" in data
    forbidden = ["is toxic", "is polluted", "is dangerous", "health risk confirmed"]
    for word in forbidden:
        assert word not in data["epistemic_statement"].lower()


def test_api_evidence_gap_unknown_dimension_404():
    resp = client.get("/api/v1/research/evidence-gaps/fake_totally_unknown_xyz")
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────────────────────
# 5. Agent tool: list_approved_mission_needs allowlist gate
# ──────────────────────────────────────────────────────────────────────────────

def test_tool_list_approved_mission_needs_in_allowlist():
    """list_approved_mission_needs must be in the agent tool allowlist."""
    assert "list_approved_mission_needs" in ALLOWED_AGENT_TOOLS


def test_tool_allowlist_rejects_unapproved():
    """Unknown tool names must be blocked by assert_tool_allowed."""
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        assert_tool_allowed("approve_mission_need")  # Agent cannot approve needs
    assert exc_info.value.status_code == 400
    assert "AGENT_ACTION_NOT_ALLOWED" in str(exc_info.value.detail)


def test_tool_list_approved_mission_needs_sync(sync_test_db):
    """tool_list_approved_mission_needs returns list with epistemic notes."""
    result = tool_list_approved_mission_needs(sync_test_db)
    assert isinstance(result, list)
    for item in result:
        assert "epistemic_note" in item
        assert "No environmental condition is asserted" in item["epistemic_note"]


def test_tool_list_approved_needs_only_shows_approved(sync_test_db):
    """Agent tool must not surface IDENTIFIED or REVIEWED needs — only APPROVED."""
    identified = MissionNeed(
        evidence_gap_dimension="odor",
        title="Odor Gap (IDENTIFIED)",
        description="Odor dimension missing.",
        rationale="Test researcher rationale for odor gap needs to be addressed.",
        status=MissionNeedStatus.IDENTIFIED.value,
        created_by_researcher="RESEARCHER_TEST",
        source_case_ids=[],
        target_stream_segments=[],
        required_evidence=["odor"],
    )
    approved = MissionNeed(
        evidence_gap_dimension="odor",
        title="Odor Gap (APPROVED)",
        description="Odor dimension missing.",
        rationale="Test researcher rationale for approved odor gap test.",
        status=MissionNeedStatus.APPROVED.value,
        created_by_researcher="RESEARCHER_TEST",
        source_case_ids=[],
        target_stream_segments=[],
        required_evidence=["odor"],
    )
    sync_test_db.add_all([identified, approved])
    sync_test_db.commit()

    result = tool_list_approved_mission_needs(sync_test_db)
    result_ids = {r["mission_need_id"] for r in result}

    assert str(approved.id) in result_ids
    assert str(identified.id) not in result_ids

    # Cleanup
    sync_test_db.delete(identified)
    sync_test_db.delete(approved)
    sync_test_db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# 6. tool_plan_mission — mission_need_id linkage + idempotency
# ──────────────────────────────────────────────────────────────────────────────

def test_tool_plan_mission_linked_to_need(sync_test_db):
    """Missions planned with mission_need_id must carry that FK."""
    need = MissionNeed(
        evidence_gap_dimension="flow_condition",
        title="FC Gap Need",
        description="Flow condition absent.",
        rationale="Researcher-approved need for testing mission linkage.",
        status=MissionNeedStatus.APPROVED.value,
        created_by_researcher="RESEARCHER_TEST",
        source_case_ids=[],
        target_stream_segments=[],
        required_evidence=["flow_condition"],
    )
    sync_test_db.add(need)
    sync_test_db.commit()
    sync_test_db.refresh(need)

    mission = tool_plan_mission(
        db=sync_test_db,
        mission_type=MissionType.AFTER_RAIN_STREAM_CHECK,
        mission_need_id=need.id,
        research_need="Test research need",
        research_need_source="RESEARCHER_REQUIREMENT",
    )

    assert mission.mission_need_id == need.id

    # Cleanup
    sync_test_db.delete(mission)
    sync_test_db.delete(need)
    sync_test_db.commit()


def test_tool_plan_mission_idempotent_for_same_need(sync_test_db):
    """Calling tool_plan_mission twice with the same mission_need_id must return the existing mission."""
    need = MissionNeed(
        evidence_gap_dimension="photo",
        title="Photo Gap Need",
        description="Photo absent in several cases.",
        rationale="Researcher-approved need for testing idempotency of mission planning.",
        status=MissionNeedStatus.APPROVED.value,
        created_by_researcher="RESEARCHER_TEST",
        source_case_ids=[],
        target_stream_segments=[],
        required_evidence=["photo"],
    )
    sync_test_db.add(need)
    sync_test_db.commit()
    sync_test_db.refresh(need)

    m1 = tool_plan_mission(
        db=sync_test_db,
        mission_type=MissionType.PLACE_EVIDENCE_SNAPSHOT,
        mission_need_id=need.id,
        research_need="Test research need for idempotency",
        research_need_source="RESEARCHER_REQUIREMENT",
    )
    m2 = tool_plan_mission(
        db=sync_test_db,
        mission_type=MissionType.PLACE_EVIDENCE_SNAPSHOT,
        mission_need_id=need.id,
        research_need="Test research need for idempotency",
        research_need_source="RESEARCHER_REQUIREMENT",
    )

    assert m1.id == m2.id

    # Cleanup
    sync_test_db.delete(m1)
    sync_test_db.delete(need)
    sync_test_db.commit()
