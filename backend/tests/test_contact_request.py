"""
StreamSignal — Researcher-Contributor Contact Workflow Tests (Issue 36)
Verifies:
1. Researcher can create a contact request for a SignalCase with valid rationale.
2. RBAC protection on researcher endpoints (403 without researcher role).
3. Contributor can fetch pending requests for their reports.
4. Contributor can accept with optional contact details (email, phone, preferred method).
5. Contributor can decline (contact details remain null).
6. IDOR protection prevents unauthorized contributors from responding to others' requests.
7. Strict privacy boundary: contact details NEVER leak into EvidenceCase or FHIR exports.
8. Contributor can initiate contact with the researcher on their case.
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.report import Report
from app.models.contributor import Contributor
from app.models.contact_request import ContactRequest
from app.services.contributor import get_or_create_contributor


@pytest.fixture
def test_setup(sync_test_db: Session):
    """Sets up an authentic contributor and linked citizen observation report."""
    contributor = get_or_create_contributor(sync_test_db, contributor_id_str="SS-C-CONTACT-TEST")
    
    report = Report(
        id=uuid.uuid4(),
        latitude=23.0225,
        longitude=72.5714,
        description="Freshwater pond with unusual surface film near outflow",
        water_appearance="scum_film",
        status="SUBMITTED",
        contributor_id=contributor.id,
        observed_at=datetime.now(timezone.utc),
    )
    sync_test_db.add(report)
    sync_test_db.commit()
    sync_test_db.refresh(report)

    return {"contributor": contributor, "report": report}


def test_researcher_can_create_contact_request(client: TestClient, test_setup: dict):
    report = test_setup["report"]

    resp = client.post(
        f"/api/v1/research/evidence-cases/{report.id}/contact-requests",
        headers={
            "X-Role": "RESEARCHER",
            "X-Reviewer-Id": "Dr-Sarah-Chen-Lead-Limnologist",
        },
        json={
            "reason": "CLARIFICATION",
            "message": "Could you provide additional details on whether water flow was observed near the outflow culvert?",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["signal_case_id"] == str(report.id)
    assert data["status"] == "PENDING"
    assert data["reason"] == "CLARIFICATION"
    assert data["researcher_id"] == "Dr-Sarah-Chen-Lead-Limnologist"
    assert data["shared_email"] is None
    assert data["shared_phone"] is None


def test_unauthorized_user_cannot_create_contact_request(test_setup: dict):
    from app.main import app
    report = test_setup["report"]
    unauth_client = TestClient(app)

    # No role header
    resp = unauth_client.post(
        f"/api/v1/research/evidence-cases/{report.id}/contact-requests",
        json={"reason": "CLARIFICATION", "message": "Unauthorized attempt"},
    )
    assert resp.status_code == 403

    # Citizen role
    resp = unauth_client.post(
        f"/api/v1/research/evidence-cases/{report.id}/contact-requests",
        headers={"X-Role": "CITIZEN", "X-Reviewer-Id": "Citizen1"},
        json={"reason": "CLARIFICATION", "message": "Unauthorized attempt"},
    )
    assert resp.status_code == 403


def test_contributor_can_view_contact_requests(client: TestClient, test_setup: dict):
    report = test_setup["report"]
    contributor = test_setup["contributor"]

    # Researcher creates contact request
    create_resp = client.post(
        f"/api/v1/research/evidence-cases/{report.id}/contact-requests",
        headers={
            "X-Role": "RESEARCHER",
            "X-Reviewer-Id": "Dr-Sarah-Chen-Lead-Limnologist",
        },
        json={
            "reason": "FIELD_VERIFICATION",
            "message": "We would like to coordinate a field grab sample at this location.",
        },
    )
    assert create_resp.status_code == 201

    # Contributor fetches contact requests
    list_resp = client.get(
        "/api/v1/citizen/contact-requests",
        headers={"X-Contributor-Id": contributor.contributor_id},
    )
    assert list_resp.status_code == 200, list_resp.text
    items = list_resp.json()
    assert len(items) >= 1
    match = next((item for item in items if item["signal_case_id"] == str(report.id)), None)
    assert match is not None
    assert match["status"] == "PENDING"
    assert match["reason"] == "FIELD_VERIFICATION"


def test_contributor_can_accept_and_share_contact_details(client: TestClient, test_setup: dict):
    report = test_setup["report"]
    contributor = test_setup["contributor"]

    # 1. Create request
    create_resp = client.post(
        f"/api/v1/research/evidence-cases/{report.id}/contact-requests",
        headers={
            "X-Role": "RESEARCHER",
            "X-Reviewer-Id": "Dr-Sarah-Chen-Lead-Limnologist",
        },
        json={
            "reason": "ADDITIONAL_EVIDENCE",
            "message": "Do you have any photographs from earlier in the day?",
        },
    )
    req_id = create_resp.json()["id"]

    # 2. Contributor accepts and voluntarily shares email & phone
    accept_resp = client.post(
        f"/api/v1/citizen/contact-requests/{req_id}/respond",
        headers={"X-Contributor-Id": contributor.contributor_id},
        json={
            "action": "ACCEPT",
            "shared_email": "citizen.observer@example.com",
            "shared_phone": "+1-555-0199",
            "preferred_method": "EMAIL",
            "contributor_note": "I can share 2 additional high-resolution photos taken around 10am.",
        },
    )
    assert accept_resp.status_code == 200, accept_resp.text
    accept_data = accept_resp.json()
    assert accept_data["status"] == "ACCEPTED"
    assert accept_data["shared_email"] == "citizen.observer@example.com"
    assert accept_data["shared_phone"] == "+1-555-0199"
    assert accept_data["preferred_method"] == "EMAIL"

    # 3. Researcher retrieves contact request list for the case
    get_resp = client.get(
        f"/api/v1/research/evidence-cases/{report.id}/contact-requests",
        headers={"X-Role": "RESEARCHER"},
    )
    assert get_resp.status_code == 200
    res_items = get_resp.json()
    req_match = next(r for r in res_items if r["id"] == req_id)
    assert req_match["status"] == "ACCEPTED"
    assert req_match["shared_email"] == "citizen.observer@example.com"
    assert req_match["shared_phone"] == "+1-555-0199"
    assert req_match["preferred_method"] == "EMAIL"


def test_contributor_can_decline_contact_request(client: TestClient, test_setup: dict):
    report = test_setup["report"]
    contributor = test_setup["contributor"]

    create_resp = client.post(
        f"/api/v1/research/evidence-cases/{report.id}/contact-requests",
        headers={
            "X-Role": "RESEARCHER",
            "X-Reviewer-Id": "Dr-Sarah-Chen-Lead-Limnologist",
        },
        json={
            "reason": "GENERAL_INQUIRY",
            "message": "Could you meet our team near the park entrance?",
        },
    )
    req_id = create_resp.json()["id"]

    # Contributor declines
    decline_resp = client.post(
        f"/api/v1/citizen/contact-requests/{req_id}/respond",
        headers={"X-Contributor-Id": contributor.contributor_id},
        json={
            "action": "DECLINE",
            "contributor_note": "I prefer to keep all participation anonymous through the web platform.",
        },
    )
    assert decline_resp.status_code == 200, decline_resp.text
    decline_data = decline_resp.json()
    assert decline_data["status"] == "DECLINED"
    assert decline_data["shared_email"] is None
    assert decline_data["shared_phone"] is None


def test_idor_contributor_cannot_respond_to_others_request(
    client: TestClient,
    sync_test_db: Session,
    test_setup: dict,
):
    report = test_setup["report"]
    # Create request for contributor 1
    create_resp = client.post(
        f"/api/v1/research/evidence-cases/{report.id}/contact-requests",
        headers={
            "X-Role": "RESEARCHER",
            "X-Reviewer-Id": "Dr-Sarah-Chen-Lead-Limnologist",
        },
        json={
            "reason": "CLARIFICATION",
            "message": "Clarification needed.",
        },
    )
    req_id = create_resp.json()["id"]

    # Contributor 2 attempts to respond
    other_contributor = get_or_create_contributor(sync_test_db, contributor_id_str="SS-C-OTHER-ATTACKER")
    resp = client.post(
        f"/api/v1/citizen/contact-requests/{req_id}/respond",
        headers={"X-Contributor-Id": other_contributor.contributor_id},
        json={"action": "ACCEPT", "shared_email": "attacker@example.com"},
    )
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]


def test_privacy_contact_details_never_leak_into_fhir_or_signal_case(
    client: TestClient,
    test_setup: dict,
):
    report = test_setup["report"]
    contributor = test_setup["contributor"]

    # Create & accept with private email
    create_resp = client.post(
        f"/api/v1/research/evidence-cases/{report.id}/contact-requests",
        headers={
            "X-Role": "RESEARCHER",
            "X-Reviewer-Id": "Dr-Sarah-Chen-Lead-Limnologist",
        },
        json={
            "reason": "CLARIFICATION",
            "message": "Clarification question.",
        },
    )
    req_id = create_resp.json()["id"]
    client.post(
        f"/api/v1/citizen/contact-requests/{req_id}/respond",
        headers={"X-Contributor-Id": contributor.contributor_id},
        json={
            "action": "ACCEPT",
            "shared_email": "strictly.private.citizen@example.com",
            "shared_phone": "+1-800-SECRET",
        },
    )

    # 1. Normal EvidenceCase endpoint
    case_resp = client.get(f"/api/v1/reports/{report.id}/evidence-case")
    assert case_resp.status_code == 200
    case_str = case_resp.text
    assert "strictly.private.citizen@example.com" not in case_str
    assert "+1-800-SECRET" not in case_str

    # 2. FHIR export endpoint
    fhir_resp = client.get(
        f"/api/v1/research/evidence-cases/{report.id}/fhir",
        headers={"X-Role": "RESEARCHER"},
    )
    assert fhir_resp.status_code == 200
    fhir_str = fhir_resp.text
    assert "strictly.private.citizen@example.com" not in fhir_str
    assert "+1-800-SECRET" not in fhir_str


def test_contributor_can_initiate_contact_with_researcher(
    client: TestClient,
    test_setup: dict,
):
    report = test_setup["report"]
    contributor = test_setup["contributor"]

    resp = client.post(
        f"/api/v1/citizen/evidence-cases/{report.id}/contact-researcher",
        headers={"X-Contributor-Id": contributor.contributor_id},
        json={
            "reason": "ADDITIONAL_EVIDENCE",
            "message": "I noticed the water color changed to dark brown this afternoon after heavy rain.",
            "shared_email": "citizen.direct@example.com",
            "preferred_method": "EMAIL",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["initiated_by"] == "CONTRIBUTOR"
    assert data["signal_case_id"] == str(report.id)
    assert data["status"] == "ACCEPTED"  # Since citizen initiated and provided details directly
    assert data["shared_email"] == "citizen.direct@example.com"
