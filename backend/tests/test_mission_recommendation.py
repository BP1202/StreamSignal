"""
StreamSignal — Mission Recommendation & RBAC / IDOR Test Suite

Tests:
1. Recommendation originates strictly from:
   Approved MissionNeed -> Evidence gap -> Relevant area -> Contributor eligibility -> Mission recommendation.
2. Empty database returns 0 recommendations. No fake mission.
3. Why this mission contains the 4 truthful provenance checks:
   - "{DIMENSION} is missing"
   - "This research need is approved"
   - "Your selected area matches"
   - "You have not recently submitted this evidence"
4. Contributor who recently submitted this evidence is ineligible.
5. Top-level researcher routes (/research/evidence-gaps, /research/mission-needs, /research/human-review)
   return 403 Forbidden for Citizen callers.
6. Contributor IDOR access protection returns 403 Forbidden.
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.contributor import Contributor
from app.models.mission import Mission
from app.models.mission_need import MissionNeed
from app.models.report import Report
from app.schemas.mission import MissionStatus, MissionType
from app.schemas.mission_need import MissionNeedStatus


@pytest.fixture
def unauth_client():
    return TestClient(app)


def test_empty_database_no_targeted_missions(sync_test_db: Session, unauth_client: TestClient):
    """Empty database returns 0 recommendations. Never invents fake missions."""
    sync_test_db.query(Mission).delete()
    sync_test_db.query(MissionNeed).delete()
    sync_test_db.commit()

    resp = unauth_client.get("/api/v1/citizen/missions/recommendations")
    assert resp.status_code == 200
    data = resp.json()
    assert data["recommendations"] == []
    assert data["total"] == 0


def test_unapproved_mission_need_does_not_produce_recommendation(
    sync_test_db: Session, unauth_client: TestClient
):
    """Identified or Reviewed needs must never produce citizen recommendations."""
    sync_test_db.query(Mission).delete()
    sync_test_db.query(MissionNeed).delete()
    sync_test_db.commit()

    need = MissionNeed(
        evidence_gap_dimension="flow_condition",
        title="Unapproved Flow Condition Need",
        description="Observed without verification.",
        rationale="Researcher drafting proposal.",
        status=MissionNeedStatus.IDENTIFIED.value,
        created_by_researcher="R-TEST",
        source_case_ids=[],
        target_stream_segments=["segment_1"],
        required_evidence=["flow_condition"],
    )
    sync_test_db.add(need)
    sync_test_db.commit()

    resp = unauth_client.get("/api/v1/citizen/missions/recommendations")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

    # Also test reviewed status
    need.status = MissionNeedStatus.REVIEWED.value
    sync_test_db.commit()

    resp = unauth_client.get("/api/v1/citizen/missions/recommendations")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


def test_approved_mission_need_produces_recommendation_with_provenance_reasons(
    sync_test_db: Session, unauth_client: TestClient
):
    """
    Approved MissionNeed with active gap produces recommendation with the 4 transparent reasons:
    ✓ FLOW_CONDITION is missing
    ✓ This research need is approved
    ✓ Your selected area matches
    ✓ You have not recently submitted this evidence
    """
    sync_test_db.query(Mission).delete()
    sync_test_db.query(MissionNeed).delete()
    sync_test_db.commit()

    need = MissionNeed(
        evidence_gap_dimension="flow_condition",
        title="Targeted Flow Condition Verification",
        description="Flow condition absent in historical reports.",
        rationale="Hydrological baseline requires flow verification.",
        status=MissionNeedStatus.APPROVED.value,
        created_by_researcher="R-TEST",
        source_case_ids=[],
        target_stream_segments=["urban_reach_a"],
        required_evidence=["flow_condition"],
    )
    sync_test_db.add(need)
    sync_test_db.commit()

    resp = unauth_client.get(
        "/api/v1/citizen/missions/recommendations",
        params={"stream_segment": "urban_reach_a"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    rec = data["recommendations"][0]

    assert rec["is_recommended"] is True
    assert rec["why_this_mission"] == [
        "FLOW_CONDITION is missing",
        "This research need is approved",
        "Your selected area matches",
        "You have not recently submitted this evidence",
    ]


def test_ineligible_contributor_not_recommended_recent_evidence(
    sync_test_db: Session, unauth_client: TestClient
):
    """Contributor who recently submitted this evidence is ineligible for the same recommendation."""
    sync_test_db.query(Mission).delete()
    sync_test_db.query(MissionNeed).delete()
    sync_test_db.commit()

    contributor = Contributor(
        contributor_id="SS-C-TEST-ELIG",
        display_name="RiverHeron-Elig",
        account_level="LEVEL_1_CONTRIBUTOR",
    )
    sync_test_db.add(contributor)
    sync_test_db.commit()
    sync_test_db.refresh(contributor)

    need = MissionNeed(
        evidence_gap_dimension="flow_condition",
        title="Flow Condition Need",
        description="Verify flow",
        rationale="Baseline requirement",
        status=MissionNeedStatus.APPROVED.value,
        created_by_researcher="R-TEST",
        source_case_ids=[],
        target_stream_segments=["segment_a"],
        required_evidence=["flow_condition"],
    )
    sync_test_db.add(need)
    sync_test_db.commit()

    # Before submitting: eligible
    resp1 = unauth_client.get(
        "/api/v1/citizen/missions/recommendations",
        headers={"X-Contributor-Id": contributor.contributor_id},
        params={"stream_segment": "segment_a"},
    )
    assert resp1.status_code == 200
    assert resp1.json()["total"] == 1

    # Contributor submits a mission for this dimension
    sub_mission = Mission(
        mission_type=MissionType.EVIDENCE_CLARIFICATION.value,
        status=MissionStatus.SUBMITTED.value,
        title="Submitted Mission",
        purpose="Purpose",
        research_need="Need",
        research_need_source="TEST",
        contributor_id=contributor.id,
        required_evidence=["flow_condition"],
        collected_evidence={"flow_condition": "MODERATE_FLOW"},
        submitted_at=datetime.now(timezone.utc),
    )
    sync_test_db.add(sub_mission)
    sync_test_db.commit()

    # After submitting: ineligible, 0 recommendations
    resp2 = unauth_client.get(
        "/api/v1/citizen/missions/recommendations",
        headers={"X-Contributor-Id": contributor.contributor_id},
        params={"stream_segment": "segment_a"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 0


def test_top_level_research_endpoints_return_403_for_citizen(unauth_client: TestClient):
    """Calling top-level /research/... endpoints without researcher role returns 403 Forbidden."""
    # 1. GET /research/evidence-gaps
    resp = unauth_client.get("/research/evidence-gaps", headers={"X-Role": "CITIZEN"})
    assert resp.status_code == 403

    # 2. POST /research/mission-needs
    resp = unauth_client.post(
        "/research/mission-needs",
        headers={"X-Role": "CITIZEN"},
        json={"title": "Unauthorized"},
    )
    assert resp.status_code == 403

    # 3. POST /research/human-review
    resp = unauth_client.post(
        "/research/human-review",
        headers={"X-Role": "CITIZEN"},
        json={"outcome": "ACCEPTED"},
    )
    assert resp.status_code == 403


def test_contributor_idor_access_protection(sync_test_db: Session, unauth_client: TestClient):
    """Citizen attempting to access another contributor's impact data returns 403 Forbidden."""
    u1_id = f"SS-C-{uuid.uuid4().hex[:8]}"
    u2_id = f"SS-C-{uuid.uuid4().hex[:8]}"
    c1 = Contributor(
        contributor_id=u1_id,
        display_name=f"User-{uuid.uuid4().hex[:6]}",
        account_level="LEVEL_1_CONTRIBUTOR",
    )
    c2 = Contributor(
        contributor_id=u2_id,
        display_name=f"User-{uuid.uuid4().hex[:6]}",
        account_level="LEVEL_1_CONTRIBUTOR",
    )
    sync_test_db.add_all([c1, c2])
    sync_test_db.commit()

    # User 1 attempts to fetch User 2's specific impact profile
    resp = unauth_client.get(
        f"/api/v1/citizen/contributors/{c2.contributor_id}/impact",
        headers={"X-Contributor-Id": c1.contributor_id},
    )
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]
