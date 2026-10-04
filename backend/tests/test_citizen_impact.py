"""
StreamSignal — Citizen Impact & Evidence Coverage Integration Tests
Verifies:
1. GET /api/v1/citizen/impact returns deterministic coverage calculations
2. Zero fake/mock fallback on empty database
3. Proper review_status updates (AWAITING_REVIEW -> ACCEPTED_FOR_RESEARCH)
4. Contributor isolation across personas
5. Epistemic notice presence
"""

import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.contributor import Contributor
from app.models.mission import Mission
from app.models.report import Report
from app.models.human_review import HumanReview
from app.schemas.mission import MissionStatus, MissionType


def test_citizen_impact_empty_database(client: TestClient, sync_test_db: Session):
    """Empty database returns 0 contributions, 0.0% coverage, and epistemic disclaimer."""
    sync_test_db.query(Report).delete()
    sync_test_db.query(Mission).delete()
    sync_test_db.commit()

    resp = client.get("/api/v1/citizen/impact")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_contributions"] == 0
    assert data["verified_contributions"] == 0
    assert data["overall_evidence_coverage"] == 0.0
    assert data["total_coverage_delta_contributed"] == 0.0
    assert data["recent_contributions"] == []
    assert data["stewardship_milestones"] == []
    assert "not a measure of drinking-water safety" in data["epistemic_notice"]


def test_citizen_impact_with_submitted_mission(client: TestClient, sync_test_db: Session):
    """Contributor with completed mission sees coverage delta and First Signal milestone."""
    db = sync_test_db

    # Create contributor
    c = Contributor(
        contributor_id="SS-C-TEST-01",
        display_name="BrookDragonfly-9999",
        account_level="LEVEL_1_CONTRIBUTOR",
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    # Create Report (SignalCase)
    r = Report(
        latitude=40.7128,
        longitude=-74.006,
        description="Turbid stream observation",
        flow_condition="moderate",
        water_appearance="cloudy",
        status="SUBMITTED",
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    # Create submitted mission
    m = Mission(
        mission_type=MissionType.AFTER_RAIN_STREAM_CHECK.value,
        status=MissionStatus.SUBMITTED.value,
        title="After-Rain Stream Flow Check",
        purpose="Verify stream flow after rainfall",
        research_need="Flow verification",
        research_need_source="RESEARCHER_APPROVED",
        signal_case_id=r.id,
        contributor_id=c.id,
        required_evidence=["flow_condition", "photo"],
        collected_evidence={"flow_condition": "moderate", "photo": "media-123"},
        missing_evidence=[],
    )
    db.add(m)
    db.commit()

    resp = client.get(
        "/api/v1/citizen/impact",
        headers={"X-Contributor-Id": "SS-C-TEST-01"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["contributor_id"] == "SS-C-TEST-01"
    assert data["display_name"] == "BrookDragonfly-9999"
    assert data["total_contributions"] == 1
    assert data["verified_contributions"] == 0
    assert data["total_coverage_delta_contributed"] > 0
    assert "First Signal" in data["stewardship_milestones"]
    assert "Flow Observer" in data["stewardship_milestones"]
    assert "Rainwatch Contributor" in data["stewardship_milestones"]

    recent = data["recent_contributions"]
    assert len(recent) == 1
    assert recent[0]["review_status"] == "AWAITING_REVIEW"
    assert recent[0]["signal_case_id"] == str(r.id)


def test_citizen_impact_with_verified_human_review(client: TestClient, sync_test_db: Session):
    """When a researcher accepts the evidence, status updates to ACCEPTED_FOR_RESEARCH."""
    db = sync_test_db
    c = Contributor(
        contributor_id="SS-C-TEST-02",
        display_name="RiverHeron-7777",
        account_level="LEVEL_2_REGISTERED",
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    r = Report(
        latitude=41.0,
        longitude=-73.5,
        description="Stream clear",
        status="SUBMITTED",
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    m = Mission(
        mission_type=MissionType.EVIDENCE_CLARIFICATION.value,
        status=MissionStatus.SUBMITTED.value,
        title="Flow Check",
        purpose="Follow up",
        research_need="Flow",
        research_need_source="RESEARCHER_APPROVED",
        signal_case_id=r.id,
        contributor_id=c.id,
        required_evidence=["flow_condition"],
        collected_evidence={"flow_condition": "fast"},
        missing_evidence=[],
    )
    db.add(m)
    db.commit()

    # Add HumanReview with outcome VERIFIED
    hr = HumanReview(
        report_id=r.id,
        signal_case_id=r.id,
        reviewer_id="R-042",
        outcome="VERIFIED",
        rationale="Clear photographic and field flow observation corroborated.",
        evidence_state_before="E4_CORROBORATED",
        evidence_state_after="E5_VERIFIED",
    )
    db.add(hr)
    db.commit()

    resp = client.get(
        "/api/v1/citizen/impact",
        headers={"X-Contributor-Id": "SS-C-TEST-02"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["verified_contributions"] == 1
    recent = data["recent_contributions"]
    assert len(recent) == 1
    assert recent[0]["review_status"] == "ACCEPTED_FOR_RESEARCH"


def test_citizen_impact_contributor_isolation(client: TestClient, sync_test_db: Session):
    """Contributor A cannot see contributor B's submissions."""
    db = sync_test_db
    cA = Contributor(contributor_id="SS-C-USER-A", display_name="UserA", account_level="LEVEL_1_CONTRIBUTOR")
    cB = Contributor(contributor_id="SS-C-USER-B", display_name="UserB", account_level="LEVEL_1_CONTRIBUTOR")

    db.add_all([cA, cB])
    db.commit()

    mA = Mission(
        mission_type=MissionType.EVIDENCE_CLARIFICATION.value,
        status=MissionStatus.SUBMITTED.value,
        title="User A Mission",
        purpose="Testing isolation",
        research_need="Check",
        research_need_source="RESEARCHER_APPROVED",
        contributor_id=cA.id,
        required_evidence=["flow_condition"],
        collected_evidence={"flow_condition": "slow"},
        missing_evidence=[],
    )
    db.add(mA)
    db.commit()

    # Query for B
    respB = client.get("/api/v1/citizen/impact", headers={"X-Contributor-Id": "SS-C-USER-B"})
    assert respB.status_code == 200
    dataB = respB.json()
    assert dataB["total_contributions"] == 0
    assert dataB["recent_contributions"] == []
