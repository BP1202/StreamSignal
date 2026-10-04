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
    assert data["total_coverage_delta_contributed"] == 0.0
    assert data["potential_coverage_delta_submitted"] > 0
    assert data["accepted_coverage_delta"] == 0.0
    assert "First Signal" in data["stewardship_milestones"]
    assert "Flow Observer" in data["stewardship_milestones"]
    assert "Rainwatch Contributor" in data["stewardship_milestones"]

    recent = data["recent_contributions"]
    assert len(recent) == 1
    assert recent[0]["review_status"] == "AWAITING_REVIEW"
    assert recent[0]["signal_case_id"] == str(r.id)
    assert recent[0]["impact_statement"] == "Your evidence was submitted for FLOW_CONDITION, PHOTO."


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
    assert data["accepted_coverage_delta"] > 0
    assert data["total_coverage_delta_contributed"] > 0
    recent = data["recent_contributions"]
    assert len(recent) == 1
    assert recent[0]["review_status"] == "ACCEPTED_FOR_RESEARCH"
    assert recent[0]["impact_statement"] == "Your accepted evidence closed the FLOW_CONDITION gap."


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


def test_lifecycle_flow_condition_submission_review_acceptance(client: TestClient, sync_test_db: Session):
    """
    Explicit test matching acceptance criteria:
    1. Citizen submits FLOW_CONDITION -> Submitted
       Statement: "Your evidence was submitted for FLOW_CONDITION."
       Accepted coverage delta = 0.0 (cannot claim coverage improved)
    2. Researcher reviews -> Accepted for research
       Statement: "Your accepted evidence closed the FLOW_CONDITION gap."
       Accepted coverage changes (> 0.0)
    """
    db = sync_test_db
    c = Contributor(
        contributor_id="SS-C-FLOW-01",
        display_name="FlowWatcher-42",
        account_level="LEVEL_1_CONTRIBUTOR",
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    r = Report(
        latitude=42.3601,
        longitude=-71.0589,
        description="Stream flow report",
        status="SUBMITTED",
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    # 1. Citizen submits FLOW_CONDITION
    m = Mission(
        mission_type=MissionType.EVIDENCE_CLARIFICATION.value,
        status=MissionStatus.SUBMITTED.value,
        title="Stream Flow Check",
        purpose="Clarify stream flow rate",
        research_need="Flow rate verification",
        research_need_source="RESEARCHER_APPROVED",
        signal_case_id=r.id,
        contributor_id=c.id,
        required_evidence=["flow_condition"],
        collected_evidence={"flow_condition": "fast"},
        missing_evidence=[],
    )
    db.add(m)
    db.commit()

    # Step 1 Check: Raw submission
    resp1 = client.get("/api/v1/citizen/impact", headers={"X-Contributor-Id": "SS-C-FLOW-01"})
    assert resp1.status_code == 200
    data1 = resp1.json()

    assert data1["accepted_coverage_delta"] == 0.0
    assert data1["total_coverage_delta_contributed"] == 0.0
    assert data1["potential_coverage_delta_submitted"] > 0.0
    assert len(data1["recent_contributions"]) == 1
    assert data1["recent_contributions"][0]["review_status"] == "AWAITING_REVIEW"
    assert data1["recent_contributions"][0]["impact_statement"] == "Your evidence was submitted for FLOW_CONDITION."

    # 2. Researcher reviews & accepts
    hr = HumanReview(
        report_id=r.id,
        signal_case_id=r.id,
        reviewer_id="R-EVALUATOR",
        outcome="VERIFIED",
        rationale="Flow condition corroborated by field observer.",
        evidence_state_before="E2_REGISTERED",
        evidence_state_after="E5_VERIFIED",
    )
    db.add(hr)
    db.commit()

    # Step 2 Check: Accepted for research
    resp2 = client.get("/api/v1/citizen/impact", headers={"X-Contributor-Id": "SS-C-FLOW-01"})
    assert resp2.status_code == 200
    data2 = resp2.json()

    # Only now does accepted coverage change
    assert data2["accepted_coverage_delta"] > 0.0
    assert data2["total_coverage_delta_contributed"] == data2["accepted_coverage_delta"]
    assert len(data2["recent_contributions"]) == 1
    assert data2["recent_contributions"][0]["review_status"] == "ACCEPTED_FOR_RESEARCH"
    assert data2["recent_contributions"][0]["impact_statement"] == "Your accepted evidence closed the FLOW_CONDITION gap."

