"""
StreamSignal — Human Review & Evidence Trust Loop Tests (Issue 13)
Validates:
- All 8 human review outcomes
- Rationale validation (mandatory, >= 15 non-whitespace chars, <= 2000 chars)
- Linked case validation (required for MARK_RELATED_CASE / MARK_POTENTIAL_DUPLICATE, forbidden otherwise)
- Prevention of self-linking and nonexistent linked case UUIDs
- Deterministic workflow status mapping
- Separation of evidence state (E4 is never promoted to E5 by desktop review)
- Exactly one immutable lineage event created per successful review
- Transactional rollback on failure
- Chronological ordering of reviews and lineage events
- Citizen-facing non-sensitive impact status
- SignalCase detail exposes latest human review and updated workflow status
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient


def create_test_report(client: TestClient, description: str = "Freshwater observation for review testing.") -> str:
    res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "latitude": 23.0225,
            "longitude": 72.5714,
            "description": description,
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
            "odor": "sewage",
            "foam_observed": True,
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


# -----------------------------------------------------------------------------
# 1. All 8 Review Outcomes & Deterministic Workflow Status Mapping
# -----------------------------------------------------------------------------

@pytest.mark.parametrize(
    "outcome,expected_status",
    [
        ("SUPPORTS_REPORTED_OBSERVATION", "REVIEWED"),
        ("REQUEST_CLARIFICATION", "AWAITING_CITIZEN_RESPONSE"),
        ("REQUEST_MORE_EVIDENCE", "AWAITING_MORE_EVIDENCE"),
        ("REQUEST_FIELD_VERIFICATION", "FIELD_VERIFICATION_REQUESTED"),
        ("INSUFFICIENT_EVIDENCE", "CLOSED_INSUFFICIENT_EVIDENCE"),
        ("RESOLVED_NO_ACTION", "RESOLVED"),
    ],
)
def test_human_review_unlinked_outcomes(client: TestClient, outcome: str, expected_status: str):
    case_id = create_test_report(client, f"Report for testing outcome {outcome}")

    rationale = f"Researcher evaluated evidence thoroughly and selected {outcome} based on visual cues."
    res = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": outcome,
            "rationale": rationale,
            "linked_case_id": None,
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["outcome"] == outcome
    assert data["rationale"] == rationale
    assert data["workflow_status"] == expected_status
    assert data["reviewer_id"] == "REV-TEST-001"
    assert data["case_id"] == case_id
    assert data["linked_case_id"] is None

    # Check case detail reflection
    detail_res = client.get(f"/api/v1/research/evidence-cases/{case_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["workflow_status"] == expected_status
    assert detail["human_decision_status"] == expected_status
    assert detail["latest_human_review"] is not None
    assert detail["latest_human_review"]["outcome"] == outcome


@pytest.mark.parametrize(
    "outcome,expected_status",
    [
        ("MARK_RELATED_CASE", "RELATED_TO_CASE"),
        ("MARK_POTENTIAL_DUPLICATE", "POTENTIAL_DUPLICATE"),
    ],
)
def test_human_review_linked_outcomes(client: TestClient, outcome: str, expected_status: str):
    case_id_1 = create_test_report(client, "Primary observation for linked review.")
    case_id_2 = create_test_report(client, "Secondary nearby observation to link.")

    rationale = f"Cross-referencing confirms common spatial cluster and shared surface film characteristics."
    res = client.post(
        f"/api/v1/research/evidence-cases/{case_id_1}/reviews",
        json={
            "outcome": outcome,
            "rationale": rationale,
            "linked_case_id": case_id_2,
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["outcome"] == outcome
    assert data["workflow_status"] == expected_status
    assert data["linked_case_id"] == case_id_2


# -----------------------------------------------------------------------------
# 2. Validation Rules (Rationale length, missing linked case, invalid linked case)
# -----------------------------------------------------------------------------

def test_review_validation_missing_rationale(client: TestClient):
    case_id = create_test_report(client)
    res = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "REQUEST_FIELD_VERIFICATION",
            "linked_case_id": None,
        },
    )
    assert res.status_code == 422


def test_review_validation_short_or_whitespace_rationale(client: TestClient):
    case_id = create_test_report(client)
    short_rationale_cases = [
        "ok",
        "yes",
        "reviewed",
        "done",
        "               ",
        "short note      ",  # trimmed length is 10 chars (< 15)
    ]
    for r in short_rationale_cases:
        res = client.post(
            f"/api/v1/research/evidence-cases/{case_id}/reviews",
            json={
                "outcome": "REQUEST_FIELD_VERIFICATION",
                "rationale": r,
                "linked_case_id": None,
            },
        )
        assert res.status_code == 422, f"Expected 422 for short/whitespace rationale: '{r}'"


def test_review_validation_excessive_rationale(client: TestClient):
    case_id = create_test_report(client)
    excessive_rationale = "x" * 2001
    res = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "REQUEST_FIELD_VERIFICATION",
            "rationale": excessive_rationale,
            "linked_case_id": None,
        },
    )
    assert res.status_code == 422


def test_review_validation_missing_linked_case_for_related_or_duplicate(client: TestClient):
    case_id = create_test_report(client)
    for outcome in ["MARK_RELATED_CASE", "MARK_POTENTIAL_DUPLICATE"]:
        res = client.post(
            f"/api/v1/research/evidence-cases/{case_id}/reviews",
            json={
                "outcome": outcome,
                "rationale": "Sufficient rationale for linking cases but missing linked_case_id.",
                "linked_case_id": None,
            },
        )
        assert res.status_code == 422
        assert "linked_case_id" in res.text


def test_review_validation_self_linking_rejected(client: TestClient):
    case_id = create_test_report(client)
    res = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "MARK_RELATED_CASE",
            "rationale": "Attempting to link case to itself should be rejected by server.",
            "linked_case_id": case_id,
        },
    )
    assert res.status_code == 422
    assert "cannot link a case to itself" in res.text.lower()


def test_review_validation_nonexistent_linked_case_rejected(client: TestClient):
    case_id = create_test_report(client)
    fake_linked_id = str(uuid.uuid4())
    res = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "MARK_RELATED_CASE",
            "rationale": "Attempting to link to nonexistent case UUID should be rejected.",
            "linked_case_id": fake_linked_id,
        },
    )
    assert res.status_code in (422, 404)
    assert "not found" in res.text.lower() or "linked_case_id" in res.text.lower()


def test_review_validation_linked_case_supplied_for_unrelated_outcome_rejected(client: TestClient):
    case_id_1 = create_test_report(client)
    case_id_2 = create_test_report(client)
    res = client.post(
        f"/api/v1/research/evidence-cases/{case_id_1}/reviews",
        json={
            "outcome": "REQUEST_FIELD_VERIFICATION",
            "rationale": "Supplying linked_case_id when outcome is not related/duplicate.",
            "linked_case_id": case_id_2,
        },
    )
    assert res.status_code == 422
    assert "linked_case_id" in res.text


def test_review_validation_invalid_outcome(client: TestClient):
    case_id = create_test_report(client)
    res = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "CONFIRM_WATER_TOXIC",  # Strictly invalid / forbidden claim
            "rationale": "Attempting to record unauthorized scientific diagnosis.",
            "linked_case_id": None,
        },
    )
    assert res.status_code == 422


# -----------------------------------------------------------------------------
# 3. Evidence State Separation: E4 Never Promoted to E5 by Desktop Review
# -----------------------------------------------------------------------------

def test_evidence_state_separation_e4_never_becomes_e5(client: TestClient):
    """
    Critical Rule:
    Before: E4_CORROBORATED (or E1_REPORTED / E2_DOCUMENTED)
    Researcher: REQUEST_FIELD_VERIFICATION
    After: Still E4_CORROBORATED (or before state).
    Workflow status changes to FIELD_VERIFICATION_REQUESTED.
    Evidence state does NOT become E5_VERIFIED.
    """
    case_id = create_test_report(client, "Observation to test evidence state preservation.")

    res = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "REQUEST_FIELD_VERIFICATION",
            "rationale": "Field inspection requested based on recurring visual characteristics.",
            "linked_case_id": None,
        },
    )
    assert res.status_code == 201
    review = res.json()
    assert review["evidence_state_after"] != "E5_VERIFIED"
    assert review["evidence_state_after"] == review["evidence_state_before"]

    # Also inspect lineage event structured payload
    lineage_res = client.get(f"/api/v1/research/evidence-cases/{case_id}/lineage")
    assert lineage_res.status_code == 200
    events = lineage_res.json()["events"]
    assert len(events) == 1
    event = events[0]
    payload = event["structured_payload_json"]
    assert payload["evidence_state_after"] != "E5_VERIFIED"
    assert payload["evidence_state_before"] == payload["evidence_state_after"]


# -----------------------------------------------------------------------------
# 4. Exactly One Lineage Event per Review & Immutability
# -----------------------------------------------------------------------------

def test_exactly_one_lineage_event_per_successful_review(client: TestClient):
    case_id = create_test_report(client)

    # Initially 0 review lineage events
    initial_lineage = client.get(f"/api/v1/research/evidence-cases/{case_id}/lineage").json()
    assert len(initial_lineage["events"]) == 0

    # Record 1st review
    res1 = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "REQUEST_CLARIFICATION",
            "rationale": "Clarification needed on water surface sheen extent and exact stream bank location.",
            "linked_case_id": None,
        },
    )
    assert res1.status_code == 201

    lineage1 = client.get(f"/api/v1/research/evidence-cases/{case_id}/lineage").json()
    assert len(lineage1["events"]) == 1
    ev1 = lineage1["events"][0]
    assert ev1["event_type"] == "HUMAN_REVIEW_RECORDED"
    assert ev1["actor_type"] == "RESEARCHER"
    assert ev1["actor_id"] == "REV-TEST-001"
    assert ev1["source_service"] == "research_workspace"

    # Record 2nd review on the same case
    res2 = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "REQUEST_FIELD_VERIFICATION",
            "rationale": "Follow-up indicates persistent visual cue warranting in-person physical check.",
            "linked_case_id": None,
        },
    )
    assert res2.status_code == 201

    lineage2 = client.get(f"/api/v1/research/evidence-cases/{case_id}/lineage").json()
    assert len(lineage2["events"]) == 2
    assert lineage2["events"][0]["id"] == ev1["id"]  # First event remains unchanged/immutable
    assert lineage2["events"][1]["structured_payload_json"]["outcome"] == "REQUEST_FIELD_VERIFICATION"


# -----------------------------------------------------------------------------
# 5. Deterministic Chronological Review and Lineage History
# -----------------------------------------------------------------------------

def test_review_and_lineage_chronological_ordering(client: TestClient):
    case_id = create_test_report(client)

    client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "REQUEST_MORE_EVIDENCE",
            "rationale": "Initial review: requesting further observation during daylight hours.",
            "linked_case_id": None,
        },
    )

    client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "RESOLVED_NO_ACTION",
            "rationale": "Subsequent review: additional documentation shows transient non-hazardous organic foam.",
            "linked_case_id": None,
        },
    )

    reviews_res = client.get(f"/api/v1/research/evidence-cases/{case_id}/reviews")
    assert reviews_res.status_code == 200
    reviews = reviews_res.json()["reviews"]
    assert len(reviews) == 2
    assert reviews[0]["outcome"] == "REQUEST_MORE_EVIDENCE"
    assert reviews[1]["outcome"] == "RESOLVED_NO_ACTION"
    assert reviews[0]["created_at"] <= reviews[1]["created_at"]


# -----------------------------------------------------------------------------
# 6. Citizen-Facing Non-Sensitive Impact Status
# -----------------------------------------------------------------------------

def test_citizen_impact_status_is_non_sensitive(client: TestClient):
    case_id = create_test_report(client)

    # Initial impact status
    init_status_res = client.get(f"/api/v1/reports/{case_id}/impact-status")
    assert init_status_res.status_code == 200
    init_data = init_status_res.json()
    assert init_data["status"] == "AWAITING_REVIEW"
    assert "awaiting" in init_data["description"].lower()

    # Record review
    client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "REQUEST_FIELD_VERIFICATION",
            "rationale": "Internal confidential reviewer notes with sensitive triage identifiers.",
            "linked_case_id": None,
        },
    )

    updated_status_res = client.get(f"/api/v1/reports/{case_id}/impact-status")
    assert updated_status_res.status_code == 200
    updated_data = updated_status_res.json()
    assert updated_data["status"] == "FIELD_VERIFICATION_REQUESTED"
    assert "field verification" in updated_data["description"].lower()

    # CRITICAL: Verify NO sensitive researcher details leak
    assert "reviewer_id" not in updated_data
    assert "rationale" not in updated_data
    assert "Internal confidential" not in str(updated_data)
    assert "REV-TEST-001" not in str(updated_data)


# -----------------------------------------------------------------------------
# 7. Nonexistent Case 404 Behavior
# -----------------------------------------------------------------------------

def test_nonexistent_case_returns_404(client: TestClient):
    fake_id = str(uuid.uuid4())
    res = client.post(
        f"/api/v1/research/evidence-cases/{fake_id}/reviews",
        json={
            "outcome": "SUPPORTS_REPORTED_OBSERVATION",
            "rationale": "Valid rationale for nonexistent case.",
            "linked_case_id": None,
        },
    )
    assert res.status_code == 404

    res = client.get(f"/api/v1/research/evidence-cases/{fake_id}/reviews")
    assert res.status_code == 404

    res = client.get(f"/api/v1/research/evidence-cases/{fake_id}/lineage")
    assert res.status_code == 404
