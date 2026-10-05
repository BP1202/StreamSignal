"""
StreamSignal — RBAC Authorization & Reviewer Identity Tests
Verifies that:
1. All researcher endpoints require the researcher role (OIDC in production; test shortcut in development).
2. Citizen and anonymous requests cannot access researcher-only workspace.
3. Human review creation strictly enforces an explicit X-Reviewer-Id header.
4. Agent provider status endpoint correctly reports runtime governance status.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app


def test_research_inbox_requires_researcher_role():
    """Anonymous access to /api/v1/research/evidence-cases must return 403 Forbidden."""
    with TestClient(app) as unauth_client:
        resp = unauth_client.get("/api/v1/research/evidence-cases")
        assert resp.status_code == 403
        assert "requires researcher authorization" in resp.json()["detail"].lower()


def test_research_inbox_rejects_citizen_role():
    """Citizen role access to /api/v1/research/evidence-cases must return 403 Forbidden."""
    with TestClient(app) as unauth_client:
        resp = unauth_client.get("/api/v1/research/evidence-cases", headers={"X-Role": "CITIZEN"})
        assert resp.status_code == 403
        assert "Forbidden" in resp.json()["detail"]


def test_research_inbox_allows_researcher_role(client: TestClient):
    """Valid researcher role access to /api/v1/research/evidence-cases succeeds."""
    resp = client.get("/api/v1/research/evidence-cases", headers={"X-Role": "RESEARCHER"})
    assert resp.status_code == 200
    assert "items" in resp.json()


def test_mission_needs_requires_researcher_role():
    """Access to /api/v1/research/mission-needs without role header returns 403."""
    with TestClient(app) as unauth_client:
        resp = unauth_client.get("/api/v1/research/mission-needs")
        assert resp.status_code == 403


def test_evidence_gaps_requires_researcher_role():
    """Access to /api/v1/research/evidence-gaps without role header returns 403."""
    with TestClient(app) as unauth_client:
        resp = unauth_client.get("/api/v1/research/evidence-gaps")
        assert resp.status_code == 403


def test_human_review_requires_explicit_reviewer_id(sync_test_db, test_report_factory):
    """
    Submitting a human review without X-Reviewer-Id must return 422 Unprocessable Entity.
    No default reviewer identity (such as R-042) is permitted.
    """
    report = test_report_factory(description="RBAC Review Test")
    sync_test_db.add(report)
    sync_test_db.commit()
    sync_test_db.refresh(report)

    try:
        payload = {
            "outcome": "SUPPORTS_REPORTED_OBSERVATION",
            "rationale": "Sufficient observational rationale for testing.",
            "linked_case_id": None,
        }
        with TestClient(app) as unauth_client:
            # Call with X-Role: RESEARCHER but omitting X-Reviewer-Id
            resp = unauth_client.post(
                f"/api/v1/research/evidence-cases/{report.id}/reviews",
                json=payload,
                headers={"X-Role": "RESEARCHER"},
            )
            assert resp.status_code == 422
            assert "X-Reviewer-Id header is required" in resp.json()["detail"]

            # Now supply valid X-Reviewer-Id
            valid_resp = unauth_client.post(
                f"/api/v1/research/evidence-cases/{report.id}/reviews",
                json=payload,
                headers={
                    "X-Role": "RESEARCHER",
                    "X-Reviewer-Id": "REV-AUDIT-999",
                },
            )
            assert valid_resp.status_code == 201
            assert valid_resp.json()["reviewer_id"] == "REV-AUDIT-999"
    finally:
        sync_test_db.delete(report)
        sync_test_db.commit()


def test_agent_status_endpoint(client: TestClient):
    """GET /api/v1/agent/status returns real runtime configuration and safety invariants."""
    resp = client.get("/api/v1/agent/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "configured_provider" in data
    assert "active_provider_class" in data
    assert data["bounded_fsm_enforced"] is True
    assert data["zero_cost_local"] is True
    assert data["human_in_the_loop_required"] is True
